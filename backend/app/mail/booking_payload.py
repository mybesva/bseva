"""Map booking DB rows → BookingEmailData for lifecycle emails."""
from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.mail.templates import BookingEmailData, InvoiceEmailData


def _paise(row: dict, *keys: str) -> int:
    for k in keys:
        if row.get(k) is not None:
            try:
                return int(row.get(k) or 0)
            except (TypeError, ValueError):
                return 0
    return 0


def booking_email_data_from_row(
    booking: dict[str, Any],
    *,
    customer_name: str = "",
    service_name: str = "",
    language: str = "en",
    extra: dict[str, Any] | None = None,
) -> BookingEmailData:
    b = dict(booking)
    if extra:
        b.update(extra)
    location = (
        b.get("location_label")
        or b.get("address")
        or ", ".join(x for x in [b.get("city"), b.get("state")] if x)
        or ""
    )
    return BookingEmailData(
        customer_name=customer_name or str(b.get("customer_name") or ""),
        booking_id=str(b.get("id") or ""),
        booking_number=str(b.get("booking_number") or ""),
        service_name=service_name or str(b.get("service_name") or "Puja"),
        booking_date=str(b.get("booking_date") or ""),
        start_time=str(b.get("start_time") or ""),
        muhurtham=str(b.get("muhurtham") or b.get("start_time") or ""),
        location=str(location),
        package=str(b.get("package_type") or b.get("package") or ""),
        main_puja_paise=_paise(b, "main_puja_charge_paise", "base_price_paise", "base_puja_paise"),
        samagri_paise=_paise(b, "samagri_charge_paise", "samagri_paise", "samagri_total_paise"),
        alankaram_paise=_paise(b, "alankaram_charge_paise", "alankaram_paise"),
        food_prasadam_paise=_paise(b, "food_charge_paise", "food_prasadam_paise", "prasadam_paise", "food_paise"),
        total_paise=_paise(b, "total_paise"),
        payment_status=str(b.get("payment_status") or ""),
        booking_status=str(b.get("status") or ""),
        language=language or "en",
        test_mode=False,
    )


def load_customer_email_context(db: Session, customer_id: str) -> dict[str, str]:
    row = db.execute(
        text(
            """
            SELECT email, name, preferred_language
            FROM users WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": customer_id},
    ).mappings().first()
    if not row:
        return {"email": "", "name": "", "language": "en"}
    return {
        "email": str(row.get("email") or ""),
        "name": str(row.get("name") or ""),
        "language": str(row.get("preferred_language") or "en"),
    }


def load_service_name(db: Session, service_id: str) -> str:
    name = db.execute(
        text("SELECT name FROM services WHERE id = CAST(:id AS uuid)"),
        {"id": service_id},
    ).scalar()
    return str(name or "Puja")


def invoice_email_data_from_snapshot(
    *,
    customer_name: str,
    invoice_number: str,
    booking: dict[str, Any],
    payment_method: str = "Wallet",
    transaction_id: str = "",
    payment_date: str = "",
    language: str = "en",
) -> InvoiceEmailData:
    lines = [
        ("Main puja", _paise(booking, "main_puja_charge_paise", "base_price_paise")),
        ("Samagri", _paise(booking, "samagri_charge_paise", "samagri_paise", "samagri_total_paise")),
        ("Alankaram", _paise(booking, "alankaram_charge_paise", "alankaram_paise")),
        ("Food / Prasadam", _paise(booking, "food_charge_paise", "food_prasadam_paise", "prasadam_paise")),
        ("Platform fee", _paise(booking, "platform_fee_paise")),
    ]
    return InvoiceEmailData(
        customer_name=customer_name,
        invoice_number=invoice_number,
        booking_id=str(booking.get("id") or ""),
        booking_number=str(booking.get("booking_number") or ""),
        service_name=str(booking.get("service_name") or "Puja"),
        booking_date=str(booking.get("booking_date") or ""),
        payment_date=payment_date,
        payment_method=payment_method,
        transaction_id=transaction_id,
        lines=[(a, b) for a, b in lines if b],
        tax_paise=_paise(booking, "gst_amount_paise", "gst_paise"),
        total_paid_paise=_paise(booking, "total_paise"),
        payment_status=str(booking.get("payment_status") or "paid"),
        language=language,
        test_mode=False,
    )
