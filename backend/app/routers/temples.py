"""Admin temple directory — CRUD, bulk CSV import, pujari registration match by phone."""
from __future__ import annotations

import re
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.domain import row_dict
from app.rbac import require_permission
from app.schemas import TempleBulkIn, TempleIn

router = APIRouter(prefix="/admin", tags=["temples"])

_PHONE_DIGITS = re.compile(r"\D")


def phone_last10(raw: str | None) -> str:
    digits = _PHONE_DIGITS.sub("", raw or "")
    if not digits:
        return ""
    if digits.startswith("91") and len(digits) >= 12:
        digits = digits[-10:]
    elif len(digits) > 10:
        digits = digits[-10:]
    return digits


def pujari_phone_index(db: Session) -> dict[str, dict[str, Any]]:
    rows = db.execute(
        text(
            """
            SELECT u.id, u.name, u.phone, u.blocked, p.mobile_number, p.whatsapp_number,
                   p.verification_status, p.full_name
            FROM users u
            LEFT JOIN pujari_profiles p ON p.user_id = u.id
            WHERE u.role IN ('pujari', 'head_pujari')
            """
        )
    ).mappings().all()
    index: dict[str, dict[str, Any]] = {}
    for r in rows:
        info = {
            "pujari_user_id": str(r["id"]),
            "pujari_account_name": r.get("full_name") or r.get("name"),
            "pujari_verification_status": r.get("verification_status"),
            "pujari_blocked": bool(r.get("blocked")),
        }
        for field in (r.get("phone"), r.get("mobile_number"), r.get("whatsapp_number")):
            key = phone_last10(field)
            if len(key) == 10 and key not in index:
                index[key] = info
    return index


def attach_pujari_status(item: dict, index: dict[str, dict[str, Any]]) -> dict:
    phone = item.get("contact_phone") or item.get("contactPhone")
    match = index.get(phone_last10(phone)) if phone else None
    item["pujari_registered"] = bool(match)
    item["pujari_user_id"] = match.get("pujari_user_id") if match else None
    item["pujari_account_name"] = match.get("pujari_account_name") if match else None
    item["pujari_verification_status"] = match.get("pujari_verification_status") if match else None
    item["pujari_blocked"] = match.get("pujari_blocked") if match else None
    if match and not (item.get("pujari_name") or "").strip():
        item["pujari_name"] = match.get("pujari_account_name")
    return item


def _row(body: TempleIn) -> dict:
    return {
        "name": body.name.strip(),
        "description": (body.description or "").strip() or None,
        "deity": (body.deity or "").strip() or None,
        "address": (body.address or "").strip() or None,
        "city": (body.city or "").strip() or None,
        "state": (body.state or "").strip() or None,
        "pincode": (body.pincode or "").strip() or None,
        "timings": (body.timings or "").strip() or None,
        "contact_phone": (body.contact_phone or "").strip() or None,
        "contact_email": (body.contact_email or "").strip() or None,
        "pujari_name": (body.pujari_name or "").strip() or None,
        "website": (body.website or "").strip() or None,
        "active": bool(body.active),
    }


def _item_from_bulk(raw: dict) -> dict:
    def g(*keys: str) -> str | None:
        for k in keys:
            v = raw.get(k)
            if v is None:
                continue
            s = str(v).strip()
            if s:
                return s
        return None

    name = g("name", "temple_name", "templeName")
    if not name:
        raise ValueError("Temple name is required")
    return {
        "name": name,
        "description": g("description"),
        "deity": g("deity"),
        "address": g("address"),
        "city": g("city"),
        "state": g("state"),
        "pincode": g("pincode"),
        "timings": g("timings"),
        "contact_phone": g("contact_phone", "contactPhone", "phone"),
        "contact_email": g("contact_email", "contactEmail", "email"),
        "pujari_name": g("pujari_name", "pujariName", "pujari"),
        "website": g("website"),
        "active": str(raw.get("active", "true")).strip().lower() not in {"false", "0", "no"},
    }


@router.get("/temples")
def list_temples(
    q: str | None = Query(None),
    city: str | None = Query(None),
    db: Session = Depends(get_db),
    user=Depends(require_permission("manage_services")),
):
    extra = ""
    params: dict[str, Any] = {}
    if q and q.strip():
        extra += " AND (t.name ILIKE :q OR COALESCE(t.deity,'') ILIKE :q OR COALESCE(t.city,'') ILIKE :q OR COALESCE(t.pujari_name,'') ILIKE :q)"
        params["q"] = f"%{q.strip()}%"
    if city and city.strip() and city.strip().lower() != "all":
        extra += " AND t.city ILIKE :city"
        params["city"] = city.strip()
    rows = db.execute(
        text(
            f"""
            SELECT t.*
            FROM temples t
            WHERE 1=1 {extra}
            ORDER BY t.name
            """
        ),
        params,
    ).mappings().all()
    index = pujari_phone_index(db)
    items = [attach_pujari_status(row_dict(r), index) for r in rows]
    cities = sorted({(i.get("city") or "").strip() for i in items if i.get("city")})
    return {
        "items": items,
        "total": len(items),
        "cities": cities,
        "registered_count": sum(1 for i in items if i.get("pujari_registered")),
    }


