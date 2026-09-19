"""Official BSeva customer tax invoices — immutable snapshots, sequential numbers, PDF."""
from __future__ import annotations

import html
import json
import logging
import re
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.document_brand import wrap_html_document
from app.platform_config import get_setting

logger = logging.getLogger("bseva.invoice")

ORANGE = "#FF9933"
NAVY = "#1A2B4A"


def _s(db: Session, key: str, default: str = "") -> str:
    return str(get_setting(db, key, default) or default)


def company_snapshot(db: Session) -> dict[str, str]:
    """Live admin-configurable company block. Copied into each issued invoice."""
    return {
        "brand_name": _s(db, "invoice_brand_name", "BSeva"),
        "legal_name": _s(db, "invoice_company_name", "BSeva Services Private Limited"),
        "address": _s(
            db,
            "invoice_company_address",
            "123, Banjara Hills Road No. 12, Hyderabad, Telangana – 500034, India",
        ),
        "state": _s(db, "invoice_company_state", "Telangana"),
        "pincode": _s(db, "invoice_company_pincode", "500034"),
        "email": _s(db, "invoice_company_email", "support@b-seva.com"),
        "phone": _s(db, "invoice_company_phone", ""),
        "gstin": _s(db, "invoice_gstin", ""),
        "pan": _s(db, "invoice_pan", ""),
        "website": _s(db, "invoice_website", "www.b-seva.com"),
        "logo_path": _s(db, "invoice_logo_path", "/bseva-logo-transparent.png"),
        "prefix_customer": _s(db, "invoice_prefix_customer", "BSEVA"),
        "prefix_settlement": _s(db, "invoice_prefix_settlement", "INV-S"),
        "signatory_name": _s(db, "invoice_signatory_name", ""),
        "signatory_designation": _s(db, "invoice_signatory_designation", "Authorized Signatory"),
        "sac_code": _s(db, "invoice_sac_code", "999799"),
        "hsn_code": _s(db, "invoice_hsn_code", ""),
        "terms": _s(
            db,
            "invoice_terms",
            "This invoice is issued for puja/religious services booked on BSeva.",
        ),
        "notes": _s(db, "invoice_notes", "Thank you for choosing BSeva."),
        "from_email": _s(db, "email_from_accounts", "accounts@b-seva.com"),
    }


def company_block(db: Session) -> dict[str, str]:
    """Back-compat alias used by older settlement invoice rendering."""
    c = company_snapshot(db)
    return {
        "name": c["legal_name"],
        "gstin": c["gstin"] or "—",
        "address": c["address"],
        "prefix_customer": c["prefix_customer"],
        "prefix_settlement": c["prefix_settlement"],
        "from_email": c["from_email"],
    }


def paise_inr(paise: int | None) -> str:
    v = (paise or 0) / 100.0
    return f"₹{v:,.2f}"


def format_duration_minutes(minutes: int | None) -> str:
    if minutes is None:
        return ""
    total = max(0, int(minutes))
    hours, remaining = divmod(total, 60)
    parts: list[str] = []
    if hours:
        parts.append(f"{hours} Hour" + ("" if hours == 1 else "s"))
    if remaining or not parts:
        parts.append(f"{remaining} Minute" + ("" if remaining == 1 else "s"))
    return " ".join(parts)


def indian_fy(d: date | None = None) -> str:
    d = d or date.today()
    if d.month >= 4:
        return f"{d.year}-{str(d.year + 1)[2:]}"
    return f"{d.year - 1}-{str(d.year)[2:]}"


_ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _chunk_words(n: int) -> str:
    if n < 20:
        return _ONES[n]
    if n < 100:
        tens, ones = _TENS[n // 10], _ONES[n % 10]
        if ones:
            return f"{tens}-{ones}"
        return tens
    return f"{_ONES[n // 100]} Hundred {_chunk_words(n % 100)}".strip()


def amount_in_words(paise: int | None) -> str:
    rupees = abs(int(paise or 0)) // 100
    if rupees == 0:
        return "Rupees Zero Only"
    parts: list[str] = []
    crore = rupees // 10000000
    if crore:
        parts.append(f"{_chunk_words(crore)} Crore")
    rupees %= 10000000
    lakh = rupees // 100000
    if lakh:
        parts.append(f"{_chunk_words(lakh)} Lakh")
    rupees %= 100000
    thousand = rupees // 1000
    if thousand:
        parts.append(f"{_chunk_words(thousand)} Thousand")
    rest = rupees % 1000
    if rest:
        parts.append(_chunk_words(rest))
    return "Rupees " + " ".join(p for p in parts if p).strip() + " Only"


def pdf_filename(invoice_number: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9.-]+", "_", str(invoice_number or "invoice")).strip("_")
    return f"BSeva_Invoice_{safe}.pdf"


def _ensure_invoice_schema(db: Session) -> None:
    stmts = [
        """
        CREATE TABLE IF NOT EXISTS invoice_sequences (
          fy TEXT PRIMARY KEY,
          last_n INTEGER NOT NULL DEFAULT 0
        )
        """,
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_status TEXT",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS email_error TEXT",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'PAID'",
        "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS original_invoice_id UUID",
        "ALTER TABLE customer_profiles ADD COLUMN IF NOT EXISTS gstin TEXT",
        "ALTER TABLE settlements ADD COLUMN IF NOT EXISTS blocked_paise INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE settlements ADD COLUMN IF NOT EXISTS blocked_reason TEXT",
        """
        CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_customer_per_booking
        ON invoices (booking_id)
        WHERE invoice_type = 'customer' AND booking_id IS NOT NULL
        """,
    ]
    for stmt in stmts:
        try:
            db.execute(text(stmt))
        except Exception:
            db.rollback()


def next_invoice_number(db: Session, prefix: str) -> str:
    fy = indian_fy()
    pre = (prefix or "BSEVA").strip().rstrip("/")
    db.execute(
        text(
            """
            INSERT INTO invoice_sequences (fy, last_n) VALUES (:fy, 0)
            ON CONFLICT (fy) DO NOTHING
            """
        ),
        {"fy": fy},
    )
    n = db.execute(
        text("UPDATE invoice_sequences SET last_n = last_n + 1 WHERE fy = :fy RETURNING last_n"),
        {"fy": fy},
    ).scalar()
    if n is None:
        db.execute(text("INSERT INTO invoice_sequences (fy, last_n) VALUES (:fy, 1) ON CONFLICT (fy) DO UPDATE SET last_n = invoice_sequences.last_n + 1"), {"fy": fy})
        n = db.execute(text("SELECT last_n FROM invoice_sequences WHERE fy = :fy"), {"fy": fy}).scalar()
    return f"{pre}/{fy}/{int(n or 1):06d}"


def _parse_snap(inv: dict[str, Any]) -> dict[str, Any]:
    snap = inv.get("snapshot")
    if isinstance(snap, str):
        try:
            snap = json.loads(snap)
        except Exception:
            snap = {}
    return snap or {}


def _customer_bill_to(db: Session, booking: dict) -> dict[str, str]:
    cid = str(booking.get("customer_id") or "")
    user = db.execute(
        text("SELECT name, email, phone FROM users WHERE id = CAST(:id AS uuid)"),
        {"id": cid},
    ).mappings().first() or {}
    prof = db.execute(
        text(
            """
            SELECT address_line1, address_line2, city, district, state, pincode, gstin
            FROM customer_profiles WHERE user_id = CAST(:id AS uuid)
            """
        ),
        {"id": cid},
    ).mappings().first() or {}
    line1 = str(prof.get("address_line1") or "").strip()
    line2 = str(prof.get("address_line2") or "").strip()
    city = str(prof.get("city") or "").strip()
    state = str(prof.get("state") or "").strip()
    pin = str(prof.get("pincode") or "").strip()
    booking_addr = str(booking.get("address") or booking.get("location_label") or "").strip()
    address = ", ".join(x for x in [line1, line2] if x) or booking_addr
    return {
        "name": str(user.get("name") or "Customer"),
        "email": str(user.get("email") or ""),
        "phone": str(user.get("phone") or ""),
        "address": address,
        "city": city,
        "state": state,
        "pincode": pin,
        "gstin": str(prof.get("gstin") or ""),
    }


def _service_snapshot(db: Session, booking: dict) -> tuple[str, int | None]:
    sid = booking.get("service_id")
    if not sid:
        return "Puja", None
    row = db.execute(
        text("SELECT name, duration_minutes FROM services WHERE id = CAST(:id AS uuid)"),
        {"id": str(sid)},
    ).mappings().first()
    return str((row or {}).get("name") or "Puja"), (
        int(row["duration_minutes"]) if row and row.get("duration_minutes") is not None else None
    )


def _customer_lines(booking: dict, service_name: str, sac: str, hsn: str) -> list[dict[str, Any]]:
    pkg = str(booking.get("package_type") or "standard").title()
    lines: list[dict[str, Any]] = []

    def add(desc: str, paise: int, code: str) -> None:
        amt = int(paise or 0)
        if amt <= 0:
            return
        lines.append(
            {
                "description": desc,
                "hsn_sac": code,
                "qty": 1,
                "rate_paise": amt,
                "taxable_paise": amt,
                "gst_paise": 0,
                "amount_paise": amt,
            }
        )

    add(f"{service_name} – {pkg} Package", int(booking.get("main_puja_charge_paise") or booking.get("base_price_paise") or 0), sac or hsn)
    add("Samagri Package", int(booking.get("samagri_charge_paise") or 0), sac or hsn)
    add("Alankaram", int(booking.get("alankaram_charge_paise") or 0), sac or hsn)
    add("Food / Prasadam", int(booking.get("food_charge_paise") or 0), sac or hsn)
    add("Weekend / festival surge", int(booking.get("peak_fee_paise") or 0), sac or hsn)
    known = sum(int(x["taxable_paise"]) for x in lines)
    gst_amt = int(booking.get("gst_amount_paise") or 0)
    discount = int(booking.get("discount_paise") or 0)
    total = int(booking.get("total_paise") or 0)
    other = total - gst_amt + discount - known
    add("Other applicable booking charges", other, sac or hsn)
    return lines


def _tax_split(gst_paise: int, gst_percent: float, customer_state: str, company_state: str) -> dict[str, Any]:
    gst = max(0, int(gst_paise or 0))
    intra = (customer_state or "").strip().lower() == (company_state or "").strip().lower() and bool(customer_state)
    if gst <= 0:
        return {
            "mode": "none",
            "gst_percent": float(gst_percent or 0),
            "cgst_paise": 0,
            "sgst_paise": 0,
            "igst_paise": 0,
            "gst_paise": 0,
        }
    if intra or not customer_state:
        half = gst // 2
        return {
            "mode": "cgst_sgst",
            "gst_percent": float(gst_percent or 0),
            "cgst_paise": half,
            "sgst_paise": gst - half,
            "igst_paise": 0,
            "gst_paise": gst,
        }
    return {
        "mode": "igst",
        "gst_percent": float(gst_percent or 0),
        "cgst_paise": 0,
        "sgst_paise": 0,
        "igst_paise": gst,
        "gst_paise": gst,
    }


def _allocate_gst(lines: list[dict[str, Any]], gst_amt: int) -> None:
    gst = max(0, int(gst_amt or 0))
    if not lines or gst <= 0:
        return
    taxable = sum(int(x.get("taxable_paise") or 0) for x in lines)
    remaining = gst
    for i, line in enumerate(lines):
        if i == len(lines) - 1:
            share = remaining
        elif taxable:
            share = int(round(gst * int(line.get("taxable_paise") or 0) / taxable))
            remaining -= share
        else:
            share = 0
        line["gst_paise"] = share
        line["amount_paise"] = int(line.get("taxable_paise") or 0) + share


def _payment_info(db: Session, booking: dict) -> tuple[str, str, str]:
    row = None
    try:
        with db.begin_nested():
            row = db.execute(
                text(
                    """
                    SELECT id, provider, provider_ref, created_at
                    FROM payments
                    WHERE booking_id = CAST(:id AS uuid)
                    ORDER BY created_at DESC
                    LIMIT 1
                    """
                ),
                {"id": str(booking.get("id") or "")},
            ).mappings().first()
    except Exception:
        row = None
    provider = str((row or {}).get("provider") or "wallet").lower()
    labels = {"wallet": "Wallet", "wallet_demo": "Wallet", "razorpay": "Razorpay", "upi": "UPI"}
    method = labels.get(provider, provider.replace("_", " ").title() or "Wallet")
    pay_id = str(
        (row or {}).get("provider_ref")
        or (row or {}).get("id")
        or booking.get("payment_reference")
        or booking.get("booking_number")
        or ""
    )
    paid_at = str((row or {}).get("created_at") or datetime.utcnow().isoformat(timespec="seconds") + "Z")
    return method, pay_id, paid_at


def existing_customer_invoice(db: Session, booking_id: str) -> dict | None:
    row = db.execute(
        text(
            """
            SELECT * FROM invoices
            WHERE booking_id = CAST(:id AS uuid) AND invoice_type = 'customer'
            ORDER BY created_at ASC
            LIMIT 1
            """
        ),
        {"id": str(booking_id)},
    ).mappings().first()
    return dict(row) if row else None


def create_customer_invoice(db: Session, *, booking: dict, user_id: str) -> str | None:
    """Issue an immutable customer tax invoice. Idempotent per booking."""
    _ensure_invoice_schema(db)
    bid = str(booking["id"])
    existing = existing_customer_invoice(db, bid)
    if existing:
        return str(existing.get("invoice_number") or "")
    if str(booking.get("payment_status") or "") != "paid":
        return None

    company = company_snapshot(db)
    bill_to = _customer_bill_to(db, booking)
    service_name, duration_minutes = _service_snapshot(db, booking)
    lines = _customer_lines(booking, service_name, company["sac_code"], company["hsn_code"])
    taxable = sum(int(x["taxable_paise"]) for x in lines)
    gst_amt = int(booking.get("gst_amount_paise") or 0)
    gst_pct = float(booking.get("gst_percent") or 0)
    if gst_pct <= 0:
        try:
            row = db.execute(text("SELECT gst_percent FROM pricing_config WHERE id = 1")).first()
            gst_pct = float(row[0] or 0) if row else 0
        except Exception:
            gst_pct = 0
    tax = _tax_split(gst_amt, gst_pct, bill_to.get("state") or "", company.get("state") or "")
    _allocate_gst(lines, gst_amt)
    discount = int(booking.get("discount_paise") or 0)
    total = int(booking.get("total_paise") or (taxable - discount + gst_amt))
    title = "TAX INVOICE" if gst_amt > 0 or gst_pct > 0 else "INVOICE"
    pay_method, pay_id, paid_at = _payment_info(db, booking)
    snap = {
        "title": title,
        "invoice_number": None,
        "invoice_date": date.today().isoformat(),
        "booking_id": bid,
        "booking_number": booking.get("booking_number"),
        "service_name": service_name,
        "duration_minutes": duration_minutes,
        "package_type": booking.get("package_type"),
        "booking_date": str(booking.get("booking_date") or ""),
        "start_time": str(booking.get("start_time") or ""),
        "payment_id": pay_id,
        "payment_method": pay_method,
        "payment_date": paid_at,
        "payment_status": "PAID",
        "company": company,
        "bill_to": bill_to,
        "lines": lines,
        "subtotal_paise": taxable,
        "discount_paise": discount,
        "taxable_paise": max(0, taxable - discount),
        "tax": tax,
        "total_paise": total,
        "amount_in_words": amount_in_words(total),
        "terms": company["terms"],
        "notes": company["notes"],
    }
    for _ in range(5):
        inv_no = next_invoice_number(db, company["prefix_customer"])
        snap["invoice_number"] = inv_no
        try:
            with db.begin_nested():
                db.execute(
                    text(
                        """
                        INSERT INTO invoices (
                          invoice_number, invoice_type, booking_id, user_id, snapshot, total_paise, payment_status
                        ) VALUES (:n, 'customer', CAST(:bid AS uuid), CAST(:uid AS uuid), CAST(:s AS jsonb), :t, 'PAID')
                        """
                    ),
                    {"n": inv_no, "bid": bid, "uid": str(user_id), "s": json.dumps(snap), "t": total},
                )
            return inv_no
        except IntegrityError:
            existing = existing_customer_invoice(db, bid)
            if existing:
                return str(existing.get("invoice_number") or "")
    existing = existing_customer_invoice(db, bid)
    return str(existing.get("invoice_number") or "") if existing else None


def create_settlement_invoice(db: Session, *, booking: dict, settlement: dict) -> str | None:
    """Internal settlement statement (not a customer tax invoice)."""
    _ensure_invoice_schema(db)
    company = company_snapshot(db)
    prefix = company["prefix_settlement"]
    sid = str(settlement.get("id") or booking["id"])
    inv_no = f"{prefix}-{datetime.utcnow().strftime('%y%m%d')}-{sid[:8].upper()}"
    payable = int(settlement.get("settlement_amount_paise") or settlement.get("pujari_payable_paise") or 0)
    snap = {
        "booking_number": booking.get("booking_number"),
        "base_puja_paise": int(settlement.get("base_puja_paise") or 0),
        "platform_fee_paise": int(settlement.get("platform_fee_paise") or 0),
        "gst_paise": int(settlement.get("gst_paise") or 0),
        "settlement_amount_paise": payable,
        "due_date": str(settlement.get("due_date") or ""),
        "company": company,
        "lines": [
            {"description": "Base puja (pujari share basis)", "amount_paise": int(settlement.get("base_puja_paise") or 0)},
            {"description": "Platform fee (deducted)", "amount_paise": -int(settlement.get("platform_fee_paise") or 0)},
            {"description": "Settlement payable", "amount_paise": payable},
        ],
    }
    db.execute(
        text(
            """
            INSERT INTO invoices (invoice_number, invoice_type, booking_id, user_id, snapshot, total_paise)
            VALUES (:n, 'settlement', CAST(:bid AS uuid), CAST(:uid AS uuid), CAST(:s AS jsonb), :t)
            ON CONFLICT (invoice_number) DO NOTHING
            """
        ),
        {
            "n": inv_no,
            "bid": str(booking["id"]),
            "uid": str(settlement.get("pujari_id") or booking.get("pujari_id")),
            "s": json.dumps(snap),
            "t": payable,
        },
    )
    return inv_no


def create_credit_note(db: Session, *, booking: dict, original: dict, refund_paise: int) -> str | None:
    """Issue a credit note for a refund. Never edits the original invoice."""
    _ensure_invoice_schema(db)
    if refund_paise <= 0:
        return None
    company = company_snapshot(db)
    orig_no = str(original.get("invoice_number") or "")
    inv_no = next_invoice_number(db, company["prefix_customer"])
    orig_snap = _parse_snap(original)
    snap = {
        "title": "CREDIT NOTE",
        "invoice_number": inv_no,
        "invoice_date": date.today().isoformat(),
        "original_invoice_number": orig_no,
        "booking_id": str(booking.get("id") or ""),
        "booking_number": booking.get("booking_number"),
        "company": orig_snap.get("company") or company,
        "bill_to": orig_snap.get("bill_to") or _customer_bill_to(db, booking),
        "lines": [
            {
                "description": f"Credit against invoice {orig_no}",
                "hsn_sac": company.get("sac_code") or "",
                "qty": 1,
                "rate_paise": refund_paise,
                "taxable_paise": refund_paise,
                "gst_paise": 0,
                "amount_paise": refund_paise,
            }
        ],
        "subtotal_paise": refund_paise,
        "discount_paise": 0,
        "taxable_paise": refund_paise,
        "tax": {"mode": "none", "gst_paise": 0, "cgst_paise": 0, "sgst_paise": 0, "igst_paise": 0},
        "total_paise": refund_paise,
        "amount_in_words": amount_in_words(refund_paise),
        "payment_status": "CREDIT",
        "terms": orig_snap.get("terms") or company["terms"],
        "notes": "This credit note does not replace the original tax invoice.",
    }
    db.execute(
        text(
            """
            INSERT INTO invoices (
              invoice_number, invoice_type, booking_id, user_id, snapshot, total_paise,
              payment_status, original_invoice_id
            ) VALUES (
              :n, 'credit_note', CAST(:bid AS uuid), CAST(:uid AS uuid), CAST(:s AS jsonb), :t,
              'CREDIT', CAST(:oid AS uuid)
            )
            """
        ),
        {
            "n": inv_no,
            "bid": str(booking["id"]),
            "uid": str(booking.get("customer_id") or original.get("user_id")),
            "s": json.dumps(snap),
            "t": refund_paise,
            "oid": str(original.get("id")),
        },
    )
    return inv_no


def render_invoice_html(db: Session, inv: dict[str, Any]) -> str:
    """Render from the stored snapshot only (settings changes do not rewrite issued invoices)."""
    snap = _parse_snap(inv)
    company = snap.get("company") or company_snapshot(db)
    bill = snap.get("bill_to") or {}
    lines = snap.get("lines") or []
    tax = snap.get("tax") or {}
    title = str(snap.get("title") or ("TAX INVOICE" if inv.get("invoice_type") == "customer" else "INVOICE"))
    if inv.get("invoice_type") == "settlement":
        title = "SETTLEMENT STATEMENT"
    gstin = company.get("gstin") or ""
    rows = []
    for i, r in enumerate(lines, 1):
        desc = html.escape(str(r.get("description") or r.get("label") or ""))
        sac = html.escape(str(r.get("hsn_sac") or ""))
        qty = int(r.get("qty") or 1)
        rate = paise_inr(int(r.get("rate_paise") or r.get("amount_paise") or 0))
        taxable = paise_inr(int(r.get("taxable_paise") or r.get("amount_paise") or 0))
        gst = paise_inr(int(r.get("gst_paise") or 0))
        amt = paise_inr(int(r.get("amount_paise") or 0))
        rows.append(
            f"<tr><td>{i}</td><td>{desc}</td><td>{sac}</td><td>{qty}</td>"
            f"<td class='r'>{rate}</td><td class='r'>{taxable}</td><td class='r'>{gst}</td><td class='r'>{amt}</td></tr>"
        )
    if not rows:
        rows.append("<tr><td colspan='8'>No line items</td></tr>")
    tax_rows = ""
    if int(tax.get("cgst_paise") or 0):
        tax_rows += f"<tr><td colspan='7' class='r'>CGST</td><td class='r'>{paise_inr(int(tax['cgst_paise']))}</td></tr>"
        tax_rows += f"<tr><td colspan='7' class='r'>SGST</td><td class='r'>{paise_inr(int(tax['sgst_paise']))}</td></tr>"
    elif int(tax.get("igst_paise") or 0):
        tax_rows += f"<tr><td colspan='7' class='r'>IGST</td><td class='r'>{paise_inr(int(tax['igst_paise']))}</td></tr>"
    elif int(tax.get("gst_paise") or snap.get("gst_paise") or 0):
        tax_rows += f"<tr><td colspan='7' class='r'>GST</td><td class='r'>{paise_inr(int(tax.get('gst_paise') or snap.get('gst_paise') or 0))}</td></tr>"
    disc = int(snap.get("discount_paise") or 0)
    disc_row = (
        f"<tr><td colspan='7' class='r'>Discount / coupon</td><td class='r'>-{paise_inr(disc)}</td></tr>" if disc else ""
    )
    signatory = " ".join(
        x for x in [company.get("signatory_name"), company.get("signatory_designation")] if x
    )
    legal = html.escape(str(company.get("legal_name") or company.get("name") or "BSeva"))
    duration = snap.get("duration_minutes")
    if duration is None:
        bid = inv.get("booking_id") or snap.get("booking_id")
        if bid:
            booking_row = db.execute(
                text(
                    """
                    SELECT s.duration_minutes
                    FROM bookings b
                    JOIN services s ON s.id = b.service_id
                    WHERE CAST(b.id AS text) = :id
                    """
                ),
                {"id": str(bid)},
            ).first()
            if booking_row and booking_row[0] is not None:
                duration = booking_row[0]
    duration_line = (
        f"<br/><strong>Puja Duration:</strong> {html.escape(format_duration_minutes(duration))}"
        if duration is not None
        else ""
    )
    extra_css = f"""
.muted {{ color: #555; line-height: 1.45; }}
.issuer {{ display: flex; justify-content: space-between; gap: 16px; }}
table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
th, td {{ border: 1px solid #d7dde8; padding: 6px 8px; text-align: left; }}
th {{ background: {NAVY}; color: #fff; font-weight: 600; font-size: 11px; }}
.r {{ text-align: right; white-space: nowrap; }}
.total td {{ font-weight: 700; background: #f7f8fb; }}
.grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 14px; }}
.box {{ border: 1px solid #d7dde8; padding: 10px 12px; }}
.box h3 {{ margin: 0 0 6px; font-size: 11px; letter-spacing: .08em; color: {ORANGE}; }}
.invoice-notes {{ margin-top: 18px; font-size: 11px; color: #444; }}
"""
    invoice_no = str(inv.get("invoice_number") or snap.get("invoice_number") or "")
    body = f"""
  <p class="noprint"><button onclick="window.print()">Print / Save PDF</button></p>
  <div class="issuer">
    <div class="muted">{legal}<br/>
      {html.escape(str(company.get('address') or ''))}<br/>
      {html.escape(str(company.get('state') or ''))} {html.escape(str(company.get('pincode') or ''))}<br/>
      Email: {html.escape(str(company.get('email') or ''))}
      {" | Phone: " + html.escape(company['phone']) if company.get('phone') else ""}<br/>
      Website: {html.escape(str(company.get('website') or ''))}<br/>
      {("GSTIN: " + html.escape(gstin) + "<br/>") if gstin else ""}
      {("PAN: " + html.escape(company.get('pan') or '') + "<br/>") if company.get('pan') else ""}
    </div>
    <div class="muted" style="text-align:right">
        <strong>Invoice No.</strong> {html.escape(invoice_no)}<br/>
        <strong>Invoice Date</strong> {html.escape(str(snap.get('invoice_date') or str(inv.get('created_at') or '')[:10]))}<br/>
        <strong>Booking ID</strong> {html.escape(str(snap.get('booking_number') or snap.get('booking_id') or ''))}<br/>
        <strong>Payment ID</strong> {html.escape(str(snap.get('payment_id') or '—'))}<br/>
        <strong>Payment Date</strong> {html.escape(str(snap.get('payment_date') or '')[:19])}<br/>
        <strong>Payment Method</strong> {html.escape(str(snap.get('payment_method') or '—'))}<br/>
        <strong>Status</strong> {html.escape(str(snap.get('payment_status') or inv.get('payment_status') or 'PAID'))}
    </div>
  </div>
  <div class="grid">
    <div class="box">
      <h3>BILL TO</h3>
      <div class="muted">
        <strong>{html.escape(str(bill.get('name') or 'Customer'))}</strong><br/>
        {html.escape(str(bill.get('address') or '—'))}<br/>
        {html.escape(" ".join(x for x in [bill.get('city'), bill.get('state'), bill.get('pincode')] if x))}<br/>
        {("Mobile: " + html.escape(bill.get('phone') or '') + "<br/>") if bill.get('phone') else ""}
        {("Email: " + html.escape(bill.get('email') or '') + "<br/>") if bill.get('email') else ""}
        {("GSTIN: " + html.escape(bill.get('gstin') or '')) if bill.get('gstin') else ""}
      </div>
    </div>
    <div class="box">
      <h3>SERVICE</h3>
      <div class="muted">
        {html.escape(str(snap.get('service_name') or 'Puja'))}<br/>
        Package: {html.escape(str(snap.get('package_type') or '—'))}<br/>
        Service date: {html.escape(str(snap.get('booking_date') or ''))}
        {html.escape(str(snap.get('start_time') or '')[:5])}
        {duration_line}
      </div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Description</th><th>HSN/SAC</th><th>Qty</th>
        <th class="r">Rate</th><th class="r">Taxable Amount</th><th class="r">GST</th><th class="r">Amount</th>
      </tr>
    </thead>
    <tbody>
      {''.join(rows)}
      <tr><td colspan="7" class="r">Subtotal</td><td class="r">{paise_inr(int(snap.get('subtotal_paise') or 0))}</td></tr>
      {disc_row}
      <tr><td colspan="7" class="r">Taxable Amount</td><td class="r">{paise_inr(int(snap.get('taxable_paise') or snap.get('subtotal_paise') or 0))}</td></tr>
      {tax_rows}
      <tr class="total"><td colspan="7" class="r">Grand Total</td><td class="r">{paise_inr(int(snap.get('total_paise') or inv.get('total_paise') or 0))}</td></tr>
    </tbody>
  </table>
  <p><strong>Total Invoice Amount in Words:</strong> {html.escape(str(snap.get('amount_in_words') or amount_in_words(inv.get('total_paise'))))}</p>
  <p><strong>Payment Status: {html.escape(str(snap.get('payment_status') or 'PAID'))}</strong></p>
  <div class="invoice-notes">
    <p>{html.escape(str(snap.get('notes') or company.get('notes') or 'Thank you for choosing BSeva.'))}</p>
    <p>This is a computer-generated invoice and does not require a physical signature.</p>
    {f"<p>For {legal}<br/>{html.escape(signatory)}</p>" if signatory else ""}
    <p><strong>Terms &amp; Conditions</strong><br/>{html.escape(str(snap.get('terms') or company.get('terms') or ''))}</p>
  </div>
"""
    return wrap_html_document(
        document_title=title,
        body_html=body,
        page_title=invoice_no or title,
        reference=invoice_no,
        company=company,
        extra_css=extra_css,
    )


def issue_paid_booking_invoice(db: Session, booking: dict) -> dict[str, Any]:
    """Create invoice (if needed) and email PDF. Never raises into the payment path."""
    out: dict[str, Any] = {"invoice_number": None, "emailed": False}
    try:
        _ensure_invoice_schema(db)
        number = create_customer_invoice(db, booking=booking, user_id=str(booking["customer_id"]))
        out["invoice_number"] = number
        db.commit()
    except Exception:
        logger.exception("invoice_issue_failed booking=%s", booking.get("id"))
        try:
            db.rollback()
        except Exception:
            pass
        return out
    if not out["invoice_number"]:
        return out
    try:
        emailed = email_customer_invoice(db, booking_id=str(booking["id"]))
        out["emailed"] = bool(emailed.get("ok"))
        db.commit()
    except Exception:
        logger.exception("invoice_email_failed booking=%s", booking.get("id"))
        try:
            db.rollback()
        except Exception:
            pass
    return out


def email_customer_invoice(db: Session, *, booking_id: str, to_email: str | None = None) -> dict[str, Any]:
    from app.mail.booking_payload import invoice_email_data_from_snapshot, load_customer_email_context, load_service_name
    from app.mail.senders import send_invoice_receipt_email

    inv = existing_customer_invoice(db, booking_id)
    if not inv:
        return {"ok": False, "error": "invoice_not_found"}
    booking = db.execute(
        text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"),
        {"id": booking_id},
    ).mappings().first()
    if not booking:
        return {"ok": False, "error": "booking_not_found"}
    ctx = load_customer_email_context(db, str(booking["customer_id"]))
    to = to_email or ctx.get("email") or ""
    snap = _parse_snap(inv)
    svc_name = str(
        snap.get("service_name")
        or load_service_name(db, str(booking["service_id"]), ctx.get("language") or "en")
    )
    pdf_bytes = None
    try:
        from app.invoice_pdf import render_invoice_pdf

        pdf_bytes = render_invoice_pdf(dict(inv))
    except Exception:
        logger.exception("invoice_pdf_failed %s", inv.get("invoice_number"))
    data = invoice_email_data_from_snapshot(
        customer_name=ctx.get("name") or "",
        invoice_number=str(inv["invoice_number"]),
        booking={**dict(booking), "service_name": svc_name},
        payment_method=str(snap.get("payment_method") or "Wallet"),
        transaction_id=str(snap.get("payment_id") or ""),
        payment_date=str(snap.get("payment_date") or ""),
        language=ctx.get("language") or "en",
    )
    filename = pdf_filename(str(inv["invoice_number"]))
    result = send_invoice_receipt_email(
        to=to,
        data=data,
        attachments=[(filename, pdf_bytes, "application/pdf")] if pdf_bytes else None,
    )
    status = "sent" if result.get("ok") and result.get("status") != "queued" else (result.get("status") or "failed")
    err = None if result.get("ok") else str(result.get("error") or result.get("status") or "failed")
    try:
        db.execute(
            text(
                """
                UPDATE invoices SET email_status = :st, email_error = :er, emailed_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"st": status, "er": err, "id": str(inv["id"])},
        )
    except Exception:
        db.rollback()
    if not result.get("ok"):
        logger.error("invoice_email_log invoice=%s error=%s", inv.get("invoice_number"), err)
    return result
