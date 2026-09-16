"""Reusable BSeva email template builders (HTML + plain text)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.mail.brand import (
    booking_url,
    detail_rows,
    format_inr_paise,
    heading,
    muted,
    otp_box,
    paragraph,
    render_email,
)
from app.i18n import email_closing, email_greet, email_label, normalize_lang


@dataclass
class EmailContent:
    subject: str
    html: str
    text: str
    template_id: str


@dataclass
class BookingEmailData:
    customer_name: str = "Customer"
    booking_id: str = ""
    booking_number: str = ""
    service_name: str = "Puja"
    booking_date: str = ""
    start_time: str = ""
    muhurtham: str = ""
    location: str = ""
    package: str = ""
    main_puja_paise: int = 0
    samagri_paise: int = 0
    alankaram_paise: int = 0
    food_prasadam_paise: int = 0
    total_paise: int = 0
    payment_status: str = ""
    booking_status: str = ""
    language: str = "en"
    extra_rows: list[tuple[str, str]] = field(default_factory=list)
    test_mode: bool = False


@dataclass
class InvoiceEmailData:
    customer_name: str = "Customer"
    invoice_number: str = ""
    booking_id: str = ""
    booking_number: str = ""
    service_name: str = "Puja"
    booking_date: str = ""
    payment_date: str = ""
    payment_method: str = ""
    transaction_id: str = ""
    lines: list[tuple[str, int]] = field(default_factory=list)
    tax_paise: int = 0
    total_paid_paise: int = 0
    payment_status: str = "paid"
    language: str = "en"
    test_mode: bool = False


def _greet(name: str, language: str) -> str:
    return email_greet(name, language)


def _closing(language: str) -> str:
    return email_closing(language)


def _booking_detail_rows(data: BookingEmailData) -> list[tuple[str, str]]:
    lang = normalize_lang(data.language)
    L = lambda key: email_label(key, lang)
    rows = [
        (L("customer"), data.customer_name),
        (L("bookingId"), data.booking_number or data.booking_id),
        (L("service"), data.service_name),
        (L("date"), data.booking_date),
        (L("timeMuhurtham"), data.muhurtham or data.start_time),
        (L("location"), data.location or "—"),
        (L("package"), data.package or "—"),
        (L("mainPuja"), format_inr_paise(data.main_puja_paise)),
        (L("samagri"), format_inr_paise(data.samagri_paise)),
        (L("alankaram"), format_inr_paise(data.alankaram_paise)),
        (L("food"), format_inr_paise(data.food_prasadam_paise)),
        (L("total"), format_inr_paise(data.total_paise)),
        (L("paymentStatus"), data.payment_status or "—"),
        (L("bookingStatus"), data.booking_status or "—"),
    ]
    rows.extend(data.extra_rows)
    return [(k, v) for k, v in rows if v not in (None, "")]


def _booking_text(data: BookingEmailData, intro: str) -> str:
    lines = [
        _greet(data.customer_name, data.language),
        "",
        intro,
        "",
    ]
    for label, value in _booking_detail_rows(data):
        lines.append(f"{label}: {value}")
    if data.booking_id:
        lines.extend(["", f"View booking: {booking_url(data.booking_id)}"])
    lines.extend(["", _closing(data.language)])
    if data.test_mode:
        lines.insert(0, "[TEST EMAIL — Not a real booking or payment]\n")
    return "\n".join(lines)


def login_otp_email(
    *,
    otp_code: str,
    customer_name: str = "",
    language: str = "en",
    test_mode: bool = False,
    purpose: str = "login",
) -> EmailContent:
    is_register = purpose == "register"
    title = "BSeva Registration OTP" if is_register else "BSeva Login Verification"
    subject = title + (" [TEST]" if test_mode else "")
    action = (
        "Use this one-time password to complete your BSeva registration."
        if is_register
        else "Use this one-time password to sign in to your BSeva account."
    )
    body = (
        heading(title)
        + paragraph(_greet(customer_name or "Ji", language))
        + paragraph(action)
        + otp_box(otp_code)
        + muted("Valid for: 10 minutes")
        + muted("Do not share this OTP with anyone. BSeva will never ask for your OTP.")
    )
    html = render_email(
        title=subject,
        preheader=f"Your BSeva OTP — valid for 10 minutes",
        body_html=body,
        language=language,
        test_banner=test_mode,
    )
    text = (
        f"{'[TEST]\\n' if test_mode else ''}"
        f"{title}\n\n"
        f"{_greet(customer_name or 'Ji', language)}\n\n"
        f"Your OTP: {otp_code}\n"
        f"Valid for: 10 minutes\n\n"
        f"Do not share this OTP with anyone.\n\n"
        f"{_closing(language)}"
    )
    return EmailContent(subject=subject, html=html, text=text, template_id="login_otp")


def welcome_email(*, customer_name: str, language: str = "en", test_mode: bool = False) -> EmailContent:
    from app.mail.smtp_config import app_base_url

    subject = "Welcome to BSeva" + (" [TEST]" if test_mode else "")
    services_url = f"{app_base_url()}/services"
    body = (
        heading("Welcome to BSeva")
        + paragraph(_greet(customer_name, language))
        + paragraph(
            "Thank you for joining BSeva. Book verified pujaris for authentic pujas, "
            "homams, and spiritual services with transparent pricing."
        )
        + muted("You can manage bookings, wallet, and preferences from your dashboard.")
    )
    html = render_email(
        title=subject,
        preheader="Welcome to BSeva",
        body_html=body,
        cta_label="Explore services",
        cta_url=services_url,
        language=language,
        test_banner=test_mode,
    )
    text = (
        f"{'[TEST]\\n' if test_mode else ''}"
        f"{_greet(customer_name, language)}\n\n"
        f"Welcome to BSeva. Explore services: {services_url}\n\n"
        f"{_closing(language)}"
    )
    return EmailContent(subject=subject, html=html, text=text, template_id="welcome")


def booking_confirmation_email(data: BookingEmailData) -> EmailContent:
    subject = f"BSeva — Booking confirmation ({data.booking_number or data.booking_id})" + (
        " [TEST]" if data.test_mode else ""
    )
    body = (
        heading("Booking Confirmation")
        + paragraph(_greet(data.customer_name, data.language))
        + paragraph("Your BSeva puja booking is confirmed. Here are the details:")
        + detail_rows(_booking_detail_rows(data))
    )
    html = render_email(
        title=subject,
        preheader=f"Booking {data.booking_number} confirmed",
        body_html=body,
        cta_label="View Booking",
        cta_url=booking_url(data.booking_id) if data.booking_id else None,
        language=data.language,
        test_banner=data.test_mode,
    )
    return EmailContent(
        subject=subject,
        html=html,
        text=_booking_text(data, "Your BSeva puja booking is confirmed."),
        template_id="booking_confirmation",
    )


def booking_reminder_email(data: BookingEmailData, *, hours_ahead: int = 24) -> EmailContent:
    subject = f"BSeva — Booking reminder ({data.booking_number or data.booking_id})" + (
        " [TEST]" if data.test_mode else ""
    )
    intro = f"This is a reminder that your puja is coming up in about {hours_ahead} hours."
    body = (
        heading("Booking Reminder")
        + paragraph(_greet(data.customer_name, data.language))
        + paragraph(intro)
        + detail_rows(_booking_detail_rows(data))
    )
    html = render_email(
        title=subject,
        preheader=intro,
        body_html=body,
        cta_label="View Booking",
        cta_url=booking_url(data.booking_id) if data.booking_id else None,
        language=data.language,
        test_banner=data.test_mode,
    )
    return EmailContent(
        subject=subject,
        html=html,
        text=_booking_text(data, intro),
        template_id="booking_reminder",
    )


def pujari_assigned_email(
    data: BookingEmailData,
    *,
    pujari_name: str = "",
    recipient: str = "customer",
) -> EmailContent:
    subject = f"BSeva — Pujari assigned ({data.booking_number or data.booking_id})" + (
        " [TEST]" if data.test_mode else ""
    )
    if recipient == "pujari":
        intro = "A new booking has been assigned to you. Please review and accept."
        title = "New Booking Assignment"
    else:
        intro = f"Pujari {pujari_name or 'has been'} assigned to your booking." if pujari_name else "A pujari has been assigned to your booking."
        title = "Pujari Assigned"
    rows = _booking_detail_rows(data)
    if pujari_name:
        rows.insert(2, ("Pujari", pujari_name))
    body = (
        heading(title)
        + paragraph(_greet(data.customer_name, data.language))
        + paragraph(intro)
        + detail_rows(rows)
    )
    html = render_email(
        title=subject,
        preheader=intro,
        body_html=body,
        cta_label="View Booking",
        cta_url=booking_url(data.booking_id) if data.booking_id else None,
        language=data.language,
        test_banner=data.test_mode,
    )
    return EmailContent(
        subject=subject,
        html=html,
        text=_booking_text(data, intro),
        template_id="pujari_assigned",
    )


def payment_confirmation_email(data: BookingEmailData, *, transaction_id: str = "", method: str = "") -> EmailContent:
    subject = f"BSeva — Payment confirmation ({data.booking_number or data.booking_id})" + (
        " [TEST]" if data.test_mode else ""
    )
    extra = list(data.extra_rows)
    if method:
        extra.append(("Payment method", method))
    if transaction_id:
        extra.append(("Transaction / reference", transaction_id))
    payload = BookingEmailData(**{**data.__dict__, "extra_rows": extra})
    body = (
        heading("Payment Confirmation")
        + paragraph(_greet(data.customer_name, data.language))
        + paragraph("We have received your payment for the following booking.")
        + detail_rows(_booking_detail_rows(payload))
    )
    html = render_email(
        title=subject,
        preheader="Payment received",
        body_html=body,
        cta_label="View Booking",
        cta_url=booking_url(data.booking_id) if data.booking_id else None,
        language=data.language,
        test_banner=data.test_mode,
    )
    return EmailContent(
        subject=subject,
        html=html,
        text=_booking_text(payload, "We have received your payment."),
        template_id="payment_confirmation",
    )


def invoice_receipt_email(data: InvoiceEmailData) -> EmailContent:
    subject = f"Your BSeva Invoice – {data.invoice_number}" + (" [TEST]" if data.test_mode else "")
    line_rows = [(label, format_inr_paise(amt)) for label, amt in data.lines]
    if data.tax_paise:
        line_rows.append(("Taxes / GST", format_inr_paise(data.tax_paise)))
    line_rows.extend(
        [
            ("Total paid", format_inr_paise(data.total_paid_paise)),
            ("Payment status", data.payment_status),
            ("Invoice number", data.invoice_number),
            ("Booking ID", data.booking_number or data.booking_id),
            ("Customer", data.customer_name),
            ("Service", data.service_name),
            ("Booking date", data.booking_date),
            ("Payment date", data.payment_date),
            ("Payment method", data.payment_method or "—"),
            ("Transaction / reference", data.transaction_id or "—"),
        ]
    )
    body = (
        heading("Your BSeva Invoice")
        + paragraph(_greet(data.customer_name, data.language))
        + paragraph(
            f"Thank you for choosing BSeva, {data.customer_name or 'Ji'}. "
            f"Payment for {data.service_name} is confirmed (booking {data.booking_number or data.booking_id}). "
            f"Official invoice {data.invoice_number} for {format_inr_paise(data.total_paid_paise)} is attached as a PDF."
        )
        + detail_rows(line_rows)
    )
    html = render_email(
        title=subject,
        preheader=f"Invoice {data.invoice_number}",
        body_html=body,
        cta_label="View Booking" if data.booking_id else None,
        cta_url=booking_url(data.booking_id) if data.booking_id else None,
        language=data.language,
        test_banner=data.test_mode,
    )
    text_lines = [
        "[TEST]" if data.test_mode else "",
        _greet(data.customer_name, data.language),
        "",
        "Invoice",
        f"Invoice: {data.invoice_number}",
        f"Booking: {data.booking_number or data.booking_id}",
        f"Service: {data.service_name}",
        f"Amount paid: {format_inr_paise(data.total_paid_paise)}",
        f"Service date: {data.booking_date}",
        "",
        "Thank you for choosing BSeva.",
        "",
        _closing(data.language),
    ]
    return EmailContent(
        subject=subject,
        html=html,
        text="\n".join([l for l in text_lines if l is not None]),
        template_id="invoice_receipt",
    )


def booking_cancellation_email(data: BookingEmailData, *, reason: str = "") -> EmailContent:
    subject = f"BSeva — Booking cancelled ({data.booking_number or data.booking_id})" + (
        " [TEST]" if data.test_mode else ""
    )
    extra = list(data.extra_rows)
    if reason:
        extra.append(("Reason", reason))
    payload = BookingEmailData(**{**data.__dict__, "extra_rows": extra, "booking_status": data.booking_status or "cancelled"})
    body = (
        heading("Booking Cancelled")
        + paragraph(_greet(data.customer_name, data.language))
        + paragraph("Your booking has been cancelled.")
        + detail_rows(_booking_detail_rows(payload))
    )
    html = render_email(
        title=subject,
        preheader="Booking cancelled",
        body_html=body,
        cta_label="View Booking",
        cta_url=booking_url(data.booking_id) if data.booking_id else None,
        language=data.language,
        test_banner=data.test_mode,
    )
    return EmailContent(
        subject=subject,
        html=html,
        text=_booking_text(payload, "Your booking has been cancelled."),
        template_id="booking_cancellation",
    )


def refund_confirmation_email(
    data: BookingEmailData,
    *,
    refund_paise: int = 0,
    refund_method: str = "Wallet credit",
) -> EmailContent:
    subject = f"BSeva — Refund confirmation ({data.booking_number or data.booking_id})" + (
        " [TEST]" if data.test_mode else ""
    )
    extra = list(data.extra_rows) + [
        ("Refund amount", format_inr_paise(refund_paise)),
        ("Refund method", refund_method),
    ]
    payload = BookingEmailData(**{**data.__dict__, "extra_rows": extra})
    body = (
        heading("Refund Confirmation")
        + paragraph(_greet(data.customer_name, data.language))
        + paragraph("Your refund has been processed.")
        + detail_rows(_booking_detail_rows(payload))
    )
    html = render_email(
        title=subject,
        preheader="Refund processed",
        body_html=body,
        cta_label="View Booking",
        cta_url=booking_url(data.booking_id) if data.booking_id else None,
        language=data.language,
        test_banner=data.test_mode,
    )
    return EmailContent(
        subject=subject,
        html=html,
        text=_booking_text(payload, "Your refund has been processed."),
        template_id="refund_confirmation",
    )


def booking_rescheduled_email(
    data: BookingEmailData,
    *,
    previous_date: str = "",
    previous_time: str = "",
) -> EmailContent:
    subject = f"BSeva — Booking updated ({data.booking_number or data.booking_id})" + (
        " [TEST]" if data.test_mode else ""
    )
    extra = list(data.extra_rows)
    if previous_date or previous_time:
        extra.append(("Previous schedule", f"{previous_date} {previous_time}".strip()))
    payload = BookingEmailData(**{**data.__dict__, "extra_rows": extra})
    body = (
        heading("Booking Rescheduled / Updated")
        + paragraph(_greet(data.customer_name, data.language))
        + paragraph("Your booking schedule has been updated. Please review the new details.")
        + detail_rows(_booking_detail_rows(payload))
    )
    html = render_email(
        title=subject,
        preheader="Booking schedule updated",
        body_html=body,
        cta_label="View Booking",
        cta_url=booking_url(data.booking_id) if data.booking_id else None,
        language=data.language,
        test_banner=data.test_mode,
    )
    return EmailContent(
        subject=subject,
        html=html,
        text=_booking_text(payload, "Your booking schedule has been updated."),
        template_id="booking_rescheduled",
    )


def admin_notification_email(
    *,
    title: str,
    message: str,
    details: list[tuple[str, str]] | None = None,
    cta_label: str | None = None,
    cta_url: str | None = None,
    test_mode: bool = False,
) -> EmailContent:
    subject = f"BSeva Admin — {title}" + (" [TEST]" if test_mode else "")
    body = heading(title) + paragraph(message)
    if details:
        body += detail_rows(details)
    html = render_email(
        title=subject,
        preheader=title,
        body_html=body,
        cta_label=cta_label,
        cta_url=cta_url,
        language="en",
        test_banner=test_mode,
    )
    text = f"{'[TEST]\\n' if test_mode else ''}{title}\n\n{message}\n"
    if details:
        text += "\n".join(f"{k}: {v}" for k, v in details) + "\n"
    text += f"\n{_closing('en')}"
    return EmailContent(subject=subject, html=html, text=text, template_id="admin_notification")


def sample_booking_data(*, test_mode: bool = True) -> BookingEmailData:
    return BookingEmailData(
        customer_name="Ananya Sharma",
        booking_id="00000000-0000-4000-8000-000000000001",
        booking_number="BS-TEST-1001",
        service_name="Satyanarayan Puja",
        booking_date="2026-09-20",
        start_time="09:30",
        muhurtham="09:30 AM (Shubh Muhurtham)",
        location="123 Spiritual Avenue, Bangalore, Karnataka 560001",
        package="Standard",
        main_puja_paise=250000,
        samagri_paise=45000,
        alankaram_paise=30000,
        food_prasadam_paise=20000,
        total_paise=345000,
        payment_status="paid",
        booking_status="confirmed",
        language="en",
        test_mode=test_mode,
    )


def sample_invoice_data(*, test_mode: bool = True) -> InvoiceEmailData:
    b = sample_booking_data(test_mode=test_mode)
    return InvoiceEmailData(
        customer_name=b.customer_name,
        invoice_number="INV-C-TEST-1001",
        booking_id=b.booking_id,
        booking_number=b.booking_number,
        service_name=b.service_name,
        booking_date=b.booking_date,
        payment_date="2026-09-12",
        payment_method="Wallet",
        transaction_id="TXN-TEST-998877",
        lines=[
            ("Main puja", b.main_puja_paise),
            ("Samagri", b.samagri_paise),
            ("Alankaram", b.alankaram_paise),
            ("Food / Prasadam", b.food_prasadam_paise),
        ],
        tax_paise=0,
        total_paid_paise=b.total_paise,
        payment_status="paid",
        language="en",
        test_mode=test_mode,
    )
