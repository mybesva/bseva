"""Helpers for puja-start OTP issuance and customer visibility."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings as app_settings
from app.domain import hours_until
from app.platform_config import get_setting
from app.security import hash_password


def otp_window_minutes(db: Session) -> int:
    return int(get_setting(db, "puja_start_otp_before_minutes", 15) or 15)


def location_window_minutes(db: Session) -> int:
    return int(get_setting(db, "pujari_location_tracking_before_minutes", 15) or 15)


def within_start_window(db: Session, booking_date, start_time, *, minutes: int | None = None) -> bool:
    mins = minutes if minutes is not None else otp_window_minutes(db)
    hrs = hours_until(booking_date, start_time)
    # Allow from N minutes before start through a short grace after start
    return hrs * 60 <= mins + 0.5


def within_location_window(db: Session, booking_date, start_time, status: str) -> bool:
    if status == "in_progress":
        return True
    return within_start_window(db, booking_date, start_time, minutes=location_window_minutes(db))


def issue_start_puja_otp(db: Session, booking: dict, *, notify: bool = True) -> str:
    """Create start_puja OTP, store plaintext on booking for customer view, notify in-app."""
    booking_id = str(booking["id"])
    customer_id = str(booking["customer_id"])
    code = (app_settings.otp_dev_code or "123456").strip() or "123456"
    expires = datetime.now(timezone.utc) + timedelta(minutes=45)

    # Invalidate prior unused OTPs for this booking
    db.execute(
        text(
            """
            UPDATE otp_codes SET consumed = TRUE
            WHERE phone = :phone AND purpose = 'start_puja' AND consumed = FALSE
            """
        ),
        {"phone": f"booking:{booking_id}"},
    )
    db.execute(
        text(
            """
            INSERT INTO otp_codes (phone, email, purpose, code_hash, expires_at)
            VALUES (:phone, :email, 'start_puja', :h, :exp)
            """
        ),
        {
            "phone": f"booking:{booking_id}",
            "email": customer_id,
            "h": hash_password(code),
            "exp": expires,
        },
    )
    try:
        db.execute(
            text(
                """
                UPDATE bookings
                SET otp_sent_at = NOW(), start_otp_code = :code
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"code": code, "id": booking_id},
        )
    except Exception:
        db.execute(
            text("UPDATE bookings SET otp_sent_at = NOW() WHERE id = CAST(:id AS uuid)"),
            {"id": booking_id},
        )

    if notify:
        from app.routers.notifications import create_notification

        service = booking.get("service_name") or "Puja"
        create_notification(
            db,
            user_id=customer_id,
            title="Puja start OTP ready",
            body=f"Your OTP for {service} is {code}. Share it with your pujari only when they arrive to start.",
            category="puja_start_otp",
            link=f"/customer/bookings",
        )
    return code