@router.post("/temples")
def create_temple(body: TempleIn, db: Session = Depends(get_db), user=Depends(require_permission("manage_services"))):
    tid = str(uuid4())
    vals = _row(body)
    db.execute(
        text(
            """
            INSERT INTO temples (
              id, name, description, deity, address, city, state, pincode, timings,
              contact_phone, contact_email, pujari_name, website, active
            ) VALUES (
              CAST(:id AS uuid), :name, :description, :deity, :address, :city, :state, :pincode, :timings,
              :contact_phone, :contact_email, :pujari_name, :website, :active
            )
            """
        ),
        {"id": tid, **vals},
    )
    db.commit()
    row = db.execute(text("SELECT * FROM temples WHERE id = CAST(:id AS uuid)"), {"id": tid}).mappings().one()
    return attach_pujari_status(row_dict(row), pujari_phone_index(db))


@router.patch("/temples/{temple_id}")
def update_temple(
    temple_id: str,
    body: TempleIn,
    db: Session = Depends(get_db),
    user=Depends(require_permission("manage_services")),
):
    existing = db.execute(
        text("SELECT id FROM temples WHERE id = CAST(:id AS uuid)"),
        {"id": temple_id},
    ).first()
    if not existing:
        raise HTTPException(404, "Temple not found")
    vals = _row(body)
    db.execute(
        text(
            """
            UPDATE temples SET
              name = :name, description = :description, deity = :deity, address = :address,
              city = :city, state = :state, pincode = :pincode, timings = :timings,
              contact_phone = :contact_phone, contact_email = :contact_email,
              pujari_name = :pujari_name, website = :website, active = :active,
              updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": temple_id, **vals},
    )
    db.commit()
    row = db.execute(
        text("SELECT * FROM temples WHERE id = CAST(:id AS uuid)"),
        {"id": temple_id},
    ).mappings().one()
    return attach_pujari_status(row_dict(row), pujari_phone_index(db))


@router.delete("/temples/{temple_id}")
def delete_temple(temple_id: str, db: Session = Depends(get_db), user=Depends(require_permission("manage_services"))):
    result = db.execute(text("DELETE FROM temples WHERE id = CAST(:id AS uuid)"), {"id": temple_id})
    if result.rowcount == 0:
        raise HTTPException(404, "Temple not found")
    db.commit()
    return {"ok": True}


@router.post("/temples/bulk")
def bulk_import_temples(body: TempleBulkIn, db: Session = Depends(get_db), user=Depends(require_permission("manage_services"))):
    if not body.items:
        raise HTTPException(400, "No temple rows to import")
    index = pujari_phone_index(db)
    created = 0
    updated = 0
    failed: list[dict[str, Any]] = []
    for i, raw in enumerate(body.items, start=2):
        try:
            vals = _item_from_bulk(raw)
        except ValueError as e:
            failed.append({"row": i, "field": "name", "message": str(e)})
            continue
        phone = vals.get("contact_phone")
        match = index.get(phone_last10(phone)) if phone else None
        if match and not vals.get("pujari_name"):
            vals["pujari_name"] = match.get("pujari_account_name")
        existing = None
        if vals.get("name") and vals.get("city"):
            existing = db.execute(
                text(
                    """
                    SELECT id FROM temples
                    WHERE lower(name) = lower(:n) AND lower(COALESCE(city,'')) = lower(:c)
                    LIMIT 1
                    """
                ),
                {"n": vals["name"], "c": vals.get("city") or ""},
            ).first()
        try:
            if existing:
                db.execute(
                    text(
                        """
                        UPDATE temples SET
                          description = COALESCE(:description, description),
                          deity = COALESCE(:deity, deity),
                          address = COALESCE(:address, address),
                          state = COALESCE(:state, state),
                          pincode = COALESCE(:pincode, pincode),
                          timings = COALESCE(:timings, timings),
                          contact_phone = COALESCE(:contact_phone, contact_phone),
                          contact_email = COALESCE(:contact_email, contact_email),
                          pujari_name = COALESCE(:pujari_name, pujari_name),
                          website = COALESCE(:website, website),
                          active = :active,
                          updated_at = NOW()
                        WHERE id = CAST(:id AS uuid)
                        """
                    ),
                    {"id": str(existing[0]), **vals},
                )
                updated += 1
            else:
                db.execute(
                    text(
                        """
                        INSERT INTO temples (
                          id, name, description, deity, address, city, state, pincode, timings,
                          contact_phone, contact_email, pujari_name, website, active
                        ) VALUES (
                          CAST(:id AS uuid), :name, :description, :deity, :address, :city, :state, :pincode, :timings,
                          :contact_phone, :contact_email, :pujari_name, :website, :active
                        )
                        """
                    ),
                    {"id": str(uuid4()), **vals},
                )
                created += 1
        except Exception as e:
            failed.append({"row": i, "field": "general", "message": str(e).split("\n")[0][:180]})
    db.commit()
    return {
        "total": len(body.items),
        "success": created + updated,
        "created": created,
        "updated": updated,
        "failed": len(failed),
        "errors": failed,
    }
