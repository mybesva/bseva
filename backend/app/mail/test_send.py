"""Dev/admin email template test sender — dummy data only, marked TEST."""
from __future__ import annotations

import secrets
from collections.abc import Callable
from typing import Any

from app.mail.senders import (
    send_admin_notification_email,
    send_booking_cancellation_email,
    send_booking_confirmation_email,
    send_booking_reminder_email,
    send_booking_rescheduled_email,
    send_invoice_receipt_email,
    send_login_otp_email,
    send_payment_confirmation_email,
    send_pujari_assigned_email,
    send_refund_confirmation_email,
    send_welcome_email,
)
from app.mail.smtp_client import smtp_status
from app.mail.templates import sample_booking_data, sample_invoice_data

DEFAULT_TEST_RECIPIENT = "mybseva@gmail.com"


def send_all_test_templates(to: str = DEFAULT_TEST_RECIPIENT) -> dict[str, Any]:
    """Send every branded template with dummy TEST data. Does not touch production records."""
    recipient = (to or DEFAULT_TEST_RECIPIENT).strip()
    booking = sample_booking_data(test_mode=True)
    invoice = sample_invoice_data(test_mode=True)
    test_otp = f"{secrets.randbelow(1_000_000):06d}"

    jobs: list[tuple[str, Callable[[], dict[str, Any]]]] = [
        (
            "login_otp",
            lambda: send_login_otp_email(
                to=recipient,
                otp_code=test_otp,
                customer_name=booking.customer_name,
                test_mode=True,
            ),
        ),
        (
            "welcome",
            lambda: send_welcome_email(to=recipient, customer_name=booking.customer_name, test_mode=True),
        ),
        (
            "booking_confirmation",
            lambda: send_booking_confirmation_email(to=recipient, data=booking),
        ),
        (
            "booking_reminder",
            lambda: send_booking_reminder_email(to=recipient, data=booking, hours_ahead=24),
        ),
        (
            "pujari_assigned",
            lambda: send_pujari_assigned_email(
                to=recipient, data=booking, pujari_name="Pandit Ramesh Sharma"
            ),
        ),
        (
            "payment_confirmation",
            lambda: send_payment_confirmation_email(
                to=recipient, data=booking, transaction_id="TXN-TEST-998877", method="Wallet"
            ),
        ),
        (
            "invoice_receipt",
            lambda: send_invoice_receipt_email(to=recipient, data=invoice),
        ),
        (
            "booking_cancellation",
            lambda: send_booking_cancellation_email(
                to=recipient, data=booking, reason="Customer schedule conflict (TEST)"
            ),
        ),
        (
            "refund_confirmation",
            lambda: send_refund_confirmation_email(
                to=recipient, data=booking, refund_paise=booking.total_paise, refund_method="Wallet credit"
            ),
        ),
        (
            "booking_rescheduled",
            lambda: send_booking_rescheduled_email(
                to=recipient, data=booking, previous_date="2026-09-18", previous_time="08:00"
            ),
        ),
        (
            "admin_notification",
            lambda: send_admin_notification_email(
                to=recipient,
                title="Needs reassignment (TEST)",
                message="A booking was declined and needs admin attention.",
                details=[
                    ("Booking", booking.booking_number),
                    ("Service", booking.service_name),
                    ("Customer", booking.customer_name),
                ],
                test_mode=True,
            ),
        ),
    ]

    results = []
    for name, fn in jobs:
        try:
            r = fn()
            results.append(
                {
                    "template": name,
                    "ok": bool(r.get("ok")),
                    "status": r.get("status"),
                    "to": r.get("to") or recipient,
                    "from": r.get("from"),
                    "subject": r.get("subject"),
                    "error": r.get("error"),
                }
            )
        except Exception as e:
            results.append(
                {
                    "template": name,
                    "ok": False,
                    "status": "failed",
                    "to": recipient,
                    "from": None,
                    "subject": None,
                    "error": type(e).__name__,
                }
            )

    sent = sum(1 for r in results if r.get("ok") and r.get("status") == "sent")
    failed = [r for r in results if not r.get("ok")]
    return {
        "recipient": recipient,
        "smtp": smtp_status(),
        "test_otp_preview_note": "OTP was generated for the login_otp test email only; validity shown as 10 minutes in template.",
        "summary": {
            "total": len(results),
            "sent_or_queued_ok": sum(1 for r in results if r.get("ok")),
            "sent": sent,
            "failed": len(failed),
        },
        "results": results,
    }
