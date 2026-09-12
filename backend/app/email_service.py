"""Outbound email — re-exports mail package + legacy helpers for existing call sites."""
from __future__ import annotations

from typing import Any

from app.mail.smtp_client import send_email, smtp_configured, smtp_status
from app.mail.templates import BookingEmailData
from app.mail.senders import (
    send_booking_confirmation_email as _send_booking_confirmation_email,
)


def send_recommended_list_email(
    *,
    to: str,
    booking_number: str,
    service_name: str,
    items: list[dict],
    from_addr: str | None = None,
) -> dict[str, Any]:
    lines = [f"- {it.get('name')}" + (" (required)" if it.get("required") else "") for it in items]
    body = (
        f"Namaste,\n\nYour booking {booking_number} for {service_name} is confirmed.\n\n"
        f"Recommended List:\n" + ("\n".join(lines) if lines else "(none)") + "\n\nOm Shanti,\nBSeva\n"
    )
    return send_email(
        to=to,
        subject=f"BSeva Recommended List — {booking_number}",
        text_body=body,
        from_addr=from_addr,
    )


def send_booking_preparation_email(
    *,
    to: str,
    customer_name: str,
    booking_number: str,
    booking_id: str,
    service_name: str,
    booking_date: str,
    start_time: str,
    preparation: dict[str, Any],
    language: str = "en",
    from_addr: str | None = None,
    app_base_url: str | None = None,
    package: str = "",
    location: str = "",
    main_puja_paise: int = 0,
    samagri_paise: int = 0,
    alankaram_paise: int = 0,
    food_prasadam_paise: int = 0,
    total_paise: int = 0,
    payment_status: str = "paid",
    booking_status: str = "pending_acceptance",
) -> dict[str, Any]:
    """Booking confirmation email (HTML template). preparation retained for API compat."""
    _ = preparation, app_base_url
    data = BookingEmailData(
        customer_name=customer_name or "",
        booking_id=booking_id,
        booking_number=booking_number,
        service_name=service_name,
        booking_date=str(booking_date),
        start_time=str(start_time),
        muhurtham=str(start_time),
        location=location,
        package=package,
        main_puja_paise=int(main_puja_paise or 0),
        samagri_paise=int(samagri_paise or 0),
        alankaram_paise=int(alankaram_paise or 0),
        food_prasadam_paise=int(food_prasadam_paise or 0),
        total_paise=int(total_paise or 0),
        payment_status=payment_status,
        booking_status=booking_status,
        language=language or "en",
        test_mode=False,
    )
    return _send_booking_confirmation_email(to=to, data=data, from_addr=from_addr)


def send_booking_event_email(
    *,
    to: str,
    subject: str,
    text_body: str,
    html_body: str | None = None,
    from_addr: str | None = None,
) -> dict[str, Any]:
    return send_email(
        to=to,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        from_addr=from_addr,
    )
