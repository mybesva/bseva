"""Super Admin GST configuration: rate lookup, place of supply and the booking tax snapshot."""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app import gst

_ready = False


def tax_tables_ready(db: Session) -> bool:
    """Databases that have not run migration 031 keep the old flat-rate behaviour."""
    global _ready
    if not _ready:
        _ready = bool(db.execute(text("SELECT to_regclass('public.gst_rate_config')")).scalar())
    return _ready


def tax_date() -> Any:
    return (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).date()


def resolve_rate(db: Session, line_type: str, service_id: str | None, package_type: str | None, on: Any) -> dict | None:
    """Most specific row in force on `on`: puja + package, then puja, then the default."""
    row = db.execute(
        text(
            """
            SELECT hsn_sac, gst_rate, classification, effective_from
            FROM gst_rate_config
            WHERE line_type = :lt
              AND effective_from <= :on
              AND (service_id IS NULL OR service_id = CAST(:sid AS uuid))
              AND (package_type IS NULL OR package_type = :pkg)
            ORDER BY (service_id IS NOT NULL AND package_type IS NOT NULL) DESC,
                     (service_id IS NOT NULL) DESC,
                     (package_type IS NOT NULL) DESC,
                     effective_from DESC, created_at DESC
            LIMIT 1
            """
        ),
        {"lt": line_type, "sid": service_id, "pkg": package_type, "on": on},
    ).mappings().first()
    return dict(row) if row else None


def quote_tax(
    db: Session,
    *,
    amounts: list[tuple[str, str, int]],
    service_id: str | None,
    package_type: str | None,
    discount_paise: int,
    fallback_rate: float,
) -> dict[str, Any]:
    """Tax for a priced booking. `amounts` is (line_type, description, paise)."""
    ready = tax_tables_ready(db)
    on = tax_date()
    lines = []
    for line_type, description, paise in amounts:
        if paise <= 0:
            continue
        cfg = resolve_rate(db, line_type, service_id, package_type, on) if ready else None
        lines.append(
            {
                "line_type": line_type,
                "description": description,
                "amount_paise": int(paise),
                "hsn_sac": (cfg or {}).get("hsn_sac") or "",
                "gst_rate": float((cfg or {}).get("gst_rate", fallback_rate)),
                "classification": (cfg or {}).get("classification") or "taxable",
                "configured": cfg is not None,
            }
        )
    return gst.calculate_lines(lines, discount_paise)


def place_of_supply(
    db: Session,
    *,
    customer_id: str,
    mode: str | None,
    latitude: float | None,
    longitude: float | None,
    country: str | None,
) -> dict[str, Any]:
    """In person: where the puja happens (IGST Act s.12(3)), whoever the customer is.
    Virtual: s.12(2) — a registered customer's GSTIN state, else their address on record."""
    profile = db.execute(
        text("SELECT state, gstin FROM customer_profiles WHERE user_id = CAST(:id AS uuid)"),
        {"id": customer_id},
    ).mappings().first() or {}
    customer_gstin = str(profile.get("gstin") or "").strip().upper()
    if mode == "virtual":
        if str(country or "IN").upper() not in ("", "IN", "IND", "INDIA"):
            return {"code": None, "state": None, "source": "outside_india"}
        if gst.valid_gstin(customer_gstin):
            code = customer_gstin[:2]
            return {"code": code, "state": gst.STATE_CODES[code], "source": "customer_gstin"}
        code = gst.state_code(profile.get("state"))
        return {"code": code, "state": gst.STATE_CODES.get(code or ""), "source": "customer_address"}
    if latitude is not None and longitude is not None:
        row = db.execute(
            text(
                """
                SELECT state FROM customer_addresses
                WHERE user_id = CAST(:id AS uuid)
                  AND ABS(latitude - :lat) < 0.002 AND ABS(longitude - :lng) < 0.002
                ORDER BY updated_at DESC NULLS LAST
                LIMIT 1
                """
            ),
            {"id": customer_id, "lat": latitude, "lng": longitude},
        ).mappings().first()
        code = gst.state_code((row or {}).get("state"))
        if code:
            return {"code": code, "state": gst.STATE_CODES[code], "source": "puja_location"}
    code = gst.state_code(profile.get("state"))
    return {"code": code, "state": gst.STATE_CODES.get(code or ""), "source": "customer_profile_fallback"}


