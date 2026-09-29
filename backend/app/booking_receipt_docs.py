"""Official BSeva booking confirmation receipts — HTML and PDF."""
from __future__ import annotations

import html
import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.document_brand import (
    render_document_footer,
    render_document_header,
    render_info_box,
    wrap_html_document,
)
from app.invoice_docs import company_snapshot, format_duration_minutes, paise_inr
from app.preparation import SECTION_CUSTOMER, SECTION_INCLUDED, get_booking_preparation

SAMAGRI_SECTION_LABELS = {
    SECTION_INCLUDED: "What BSeva / Pujari Will Bring",
    SECTION_CUSTOMER: "What Customer Needs to Arrange",
}


def receipt_pdf_filename(booking_number: str) -> str:
    safe = re.sub(r"[^A-Za-z0-9.-]+", "_", str(booking_number or "receipt")).strip("_")
    return f"BSeva_Receipt_{safe}.pdf"


def _load_booking_row(db: Session, booking_id: str) -> dict[str, Any] | None:
    row = None
    try:
        row = db.execute(
            text(
                """
                SELECT b.*, cu.name AS customer_name, cu.phone AS customer_phone, cu.email AS customer_email,
                       pu.name AS pujari_name, pu.phone AS pujari_phone, s.name AS service_name,
                       s.duration_minutes
                FROM bookings b
                JOIN users cu ON cu.id = b.customer_id
                LEFT JOIN users pu ON pu.id = b.pujari_id
                JOIN services s ON s.id = b.service_id
                WHERE b.id = CAST(:id AS uuid)
                """
            ),
            {"id": booking_id},
        ).mappings().first()
    except Exception:
        row = None
    if row:
        return dict(row)
    row = db.execute(
        text(
            """
            SELECT b.*, cu.name AS customer_name, cu.phone AS customer_phone, cu.email AS customer_email,
                   pu.name AS pujari_name, pu.phone AS pujari_phone, s.name AS service_name,
                   s.duration_minutes
            FROM bookings b
            JOIN users cu ON cu.id = b.customer_id
            LEFT JOIN users pu ON pu.id = b.pujari_id
            JOIN services s ON s.id = b.service_id
            WHERE b.booking_number = :num
            """
        ),
        {"num": booking_id},
    ).mappings().first()
    return dict(row) if row else None


def _item_label(item: dict[str, Any]) -> str:
    if item.get("label"):
        return str(item["label"])
    name = str(item.get("name") or "Item")
    qty = item.get("quantity")
    unit = item.get("unit")
    if qty is not None:
        return f"{name} — {qty}{f' {unit}' if unit else ''}"
    return name


def _payment_summary_rows(booking: dict[str, Any]) -> list[tuple[str, str]]:
    rows: list[tuple[str, str]] = [
        ("Payment Status", str(booking.get("payment_status") or "—").replace("_", " ").title()),
        ("Base Puja", paise_inr(int(booking.get("base_price_paise") or booking.get("main_puja_charge_paise") or 0))),
    ]
    for label, key in [
        ("Samagri Package", "samagri_charge_paise"),
        ("Alankaram", "alankaram_charge_paise"),
        ("Food / Prasadam", "food_charge_paise"),
        ("Weekend / Festival Surcharge", "peak_fee_paise"),
        ("Platform Fee", "platform_fee_paise"),
    ]:
        amt = int(booking.get(key) or 0)
        if amt:
            rows.append((label, paise_inr(amt)))
    gst = int(booking.get("gst_amount_paise") or 0)
    if gst:
        pct = booking.get("gst_percent")
        gst_label = f"GST ({pct}%)" if pct else "GST"
        rows.append((gst_label, paise_inr(gst)))
    disc = int(booking.get("discount_paise") or 0)
    if disc:
        rows.append(("Discount / Promo", f"-{paise_inr(disc)}"))
    rows.append(("Total", paise_inr(int(booking.get("total_paise") or 0))))
    return rows


def _samagri_sections_html(preparation: dict[str, Any] | None) -> str:
    if not preparation:
        return ""
    sections = preparation.get("sections") or {}
    blocks: list[str] = []
    for key in (SECTION_INCLUDED, SECTION_CUSTOMER):
        items = sections.get(key) or []
        if not items and key == SECTION_INCLUDED:
            items = preparation.get("provider_supplied") or []
        if not items and key == SECTION_CUSTOMER:
            items = preparation.get("customer_arranged") or []
        if not items:
            continue
        label = SAMAGRI_SECTION_LABELS.get(key, key.replace("_", " ").title())
        lis = "".join(f"<li>{html.escape(_item_label(it))}</li>" for it in items)
        blocks.append(
            f'<div class="bseva-doc-section"><h3>{html.escape(label)}</h3><ul class="bseva-doc-list">{lis}</ul></div>'
        )
    if not blocks and not preparation.get("verified"):
        pending = str(preparation.get("pending_message") or "Samagri checklist will be confirmed shortly.")
        blocks.append(f'<div class="bseva-doc-section"><p>{html.escape(pending)}</p></div>')
    return "".join(blocks)


