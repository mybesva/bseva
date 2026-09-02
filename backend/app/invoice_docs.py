"""Invoice HTML rendering with configurable legal placeholders."""
from __future__ import annotations

import html
import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.platform_config import get_setting


def company_block(db: Session) -> dict[str, str]:
    return {
        "name": str(get_setting(db, "invoice_company_name", "BSeva")),
        "gstin": str(get_setting(db, "invoice_gstin", "") or "GSTIN PENDING"),
        "address": str(get_setting(db, "invoice_company_address", "Address pending — configure in Admin Settings")),
        "prefix_customer": str(get_setting(db, "invoice_prefix_customer", "INV-C")),
        "prefix_settlement": str(get_setting(db, "invoice_prefix_settlement", "INV-S")),
        "from_email": str(get_setting(db, "email_from_accounts", "accounts@b-seva.com")),
    }


def paise_inr(paise: int | None) -> str:
    v = (paise or 0) / 100.0
    return f"₹{v:,.2f}"


def render_invoice_html(db: Session, inv: dict[str, Any]) -> str:
    company = company_block(db)
    snap = inv.get("snapshot")
    if isinstance(snap, str):
        try:
            snap = json.loads(snap)
        except Exception:
            snap = {}
    snap = snap or {}
    lines = snap.get("lines") or []
    if not lines:
        lines = [
            {"label": "Base / service", "amount_paise": snap.get("base_paise") or snap.get("base_puja_paise") or 0},
            {"label": "Platform fee", "amount_paise": snap.get("platform_fee_paise") or 0},
            {"label": "GST", "amount_paise": snap.get("gst_paise") or snap.get("gst_amount_paise") or 0},
        ]
    rows = "".join(
        f"<tr><td>{html.escape(str(r.get('label') or ''))}</td>"
        f"<td style='text-align:right'>{paise_inr(int(r.get('amount_paise') or 0))}</td></tr>"
        for r in lines
        if int(r.get("amount_paise") or 0) or r.get("label")
    )
    title = "Tax Invoice" if inv.get("invoice_type") == "customer" else "Settlement Statement"
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>{html.escape(str(inv.get('invoice_number')))}</title>
<style>
body{{font-family:Georgia,serif;color:#1A2B4A;margin:2rem;}}
h1{{font-size:1.4rem;margin:0 0 .25rem}}
.meta{{color:#555;font-size:.9rem;margin-bottom:1.5rem}}
table{{width:100%;border-collapse:collapse;margin-top:1rem}}
td,th{{border-bottom:1px solid #ddd;padding:.5rem;text-align:left}}
.total{{font-weight:bold;font-size:1.1rem}}
.badge{{display:inline-block;background:#FF9933;color:#fff;padding:.15rem .5rem;border-radius:4px;font-size:.75rem}}
@media print{{button{{display:none}}}}
</style></head><body>
<button onclick="window.print()">Print / Save PDF</button>
<h1>{html.escape(company['name'])}</h1>
<div class="meta">
{html.escape(company['address'])}<br/>
GSTIN: {html.escape(company['gstin'])}<br/>
From: {html.escape(company['from_email'])}
</div>
<span class="badge">{html.escape(title)}</span>
<p><strong>Invoice:</strong> {html.escape(str(inv.get('invoice_number')))}<br/>
<strong>Type:</strong> {html.escape(str(inv.get('invoice_type')))}<br/>
<strong>Date:</strong> {html.escape(str(inv.get('created_at') or ''))}<br/>
<strong>Booking:</strong> {html.escape(str(snap.get('booking_number') or inv.get('booking_id') or ''))}
</p>
<table>
<thead><tr><th>Description</th><th style="text-align:right">Amount</th></tr></thead>
<tbody>
{rows}
<tr class="total"><td>Total</td><td style="text-align:right">{paise_inr(int(inv.get('total_paise') or 0))}</td></tr>
</tbody>
</table>
<p class="meta">This document is a financial snapshot of the booking at the time of issue. Historical amounts do not change when pricing rules are edited later.</p>
</body></html>"""


def create_customer_invoice(db: Session, *, booking: dict, user_id: str) -> str | None:
    import json
    from datetime import datetime

    company = company_block(db)
    prefix = company["prefix_customer"]
    bid = str(booking["id"])
    inv_no = f"{prefix}-{datetime.utcnow().strftime('%y%m%d')}-{bid[:8].upper()}"
    base = int(booking.get("base_price_paise") or 0)
    peak = int(booking.get("peak_fee_paise") or 0)
    plat = int(booking.get("platform_fee_paise") or 0)
    gst = int(booking.get("gst_amount_paise") or 0)
    total = int(booking.get("total_paise") or 0)
    snap = {
        "booking_number": booking.get("booking_number"),
        "base_paise": base,
        "peak_fee_paise": peak,
        "platform_fee_paise": plat,
        "gst_paise": gst,
        "total_paise": total,
        "company": company,
        "from": company["from_email"],
        "lines": [
            {"label": "Puja / service base", "amount_paise": base},
            {"label": "Location / surge", "amount_paise": peak},
            {"label": "Platform fee", "amount_paise": plat},
            {"label": "GST", "amount_paise": gst},
        ],
    }
    db.execute(
        text(
            """
            INSERT INTO invoices (invoice_number, invoice_type, booking_id, user_id, snapshot, total_paise)
            VALUES (:n, 'customer', CAST(:bid AS uuid), CAST(:uid AS uuid), CAST(:s AS jsonb), :t)
            ON CONFLICT (invoice_number) DO NOTHING
            """
        ),
        {"n": inv_no, "bid": bid, "uid": user_id, "s": json.dumps(snap), "t": total},
    )
    return inv_no


def create_settlement_invoice(db: Session, *, booking: dict, settlement: dict) -> str | None:
    import json
    from datetime import datetime

    company = company_block(db)
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
            {"label": "Base puja (pujari share basis)", "amount_paise": int(settlement.get("base_puja_paise") or 0)},
            {"label": "Platform fee (deducted)", "amount_paise": -int(settlement.get("platform_fee_paise") or 0)},
            {"label": "Settlement payable", "amount_paise": payable},
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