def save_booking_tax(db: Session, booking_id: str, bill: dict, customer_id: str, booking: dict[str, Any]) -> None:
    """Freeze what was charged. Called inside the booking transaction."""
    if not tax_tables_ready(db):
        return
    pos = place_of_supply(
        db,
        customer_id=customer_id,
        mode=booking.get("mode"),
        latitude=booking.get("latitude"),
        longitude=booking.get("longitude"),
        country=booking.get("country"),
    )
    snapshot = {
        "lines": bill.get("taxLines") or [],
        "tax_paise": int(bill.get("gstAmount") or 0),
        "taxable_paise": int(bill.get("subtotal") or 0)
        + int(bill.get("customerPlatformFee") or 0)
        + int(bill.get("gatewayFee") or 0),
        "discount_paise": int(bill.get("discount") or 0) + int(bill.get("walletCredit") or 0),
        "place_of_supply": pos,
    }
    db.execute(
        text(
            """
            INSERT INTO booking_tax_snapshots (booking_id, snapshot)
            VALUES (CAST(:id AS uuid), CAST(:s AS jsonb))
            ON CONFLICT (booking_id) DO NOTHING
            """
        ),
        {"id": booking_id, "s": json.dumps(snapshot)},
    )


def load_booking_tax(db: Session, booking_id: str) -> dict | None:
    if not tax_tables_ready(db):
        return None
    row = db.execute(
        text("SELECT snapshot FROM booking_tax_snapshots WHERE booking_id = CAST(:id AS uuid)"),
        {"id": booking_id},
    ).first()
    if not row:
        return None
    return row[0] if isinstance(row[0], dict) else json.loads(row[0])


def invoice_tax(snapshot: dict, company: dict, customer_gstin: str) -> dict[str, Any]:
    """Tax block of an invoice, with everything that stops it being a valid tax invoice."""
    supplier_gstin = str(company.get("gstin") or "").strip().upper()
    supplier_code = gst.state_code(company.get("state"))
    pos = snapshot.get("place_of_supply") or {}
    pos_code = pos.get("code")
    split = gst.split_tax(
        {
            "lines": snapshot.get("lines") or [],
            "tax_paise": int(snapshot.get("tax_paise") or 0),
            "taxable_paise": int(snapshot.get("taxable_paise") or 0),
        },
        supplier_code,
        pos_code,
    )
    flags: list[str] = []
    notes: list[str] = []
    if not supplier_gstin:
        flags.append("Supplier GSTIN is missing")
    elif not gst.valid_gstin(supplier_gstin):
        flags.append("Supplier GSTIN is invalid")
    elif supplier_gstin[:2] != supplier_code:
        flags.append("Supplier GSTIN does not match the registered State")
    if not supplier_code:
        flags.append("Supplier registered State is missing or invalid")
    if pos.get("source") == "outside_india":
        flags.append("Customer is outside India: review export treatment")
    elif not pos_code:
        flags.append("Place of Supply is missing")
    elif pos.get("source") == "customer_profile_fallback":
        notes.append("Place of Supply taken from the customer profile, not the puja location")
    if customer_gstin and not gst.valid_gstin(customer_gstin):
        notes.append("Customer GSTIN is invalid, so it was left off")
    for line in split["lines"]:
        name = line.get("description") or line.get("line_type")
        if not line.get("configured"):
            flags.append(f"No GST configuration for {name}")
        if not gst.valid_hsn_sac(line.get("hsn_sac")):
            flags.append(f"HSN/SAC missing or invalid for {name}")
        if line.get("classification") == "taxable" and Decimal(str(line.get("gst_rate"))) not in gst.OFFICIAL_RATES:
            flags.append(f"GST rate {line.get('gst_rate')}% for {name} is not a recognised rate")
    return {
        **split,
        "supplier_gstin": supplier_gstin,
        "supplier_state_code": supplier_code,
        "customer_gstin": customer_gstin if gst.valid_gstin(customer_gstin) else "",
        "place_of_supply": pos,
        "blocking": bool(flags),
        "flags": flags + notes,
    }