def render_booking_receipt_html(db: Session, booking: dict[str, Any]) -> str:
    company = company_snapshot(db)
    booking_number = str(booking.get("booking_number") or booking.get("id") or "")
    preparation = get_booking_preparation(db, str(booking["id"]))
    try:
        from app.pujari_team import enrich_booking_pujari_team

        data = dict(booking)
        enrich_booking_pujari_team(data)
        team_note = str(data.get("pujari_team_customer_note") or "")
    except Exception:
        team_note = ""

    customer_lines = [
        f"<strong>{html.escape(str(booking.get('customer_name') or 'Customer'))}</strong>",
        html.escape(str(booking.get("address") or booking.get("location_label") or "—")),
    ]
    if booking.get("customer_phone"):
        customer_lines.append(f"Mobile: {html.escape(str(booking['customer_phone']))}")
    if booking.get("customer_email"):
        customer_lines.append(f"Email: {html.escape(str(booking['customer_email']))}")

    mode = str(booking.get("mode") or "").title() or "—"
    location = str(booking.get("location_label") or booking.get("address") or "—")
    if mode.lower() == "virtual":
        if booking.get("meeting_url"):
            location = f"Virtual — {booking.get('meeting_url')}"
        elif booking.get("public_invite_url"):
            location = f"Virtual — {booking.get('public_invite_url')}"
        else:
            location = str(booking.get("meeting_reveal_note") or "Virtual puja — meeting link shared before service")

    booking_lines = [
        html.escape(str(booking.get("service_name") or "Puja")),
        f"Package: {html.escape(str(booking.get('package_type') or '—').title())}",
        f"Booking ID: {html.escape(booking_number)}",
        f"Date: {html.escape(str(booking.get('booking_date') or ''))}",
        f"Time: {html.escape(str(booking.get('start_time') or '')[:5])}",
    ]
    duration = booking.get("duration_minutes")
    if duration is not None:
        booking_lines.append(f"Duration: {html.escape(format_duration_minutes(int(duration)))}")
    booking_lines.append(f"Mode: {html.escape(mode)}")
    booking_lines.append(f"Location / Virtual Details: {html.escape(location)}")
    if booking.get("pujari_name"):
        booking_lines.append(f"Assigned Pujari: {html.escape(str(booking['pujari_name']))}")
    if team_note:
        booking_lines.append(html.escape(team_note))

    status = str(booking.get("customer_display_status") or booking.get("status") or "pending").replace("_", " ").title()
    payment_rows = _payment_summary_rows(booking)
    payment_html = "".join(
        f"<div><strong>{html.escape(label)}:</strong> {html.escape(value)}</div>" for label, value in payment_rows
    )

    addons: list[str] = []
    if int(booking.get("samagri_charge_paise") or 0) > 0:
        addons.append("Samagri Package — Included")
    if int(booking.get("alankaram_charge_paise") or 0) > 0:
        addons.append("Alankaram — Included")
    if int(booking.get("food_charge_paise") or 0) > 0:
        addons.append("Food / Prasadam — Included")
    selections = (preparation or {}).get("selections") or (preparation or {}).get("selected_addons") or []
    for sel in selections:
        if isinstance(sel, dict) and sel.get("selected"):
            addons.append(str(sel.get("label") or sel.get("key") or "Add-on"))

    body = f"""
  <p class="noprint"><button onclick="window.print()">Print / Save PDF</button></p>
  {render_document_header(
      company=company,
      document_title="BOOKING RECEIPT",
      meta_rows=[
          ("Receipt / Booking ID", booking_number),
          ("Booking Date", str(booking.get("booking_date") or "")),
          ("Booking Status", status),
          ("Payment Status", str(booking.get("payment_status") or "—").replace("_", " ").title()),
      ],
  )}
  <div class="bseva-doc-grid">
    {render_info_box("CUSTOMER", "<br/>".join(x for x in customer_lines if x))}
    {render_info_box("BOOKING DETAILS", "<br/>".join(x for x in booking_lines if x))}
  </div>
  {f'<div class="bseva-doc-section"><h3>Alankaram / Add-ons</h3><ul class="bseva-doc-list">{"".join(f"<li>{html.escape(x)}</li>" for x in addons)}</ul></div>' if addons else ""}
  {_samagri_sections_html(preparation)}
  <div class="bseva-doc-payment">
    <h3>Payment Summary</h3>
    {payment_html}
  </div>
  {render_document_footer(company, disclaimer="This is a computer-generated booking receipt and does not require a physical signature.")}
"""
    return wrap_html_document(
        document_title="BOOKING RECEIPT",
        body_html=body,
        page_title=f"Receipt {booking_number}",
        reference=booking_number,
        company=company,
    )


