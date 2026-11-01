"""Super Admin GST configuration."""
from __future__ import annotations

import json
from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import gst
from app.db import get_db
from app.domain import row_dict
from app.platform_config import get_setting, set_setting
from app.rbac import require_super_admin
from app.tax_config import resolve_rate, tax_date

router = APIRouter(prefix="/admin/tax", tags=["tax"])

# Reference only, so admins pick from real classifications. Codes are still validated on save.
KNOWN_CODES = [
    {"code": "999591", "label": "Religious services"},
    {"code": "999799", "label": "Other services n.e.c. (catch-all, avoid for puja services)"},
]


class SupplierIn(BaseModel):
    gstin: str = Field(max_length=15)
    state: str = Field(max_length=60)


class RateIn(BaseModel):
    line_type: str
    service_id: str | None = None
    package_type: str | None = Field(default=None, max_length=20)
    hsn_sac: str = Field(default="", max_length=8)
    gst_rate: str = "0"
    classification: str = "taxable"
    effective_from: date
    note: str | None = Field(default=None, max_length=300)


def _audit(db: Session, actor: dict, action: str, details: dict) -> None:
    db.execute(
        text("INSERT INTO tax_config_audit (actor_id, action, details) VALUES (CAST(:a AS uuid), :act, CAST(:d AS jsonb))"),
        {"a": str(actor["id"]), "act": action, "d": json.dumps(details, default=str)},
    )


@router.get("/config")
def tax_overview(user=Depends(require_super_admin), db: Session = Depends(get_db)):
    state = str(get_setting(db, "invoice_company_state", "") or "")
    on = tax_date()
    return {
        "supplier": {
            "gstin": str(get_setting(db, "invoice_gstin", "") or ""),
            "state": state,
            "state_code": gst.state_code(state),
        },
        "states": [{"code": c, "name": n} for c, n in gst.STATE_CODES.items()],
        "line_types": list(gst.LINE_TYPES),
        "classifications": list(gst.CLASSIFICATIONS),
        "known_codes": KNOWN_CODES,
        "current": {lt: resolve_rate(db, lt, None, None, on) for lt in gst.LINE_TYPES},
    }


@router.put("/supplier")
def save_supplier(body: SupplierIn, user=Depends(require_super_admin), db: Session = Depends(get_db)):
    gstin = body.gstin.strip().upper()
    code = gst.state_code(body.state)
    if not code:
        raise HTTPException(400, "Choose a valid State")
    if not gst.valid_gstin(gstin):
        raise HTTPException(400, "Enter a valid 15-character GSTIN")
    if gstin[:2] != code:
        raise HTTPException(400, f"This GSTIN belongs to State code {gstin[:2]}, not {gst.STATE_CODES[code]}")
    before = {"gstin": get_setting(db, "invoice_gstin", ""), "state": get_setting(db, "invoice_company_state", "")}
    set_setting(db, "invoice_gstin", gstin, user_id=str(user["id"]))
    set_setting(db, "invoice_company_state", gst.STATE_CODES[code], user_id=str(user["id"]))
    _audit(db, user, "supplier_updated", {"before": before, "after": {"gstin": gstin, "state": gst.STATE_CODES[code]}})
    db.commit()
    return {"ok": True}


@router.get("/rates")
def list_rates(service_id: str | None = None, user=Depends(require_super_admin), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT r.*, s.name AS service_name, u.name AS created_by_name
            FROM gst_rate_config r
            LEFT JOIN services s ON s.id = r.service_id
            LEFT JOIN users u ON u.id = r.created_by
            WHERE (CAST(:sid AS uuid) IS NULL AND r.service_id IS NULL) OR r.service_id = CAST(:sid AS uuid)
            ORDER BY r.effective_from DESC, r.created_at DESC
            LIMIT 200
            """
        ),
        {"sid": service_id},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/rates")
def add_rate(body: RateIn, user=Depends(require_super_admin), db: Session = Depends(get_db)):
    """A change is always a new dated row; earlier rows and issued invoices are left alone."""
    if body.line_type not in gst.LINE_TYPES:
        raise HTTPException(400, "Unknown line type")
    if body.classification not in gst.CLASSIFICATIONS:
        raise HTTPException(400, "Choose taxable, exempt or nil-rated")
    if not gst.valid_hsn_sac(body.hsn_sac):
        raise HTTPException(400, "Enter a valid HSN (4, 6 or 8 digits) or SAC (6 digits starting 99)")
    if body.effective_from < tax_date():
        raise HTTPException(400, "Effective date cannot be in the past")
    try:
        rate = Decimal(body.gst_rate)
    except InvalidOperation:
        raise HTTPException(400, "Enter a valid GST rate") from None
    if body.classification != "taxable":
        rate = Decimal("0")
    elif rate <= 0 or rate not in gst.OFFICIAL_RATES:
        raise HTTPException(400, "Enter a GST rate notified under GST, such as 5, 18 or 40")
    if body.service_id and not db.execute(
        text("SELECT 1 FROM services WHERE id = CAST(:id AS uuid)"), {"id": body.service_id}
    ).first():
        raise HTTPException(404, "Service not found")
    row = db.execute(
        text(
            """
            INSERT INTO gst_rate_config (
              line_type, service_id, package_type, hsn_sac, gst_rate, classification,
              effective_from, note, created_by
            ) VALUES (:lt, CAST(:sid AS uuid), :pkg, :hsn, :rate, :cls, :eff, :note, CAST(:uid AS uuid))
            RETURNING id
            """
        ),
        {
            "lt": body.line_type,
            "sid": body.service_id,
            "pkg": body.package_type or None,
            "hsn": body.hsn_sac.strip(),
            "rate": rate,
            "cls": body.classification,
            "eff": body.effective_from,
            "note": body.note,
            "uid": str(user["id"]),
        },
    ).first()
    _audit(db, user, "rate_added", {**body.model_dump(), "gst_rate": str(rate), "id": str(row[0])})
    db.commit()
    return {"ok": True, "id": str(row[0])}


@router.get("/audit")
def tax_audit(user=Depends(require_super_admin), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT a.action, a.details, a.created_at, u.name AS actor_name
            FROM tax_config_audit a LEFT JOIN users u ON u.id = a.actor_id
            ORDER BY a.created_at DESC LIMIT 100
            """
        )
    ).mappings().all()
    return [row_dict(r) for r in rows]
