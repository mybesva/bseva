"""Centralized outbound email (Zoho SMTP + branded templates)."""

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
from app.mail.smtp_client import send_email, smtp_configured, smtp_status

__all__ = [
    "send_email",
    "smtp_configured",
    "smtp_status",
    "send_login_otp_email",
    "send_welcome_email",
    "send_booking_confirmation_email",
    "send_booking_reminder_email",
    "send_pujari_assigned_email",
    "send_payment_confirmation_email",
    "send_invoice_receipt_email",
    "send_booking_cancellation_email",
    "send_refund_confirmation_email",
    "send_booking_rescheduled_email",
    "send_admin_notification_email",
]