def render_booking_receipt_pdf(booking: dict[str, Any], db: Session) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

    from app.document_brand import build_bseva_pdf
    from app.invoice_pdf import _pdf_header

    company = company_snapshot(db)
    booking_number = str(booking.get("booking_number") or booking.get("id") or "")
    preparation = get_booking_preparation(db, str(booking["id"]))
    styles = getSampleStyleSheet()
    section = ParagraphStyle("section", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, textColor=colors.Color(1.0, 0x7A / 255, 0x00 / 255))
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=8, leading=11)
    muted = ParagraphStyle("muted", parent=styles["Normal"], fontSize=8, leading=11, textColor=colors.Color(0.35, 0.35, 0.38))

    status = str(booking.get("customer_display_status") or booking.get("status") or "pending").replace("_", " ").title()
    story: list[Any] = []
    _pdf_header(
        story,
        company=company,
        title="BOOKING RECEIPT",
        meta=[
            ("Receipt / Booking ID", booking_number),
            ("Booking Date", str(booking.get("booking_date") or "")),
            ("Booking Status", status),
            ("Payment Status", str(booking.get("payment_status") or "—").replace("_", " ").title()),
        ],
    )

    customer_txt = "<br/>".join(
        x
        for x in [
            f"<b>{booking.get('customer_name') or 'Customer'}</b>",
            booking.get("address") or booking.get("location_label") or "—",
            f"Mobile: {booking['customer_phone']}" if booking.get("customer_phone") else "",
            f"Email: {booking['customer_email']}" if booking.get("customer_email") else "",
        ]
        if x
    )
    booking_txt = "<br/>".join(
        x
        for x in [
            str(booking.get("service_name") or "Puja"),
            f"Package: {str(booking.get('package_type') or '—').title()}",
            f"Booking ID: {booking_number}",
            f"Date: {booking.get('booking_date') or ''}",
            f"Time: {str(booking.get('start_time') or '')[:5]}",
            (
                f"Duration: {format_duration_minutes(int(booking['duration_minutes']))}"
                if booking.get("duration_minutes") is not None
                else ""
            ),
            f"Mode: {str(booking.get('mode') or '—').title()}",
            f"Location: {booking.get('location_label') or booking.get('address') or '—'}",
            f"Pujari: {booking['pujari_name']}" if booking.get("pujari_name") else "",
        ]
        if x
    )
    story.append(
        Table(
            [
                [Paragraph("CUSTOMER", section), Paragraph("BOOKING DETAILS", section)],
                [Paragraph(customer_txt, small), Paragraph(booking_txt, small)],
            ],
            colWidths=[89 * mm, 89 * mm],
            style=TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 0.4, colors.Color(0.84, 0.87, 0.91)),
                    ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.Color(0.84, 0.87, 0.91)),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ]
            ),
        )
    )
    story.append(Spacer(1, 8))

    if preparation:
        sections = preparation.get("sections") or {}
        for key in (SECTION_INCLUDED, SECTION_CUSTOMER):
            items = sections.get(key) or []
            if not items and key == SECTION_INCLUDED:
                items = preparation.get("provider_supplied") or []
            if not items and key == SECTION_CUSTOMER:
                items = preparation.get("customer_arranged") or []
            if not items:
                continue
            label = SAMAGRI_SECTION_LABELS.get(key, key)
            story.append(Paragraph(label, section))
            for it in items[:40]:
                story.append(Paragraph(f"• {_item_label(it)}", muted))
            story.append(Spacer(1, 4))

    story.append(Paragraph("Payment Summary", section))
    for label, value in _payment_summary_rows(booking):
        story.append(Paragraph(f"<b>{label}:</b> {value}", muted))
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            "This is a computer-generated booking receipt and does not require a physical signature.",
            muted,
        )
    )
    return build_bseva_pdf(
        story,
        document_title="BOOKING RECEIPT",
        company=company,
        title=f"Receipt {booking_number}",
        author=str(company.get("legal_name") or "BSeva"),
    )
