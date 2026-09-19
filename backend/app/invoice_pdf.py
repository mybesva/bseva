"""A4 PDF for issued BSeva invoices — snapshot only, no live settings."""
from __future__ import annotations

import json
from typing import Any

from app.document_brand import NAVY_RGB as NAVY
from app.document_brand import build_bseva_pdf
from app.invoice_docs import format_duration_minutes

GRAY = (0.35, 0.35, 0.38)


def _snap(inv: dict[str, Any]) -> dict[str, Any]:
    snap = inv.get("snapshot")
    if isinstance(snap, str):
        try:
            snap = json.loads(snap)
        except Exception:
            snap = {}
    return snap or {}


def _inr(paise: int | None) -> str:
    return f"Rs {(int(paise or 0) / 100):,.2f}"


def render_invoice_pdf(inv: dict[str, Any]) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

    snap = _snap(inv)
    company = snap.get("company") or {}
    bill = snap.get("bill_to") or {}
    lines = snap.get("lines") or []
    tax = snap.get("tax") or {}
    title = str(snap.get("title") or "INVOICE")
    styles = getSampleStyleSheet()
    legal = ParagraphStyle("legal", parent=styles["Normal"], textColor=colors.Color(*NAVY), fontSize=9, leading=12)
    muted = ParagraphStyle("muted", parent=styles["Normal"], textColor=colors.Color(*GRAY), fontSize=8, leading=11)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, leading=11, textColor=colors.Color(*NAVY))

    story: list[Any] = []
    left = [
        Paragraph(str(company.get("legal_name") or ""), legal),
        Paragraph(str(company.get("address") or "").replace("\n", "<br/>"), muted),
        Paragraph(
            f"Email: {company.get('email') or ''} &nbsp; Website: {company.get('website') or ''}",
            muted,
        ),
    ]
    if company.get("gstin"):
        left.append(Paragraph(f"GSTIN: {company.get('gstin')}", muted))
    if company.get("pan"):
        left.append(Paragraph(f"PAN: {company.get('pan')}", muted))
    meta = [
        Paragraph(f"Invoice No. {inv.get('invoice_number') or snap.get('invoice_number') or ''}", small),
        Paragraph(f"Invoice Date {snap.get('invoice_date') or ''}", small),
        Paragraph(f"Booking ID {snap.get('booking_number') or ''}", small),
        Paragraph(f"Payment ID {snap.get('payment_id') or '—'}", small),
        Paragraph(f"Payment Date {str(snap.get('payment_date') or '')[:19]}", small),
        Paragraph(f"Payment Method {snap.get('payment_method') or '—'}", small),
        Paragraph(f"<b>Payment Status: {snap.get('payment_status') or 'PAID'}</b>", small),
    ]
    header = Table([[left, meta]], colWidths=[110 * mm, 70 * mm])
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(header)
    story.append(Spacer(1, 8))
    bill_txt = "<br/>".join(
        x
        for x in [
            f"<b>{bill.get('name') or 'Customer'}</b>",
            bill.get("address") or "",
            " ".join(x for x in [bill.get("city"), bill.get("state"), bill.get("pincode")] if x),
            f"Mobile: {bill['phone']}" if bill.get("phone") else "",
            f"Email: {bill['email']}" if bill.get("email") else "",
            f"GSTIN: {bill['gstin']}" if bill.get("gstin") else "",
        ]
        if x
    )
    svc_txt = "<br/>".join(
        [
            str(snap.get("service_name") or "Puja"),
            f"Package: {snap.get('package_type') or '—'}",
            f"Service date: {snap.get('booking_date') or ''} {str(snap.get('start_time') or '')[:5]}",
            (
                f"<b>Puja Duration:</b> {format_duration_minutes(snap.get('duration_minutes'))}"
                if snap.get("duration_minutes") is not None
                else ""
            ),
        ]
    )
    story.append(
        Table(
            [
                [Paragraph("<b>BILL TO</b>", legal), Paragraph("<b>SERVICE</b>", legal)],
                [Paragraph(bill_txt, small), Paragraph(svc_txt, small)],
            ],
            colWidths=[90 * mm, 90 * mm],
        )
    )
    story.append(Spacer(1, 8))

    data = [["#", "Description", "HSN/SAC", "Qty", "Rate", "Taxable", "GST", "Amount"]]
    for i, row in enumerate(lines, 1):
        data.append(
            [
                str(i),
                str(row.get("description") or row.get("label") or "")[:48],
                str(row.get("hsn_sac") or ""),
                str(int(row.get("qty") or 1)),
                _inr(int(row.get("rate_paise") or row.get("amount_paise") or 0)),
                _inr(int(row.get("taxable_paise") or row.get("amount_paise") or 0)),
                _inr(int(row.get("gst_paise") or 0)),
                _inr(int(row.get("amount_paise") or 0)),
            ]
        )
    summaries = [
        ["", "", "", "", "", "", "Subtotal", _inr(int(snap.get("subtotal_paise") or 0))],
    ]
    if int(snap.get("discount_paise") or 0):
        summaries.append(["", "", "", "", "", "", "Discount", "-" + _inr(int(snap["discount_paise"]))])
    summaries.append(["", "", "", "", "", "", "Taxable", _inr(int(snap.get("taxable_paise") or snap.get("subtotal_paise") or 0))])
    if int(tax.get("cgst_paise") or 0):
        summaries.append(["", "", "", "", "", "", "CGST", _inr(int(tax["cgst_paise"]))])
        summaries.append(["", "", "", "", "", "", "SGST", _inr(int(tax["sgst_paise"]))])
    elif int(tax.get("igst_paise") or 0):
        summaries.append(["", "", "", "", "", "", "IGST", _inr(int(tax["igst_paise"]))])
    elif int(tax.get("gst_paise") or 0):
        summaries.append(["", "", "", "", "", "", "GST", _inr(int(tax["gst_paise"]))])
    summaries.append(["", "", "", "", "", "", "Grand Total", _inr(int(snap.get("total_paise") or inv.get("total_paise") or 0))])
    data.extend(summaries)
    tbl = Table(data, colWidths=[10 * mm, 52 * mm, 22 * mm, 12 * mm, 22 * mm, 24 * mm, 18 * mm, 22 * mm])
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.Color(*NAVY)),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 7.5),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.Color(0.84, 0.87, 0.91)),
        ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("FONTNAME", (6, -1), (-1, -1), "Helvetica-Bold"),
    ]
    tbl.setStyle(TableStyle(style_cmds))
    story.append(tbl)
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            f"<b>Total Invoice Amount in Words:</b> {snap.get('amount_in_words') or ''}",
            small,
        )
    )
    story.append(Paragraph(f"<b>Payment Status: {snap.get('payment_status') or 'PAID'}</b>", small))
    story.append(Spacer(1, 6))
    story.append(Paragraph(str(snap.get("notes") or company.get("notes") or "Thank you for choosing BSeva."), muted))
    story.append(Paragraph("This is a computer-generated invoice and does not require a physical signature.", muted))
    sig = " ".join(x for x in [company.get("signatory_name"), company.get("signatory_designation")] if x)
    if sig:
        story.append(Paragraph(f"For {company.get('legal_name') or 'BSeva'} — {sig}", small))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Terms &amp; Conditions</b>", small))
    story.append(Paragraph(str(snap.get("terms") or company.get("terms") or ""), muted))
    return build_bseva_pdf(
        story,
        document_title=title,
        company=company,
        title=str(inv.get("invoice_number") or title),
        author=str(company.get("legal_name") or "BSeva"),
    )
