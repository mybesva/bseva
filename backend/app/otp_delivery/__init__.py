"""OTP delivery provider layer — email now; SMS can be added later without rewriting auth."""
from __future__ import annotations

from typing import Protocol


class OtpDeliveryProvider(Protocol):
    channel: str

    def send_otp(
        self,
        *,
        destination: str,
        otp_code: str,
        purpose: str,
        customer_name: str = "",
        language: str = "en",
    ) -> dict:
        ...


class EmailOtpProvider:
    channel = "email"

    def send_otp(
        self,
        *,
        destination: str,
        otp_code: str,
        purpose: str,
        customer_name: str = "",
        language: str = "en",
    ) -> dict:
        from app.mail.senders import send_login_otp_email

        # Same branded OTP template for login/register/verify — purpose only affects subject nuance later
        return send_login_otp_email(
            to=destination,
            otp_code=otp_code,
            customer_name=customer_name,
            language=language,
            test_mode=False,
        )


class SmsOtpProvider:
    """Placeholder for future Twilio / SMS OTP — not active yet."""

    channel = "sms"

    def send_otp(
        self,
        *,
        destination: str,
        otp_code: str,
        purpose: str,
        customer_name: str = "",
        language: str = "en",
    ) -> dict:
        return {
            "ok": False,
            "status": "unavailable",
            "channel": "sms",
            "error": "SMS OTP provider not configured",
        }


def get_otp_delivery_provider(preferred: str = "email") -> OtpDeliveryProvider:
    """Select delivery channel. Default email; SMS reserved for later."""
    if preferred == "sms":
        return SmsOtpProvider()
    return EmailOtpProvider()
