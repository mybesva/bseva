"""High-level branded email senders."""
from __future__ import annotations

from typing import Any

from app.mail.smtp_client import send_email
from app.mail.templates import (
    BookingEmailData,
    InvoiceEmailData,
    admin_notification_email,
    booking_cancellation_email,
    booking_confirmation_email,
    booking_reminder_email,
    booking_rescheduled_email,
    invoice_receipt_email,
    login_otp_email,
    payment_confirmation_email,
    pujari_assigned_email,
    refund_confirmation_email,
    welcome_email,
)


def _dispatch(to: str, content, *, from_addr: str | None = None) -> dict[str, Any]:
    result = send_email(
        to=to,
        subject=content.subject,
        text_body=content.text,
        html_body=content.html,
        from_addr=from_addr,
    )
    result["template_id"] = content.template_id
    return result


def send_login_otp_email(
    *,
    to: str,
    otp_code: str,
    customer_name: str = "",
    language: str = "en",
    test_mode: bool = False,
    purpose: str = "login",
    from_addr: str | None = None,
) -> dict[str, Any]:
    return _dispatch(
        to,
        login_otp_email(
            otp_code=otp_code,
            customer_name=customer_name,
            language=language,
            test_mode=test_mode,
            purpose=purpose,
        ),
        from_addr=from_addr,
    )


def send_welcome_email(
    *,
    to: str,
    customer_name: str,
    language: str = "en",
    test_mode: bool = False,
    from_addr: str | None = None,
) -> dict[str, Any]:
    return _dispatch(
        to,
        welcome_email(customer_name=customer_name, language=language, test_mode=test_mode),
        from_addr=from_addr,
    )


def send_booking_confirmation_email(
    *, to: str, data: BookingEmailData, from_addr: str | None = None
) -> dict[str, Any]:
    return _dispatch(to, booking_confirmation_email(data), from_addr=from_addr)


def send_booking_reminder_email(
    *, to: str, data: BookingEmailData, hours_ahead: int = 24, from_addr: str | None = None
) -> dict[str, Any]:
    return _dispatch(to, booking_reminder_email(data, hours_ahead=hours_ahead), from_addr=from_addr)


def send_pujari_assigned_email(
    *,
    to: str,
    data: BookingEmailData,
    pujari_name: str = "",
    recipient: str = "customer",
    from_addr: str | None = None,
) -> dict[str, Any]:
    return _dispatch(
        to,
        pujari_assigned_email(data, pujari_name=pujari_name, recipient=recipient),
        from_addr=from_addr,
    )


def send_payment_confirmation_email(
    *,
    to: str,
    data: BookingEmailData,
    transaction_id: str = "",
    method: str = "",
    from_addr: str | None = None,
) -> dict[str, Any]:
    return _dispatch(
        to,
        payment_confirmation_email(data, transaction_id=transaction_id, method=method),
        from_addr=from_addr,
    )


def send_invoice_receipt_email(
    *, to: str, data: InvoiceEmailData, from_addr: str | None = None
) -> dict[str, Any]:
    return _dispatch(to, invoice_receipt_email(data), from_addr=from_addr)


def send_booking_cancellation_email(
    *, to: str, data: BookingEmailData, reason: str = "", from_addr: str | None = None
) -> dict[str, Any]:
    return _dispatch(to, booking_cancellation_email(data, reason=reason), from_addr=from_addr)


def send_refund_confirmation_email(
    *,
    to: str,
    data: BookingEmailData,
    refund_paise: int = 0,
    refund_method: str = "Wallet credit",
    from_addr: str | None = None,
) -> dict[str, Any]:
    return _dispatch(
        to,
        refund_confirmation_email(data, refund_paise=refund_paise, refund_method=refund_method),
        from_addr=from_addr,
    )


def send_booking_rescheduled_email(
    *,
    to: str,
    data: BookingEmailData,
    previous_date: str = "",
    previous_time: str = "",
    from_addr: str | None = None,
) -> dict[str, Any]:
    return _dispatch(
        to,
        booking_rescheduled_email(data, previous_date=previous_date, previous_time=previous_time),
        from_addr=from_addr,
    )


def send_admin_notification_email(
    *,
    to: str,
    title: str,
    message: str,
    details: list[tuple[str, str]] | None = None,
    cta_label: str | None = None,
    cta_url: str | None = None,
    test_mode: bool = False,
    from_addr: str | None = None,
) -> dict[str, Any]:
    return _dispatch(
        to,
        admin_notification_email(
            title=title,
            message=message,
            details=details,
            cta_label=cta_label,
            cta_url=cta_url,
            test_mode=test_mode,
        ),
        from_addr=from_addr,
    )
