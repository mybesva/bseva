"""A4 PDF for issued BSeva invoices — snapshot only, no live settings."""
from __future__ import annotations

import json
from typing import Any

from app.document_brand import NAVY_RGB as NAVY
from app.document_brand import ORANGE_RGB as ORANGE
from app.document_brand import MOTTO, build_bseva_pdf, resolve_logo_file
from app.invoice_docs import format_duration_minutes, format_payment_date

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


def _pdf_header(story: list[Any], *, company: dict, title: str, meta: list[tuple[str, str]]) -> None:
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, Paragraph, Spacer, Table, TableStyle

    styles = getSampleStyleSheet()
    brand = ParagraphStyle("brand", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=14, textColor=colors.Color(*NAVY))
    motto = ParagraphStyle("motto", parent=styles["Normal"], fontSize=7, textColor=colors.Color(*ORANGE), leading=9)
    company_style = ParagraphStyle("co", parent=styles["Normal"], fontSize=8, textColor=colors.Color(*GRAY), leading=10)
    doc_title = ParagraphStyle("doctitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=12, alignment=2, textColor=colors.Color(*NAVY))
    meta_style = ParagraphStyle("meta", parent=styles["Normal"], fontSize=8, alignment=2, textColor=colors.Color(*GRAY), leading=10)

    left_cells: list[Any] = []
    logo_path = resolve_logo_file(company.get("logo_path"))
    if logo_path:
        left_cells.append(Image(str(logo_path), width=38 * mm, height=16 * mm))
    left_cells.append(Paragraph("B-SEVA", brand))
    left_cells.append(Paragraph(MOTTO, motto))
    left_cells.append(Paragraph(str(company.get("legal_name") or ""), company_style))
    left_cells.append(Paragraph(str(company.get("address") or "").replace("\n", "<br/>"), company_style))
    contact = " · ".join(
        x
        for x in [
            str(company.get("email") or ""),
            str(company.get("phone") or ""),
            str(company.get("website") or ""),
        ]
        if x
    )
    if contact:
        left_cells.append(Paragraph(contact, company_style))
    if company.get("gstin"):
        left_cells.append(Paragraph(f"GSTIN: {company.get('gstin')}", company_style))

    right_cells = [Paragraph(title.upper(), doc_title)]
    for label, value in meta:
        if value:
            right_cells.append(Paragraph(f"<b>{label}:</b> {value}", meta_style))

    header = Table([[left_cells, right_cells]], colWidths=[110 * mm, 68 * mm])
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBELOW", (0, 0), (-1, 0), 2.2, colors.Color(*ORANGE)),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(header)
    story.append(Spacer(1, 8))


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
    section = ParagraphStyle("section", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, textColor=colors.Color(*ORANGE))
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, leading=11, textColor=colors.Color(*NAVY))
    muted = ParagraphStyle("muted", parent=styles["Normal"], fontSize=8, leading=11, textColor=colors.Color(*GRAY))

    invoice_no = str(inv.get("invoice_number") or snap.get("invoice_number") or "")
    invoice_date = str(snap.get("invoice_date") or "")
    booking_ref = str(snap.get("booking_number") or snap.get("booking_id") or "")
    payment_status = str(snap.get("payment_status") or "PAID")

    story: list[Any] = []
    _pdf_header(
        story,
        company=company,
        title=title,
        meta=[
            ("Invoice No", invoice_no),
            ("Invoice Date", invoice_date),
            ("Booking ID", booking_ref),
            ("Payment Status", payment_status),
        ],
    )

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
    svc_parts = [
        str(snap.get("service_name") or "Puja"),
        f"Package: {str(snap.get('package_type') or '—').title()}",
        f"Booking ID: {booking_ref}",
        f"Service Date: {snap.get('booking_date') or ''}",
        f"Service Time: {str(snap.get('start_time') or '')[:5]}",
    ]
    if snap.get("duration_minutes") is not None:
        svc_parts.append(f"Duration: {format_duration_minutes(snap.get('duration_minutes'))}")
    svc_txt = "<br/>".join(svc_parts)

    story.append(
        Table(
            [
                [Paragraph("BILL TO", section), Paragraph("BOOKING DETAILS", section)],
                [Paragraph(bill_txt, small), Paragraph(svc_txt, small)],
            ],
            colWidths=[89 * mm, 89 * mm],
            style=TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.4, colors.Color(0.84, 0.87, 0.91)),
                    ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.Color(0.84, 0.87, 0.91)),
                    ("BACKGROUND", (0, 0), (-1, 0), colors.Color(0.98, 0.98, 0.99)),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ]
            ),
        )
    )
    story.append(Spacer(1, 8))

    data = [["#", "Description", "HSN/SAC", "Qty", "Rate", "Amount"]]
    for i, row in enumerate(lines, 1):
        data.append(
            [
                str(i),
                str(row.get("description") or row.get("label") or "")[:52],
                str(row.get("hsn_sac") or ""),
                str(int(row.get("qty") or 1)),
                _inr(int(row.get("rate_paise") or row.get("taxable_paise") or row.get("amount_paise") or 0)),
                _inr(int(row.get("amount_paise") or row.get("taxable_paise") or 0)),
            ]
        )
    tbl = Table(data, colWidths=[8 * mm, 68 * mm, 22 * mm, 10 * mm, 24 * mm, 24 * mm])
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.Color(*NAVY)),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7.5),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.Color(0.84, 0.87, 0.91)),
                ("ALIGN", (0, 1), (0, -1), "CENTER"),
                ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(tbl)
    story.append(Spacer(1, 6))

    totals: list[list[str]] = [["Subtotal", _inr(int(snap.get("subtotal_paise") or 0))]]
    if int(snap.get("discount_paise") or 0):
        totals.append(["Discount", "-" + _inr(int(snap["discount_paise"]))])
    if int(tax.get("cgst_paise") or 0):
        totals.append(["CGST", _inr(int(tax["cgst_paise"]))])
        totals.append(["SGST", _inr(int(tax["sgst_paise"]))])
    elif int(tax.get("igst_paise") or 0):
        totals.append(["IGST", _inr(int(tax["igst_paise"]))])
    elif int(tax.get("gst_paise") or 0):
        totals.append(["GST", _inr(int(tax["gst_paise"]))])
    total_paise = int(snap.get("total_paise") or inv.get("total_paise") or 0)
    totals.append(["TOTAL", _inr(total_paise)])

    totals_tbl = Table(
        [[Paragraph(f"<para alignment='right'>{label}</para>", muted), Paragraph(f"<para alignment='right'><b>{value}</b></para>", small)] for label, value in totals],
        colWidths=[44 * mm, 34 * mm],
        hAlign="RIGHT",
    )
    totals_tbl.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, -1), (-1, -1), 1.5, colors.Color(*ORANGE)),
                ("TOPPADDING", (0, -1), (-1, -1), 6),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ]
        )
    )
    story.append(totals_tbl)
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            f"<b>Total Invoice Amount in Words:</b> {snap.get('amount_in_words') or ''}",
            small,
        )
    )
    if payment_status.upper() == "PAID":
        story.append(Spacer(1, 4))
        story.append(Paragraph("<b>PAID</b>", section))
    story.append(Spacer(1, 6))
    story.append(Paragraph("<b>Payment Information</b>", section))
    story.append(
        Paragraph(
            "<br/>".join(
                [
                    f"<b>Payment Status:</b> {payment_status}",
                    f"<b>Payment Method:</b> {snap.get('payment_method') or '—'}",
                    f"<b>Transaction / Reference ID:</b> {snap.get('payment_id') or '—'}",
                    f"<b>Payment Date:</b> {format_payment_date(str(snap.get('payment_date') or ''))}",
                ]
            ),
            muted,
        )
    )
    story.append(Spacer(1, 6))
    story.append(Paragraph(str(snap.get("notes") or company.get("notes") or "Thank you for choosing BSeva."), muted))
    sig = " ".join(x for x in [company.get("signatory_name"), company.get("signatory_designation")] if x)
    if sig:
        story.append(Paragraph(f"For {company.get('legal_name') or 'BSeva'} — {sig}", small))
    story.append(Spacer(1, 4))
    story.append(Paragraph("<b>Terms &amp; Conditions</b>", small))
    story.append(Paragraph(str(snap.get("terms") or company.get("terms") or ""), muted))
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            "This is a computer-generated invoice and does not require a physical signature.",
            muted,
        )
    )
    return build_bseva_pdf(
        story,
        document_title=title,
        company=company,
        title=str(inv.get("invoice_number") or title),
        author=str(company.get("legal_name") or "BSeva"),
    )
