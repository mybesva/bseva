"""Booking-scoped Start Puja / Complete Puja in-app OTPs.

Random 6-digit codes, hashed at rest, one-time use, resend-invalidates, attempt lockout.
Display codes live on bookings only so the intended recipient can read them in-app;
generic booking payloads must strip those columns.
"""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.booking_tracking import location_window_minutes, within_pre_start_minutes
from app.domain import hours_until
from app.platform_config import get_setting
from app.security import hash_password, verify_password

logger = logging.getLogger("bseva.puja_otp")

PURPOSE_START = "start_puja"
PURPOSE_COMPLETE = "complete_puja"

_DISPLAY_COL = {
    PURPOSE_START: "start_otp_code",
    PURPOSE_COMPLETE: "complete_otp_code",
}
_SENT_COL = {
    PURPOSE_START: "otp_sent_at",
    PURPOSE_COMPLETE: "complete_otp_sent_at",
}


class PujaOtpError(Exception):
    def __init__(self, message: str, *, status: int = 400, code: str = "OTP_ERROR"):
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code


def _int_setting(db: Session, key: str, default: int) -> int:
    try:
        return int(get_setting(db, key, default) or default)
    except (TypeError, ValueError):
        return default


def otp_window_minutes(db: Session) -> int:
    return max(1, _int_setting(db, "puja_start_otp_before_minutes", 15))


def complete_otp_before_minutes(db: Session) -> int:
    return max(1, _int_setting(db, "puja_complete_otp_before_minutes", 15))


def start_otp_expiry_minutes(db: Session) -> int:
    return max(15, _int_setting(db, "puja_otp_expiry_minutes", 240))


def complete_otp_expiry_minutes(db: Session) -> int:
    return max(30, _int_setting(db, "puja_complete_otp_expiry_minutes", 480))


def resend_cooldown_seconds(db: Session) -> int:
    return max(15, _int_setting(db, "puja_otp_resend_cooldown_seconds", 60))


def max_requests_per_hour(db: Session) -> int:
    return max(1, _int_setting(db, "puja_otp_max_requests_per_hour", 5))


def max_verify_attempts(db: Session) -> int:
    return max(3, _int_setting(db, "puja_otp_max_verify_attempts", 5))


def lock_minutes(db: Session) -> int:
    return max(1, _int_setting(db, "puja_otp_lock_minutes", 10))


def generate_puja_otp() -> str:
    """Cryptographically secure 6-digit OTP. Never a universal/static code."""
    return f"{secrets.randbelow(1_000_000):06d}"


def within_start_window(db: Session, booking_date, start_time, *, minutes: int | None = None) -> bool:
    mins = minutes if minutes is not None else otp_window_minutes(db)
    return within_pre_start_minutes(db, booking_date, start_time, minutes=mins)


def service_duration_minutes(db: Session, booking: dict) -> int:
    try:
        raw = db.execute(
            text("SELECT duration_minutes FROM services WHERE id = CAST(:id AS uuid)"),
            {"id": str(booking.get("service_id"))},
        ).scalar()
        return max(1, int(raw or 90))
    except Exception:
        return 90


def expected_end_utc(db: Session, booking: dict) -> datetime:
    """started_at + service duration, else scheduled start + duration (IST wall clock)."""
    duration = service_duration_minutes(db, booking)
    started = booking.get("started_at")
    if started:
        if isinstance(started, str):
            started = datetime.fromisoformat(started.replace("Z", "+00:00"))
        if isinstance(started, datetime):
            if started.tzinfo is None:
                started = started.replace(tzinfo=timezone.utc)
            return started.astimezone(timezone.utc) + timedelta(minutes=duration)
    bd = booking.get("booking_date")
    st = booking.get("start_time")
    hrs = hours_until(bd, st) if bd is not None and st is not None else 0.0
    return datetime.now(timezone.utc) + timedelta(hours=hrs) + timedelta(minutes=duration)


def within_complete_window(db: Session, booking: dict) -> bool:
    if str(booking.get("status") or "") != "in_progress":
        return False
    end = expected_end_utc(db, booking)
    lead = timedelta(minutes=complete_otp_before_minutes(db))
    return datetime.now(timezone.utc) >= (end - lead)


def _phone_key(booking_id: str, purpose: str) -> str:
    return f"booking:{booking_id}:{purpose}"


def _invalidate_prior(db: Session, booking_id: str, purpose: str) -> None:
    db.execute(
        text(
            """
            UPDATE otp_codes
            SET consumed = TRUE
            WHERE phone = :phone AND purpose = :purpose AND consumed = FALSE
            """
        ),
        {"phone": _phone_key(booking_id, purpose), "purpose": purpose},
    )


def _hourly_count(db: Session, booking_id: str, purpose: str) -> int:
    n = db.execute(
        text(
            """
            SELECT COUNT(*) FROM otp_codes
            WHERE phone = :phone AND purpose = :purpose
              AND created_at > NOW() - INTERVAL '1 hour'
            """
        ),
        {"phone": _phone_key(booking_id, purpose), "purpose": purpose},
    ).scalar()
    return int(n or 0)


def _last_created_age_seconds(db: Session, booking_id: str, purpose: str) -> float | None:
    row = db.execute(
        text(
            """
            SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) AS age
            FROM otp_codes
            WHERE phone = :phone AND purpose = :purpose
            ORDER BY created_at DESC LIMIT 1
            """
        ),
        {"phone": _phone_key(booking_id, purpose), "purpose": purpose},
    ).first()
    if not row or row[0] is None:
        return None
    return float(row[0])


def check_resend_allowed(db: Session, booking_id: str, purpose: str) -> dict[str, Any]:
    cooldown = resend_cooldown_seconds(db)
    age = _last_created_age_seconds(db, booking_id, purpose)
    if age is not None and age < cooldown:
        wait = int(cooldown - age) + 1
        return {"allowed": False, "reason": "cooldown", "retry_after_seconds": wait}
    if _hourly_count(db, booking_id, purpose) >= max_requests_per_hour(db):
        return {"allowed": False, "reason": "hourly_limit", "retry_after_seconds": 3600}
    return {"allowed": True, "retry_after_seconds": 0}


def _notify_otp(db: Session, *, user_id: str, purpose: str, code: str, booking: dict, is_resend: bool) -> None:
    from app.routers.notifications import create_notification, pujari_booking_link

    number = str(booking.get("booking_number") or booking.get("id") or "")
    service = booking.get("service_name") or "Puja"
    if purpose == PURPOSE_START:
        title = "Start Puja OTP ready" if not is_resend else "New Start Puja OTP"
        body = (
            f"Your Start Puja OTP for {service} ({number}) is {code}. "
            "Share this OTP with your Pujari when they arrive to begin the Puja."
        )
        key = "startOtpResend" if is_resend else "startOtp"
        link = f"/booking/{booking['id']}"
        cat = "puja_start_otp"
    else:
        title = "Completion OTP ready" if not is_resend else "New Completion OTP"
        body = (
            f"Your Completion OTP for {service} ({number}) is {code}. "
            "Share this OTP with the customer when the Puja is complete."
        )
        key = "completeOtpResend" if is_resend else "completeOtp"
        link = pujari_booking_link(str(booking["id"]))
        cat = "puja_complete_otp"
    create_notification(
        db,
        user_id=str(user_id),
        title=title,
        body=body,
        category=cat,
        link=link,
        extra_data={"booking_id": str(booking["id"])},
        message_key=key,
        message_vars={
            "code": code,
            "service": service,
            "service_id": str(booking.get("service_id") or ""),
            "number": number,
        },
    )


def issue_puja_otp(
    db: Session,
    booking: dict,
    purpose: str,
    *,
    notify: bool = True,
    is_resend: bool = False,
    actor_id: str | None = None,
    skip_rate_limit: bool = False,
) -> dict[str, Any]:
    booking_id = str(booking["id"])
    if purpose not in (PURPOSE_START, PURPOSE_COMPLETE):
        raise PujaOtpError("Invalid OTP purpose")
    if not skip_rate_limit:
        gate = check_resend_allowed(db, booking_id, purpose)
        if not gate.get("allowed"):
            wait = int(gate.get("retry_after_seconds") or 0)
            raise PujaOtpError(
                f"Please wait {wait}s before requesting another OTP" if gate.get("reason") == "cooldown"
                else "OTP resend limit reached. Try again later.",
                status=429,
                code=str(gate.get("reason") or "rate_limited"),
            )
    ttl = start_otp_expiry_minutes(db) if purpose == PURPOSE_START else complete_otp_expiry_minutes(db)
    code = generate_puja_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=ttl)
    recipient_id = booking.get("customer_id") if purpose == PURPOSE_START else booking.get("pujari_id")
    if not recipient_id:
        raise PujaOtpError("OTP recipient is missing on this booking")

    _invalidate_prior(db, booking_id, purpose)
    params = {
        "phone": _phone_key(booking_id, purpose),
        "email": str(recipient_id),
        "purpose": purpose,
        "h": hash_password(code),
        "exp": expires,
        "bid": booking_id,
    }
    try:
        db.execute(
            text(
                """
                INSERT INTO otp_codes (phone, email, purpose, code_hash, expires_at, booking_id)
                VALUES (:phone, :email, :purpose, :h, :exp, CAST(:bid AS uuid))
                """
            ),
            params,
        )
    except Exception:
        db.execute(
            text(
                """
                INSERT INTO otp_codes (phone, email, purpose, code_hash, expires_at)
                VALUES (:phone, :email, :purpose, :h, :exp)
                """
            ),
            params,
        )
    display_col = _DISPLAY_COL[purpose]
    sent_col = _SENT_COL[purpose]
    try:
        db.execute(
            text(
                f"""
                UPDATE bookings
                SET {sent_col} = NOW(), {display_col} = :code
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"code": code, "id": booking_id},
        )
    except Exception:
        db.execute(
            text(f"UPDATE bookings SET {sent_col} = NOW() WHERE id = CAST(:id AS uuid)"),
            {"id": booking_id},
        )

    if notify:
        _notify_otp(db, user_id=str(recipient_id), purpose=purpose, code=code, booking=booking, is_resend=is_resend)

    action = "puja_otp_resent" if is_resend else "puja_otp_issued"
    write_audit(db, actor_id, f"{action}:{purpose}", "booking", booking_id)
    logger.info(
        "PUJA_OTP_%s purpose=%s booking=%s actor=%s",
        "RESENT" if is_resend else "ISSUED",
        purpose,
        booking_id,
        actor_id or "system",
    )
    return {
        "ok": True,
        "sent_to": "customer" if purpose == PURPOSE_START else "pujari",
        "purpose": purpose,
        "expires_at": expires.isoformat(),
    }


def _active_row(db: Session, booking_id: str, purpose: str):
    return db.execute(
        text(
            """
            SELECT * FROM otp_codes
            WHERE phone = :phone AND purpose = :purpose AND consumed = FALSE
              AND expires_at > NOW()
            ORDER BY created_at DESC LIMIT 1
            """
        ),
        {"phone": _phone_key(booking_id, purpose), "purpose": purpose},
    ).mappings().first()


def verify_puja_otp(
    db: Session,
    booking: dict,
    purpose: str,
    code: str,
    *,
    actor_id: str | None = None,
) -> dict[str, Any]:
    booking_id = str(booking["id"])
    row = _active_row(db, booking_id, purpose)
    if not row:
        write_audit(db, actor_id, f"puja_otp_verify_fail:{purpose}:missing", "booking", booking_id)
        logger.info("PUJA_OTP_VERIFY_FAIL purpose=%s booking=%s reason=missing", purpose, booking_id)
        raise PujaOtpError("Invalid or expired OTP")

    locked_until = row.get("locked_until")
    if locked_until:
        now = datetime.now(timezone.utc)
        lu = locked_until
        if isinstance(lu, str):
            lu = datetime.fromisoformat(lu.replace("Z", "+00:00"))
        if isinstance(lu, datetime):
            if lu.tzinfo is None:
                lu = lu.replace(tzinfo=timezone.utc)
            if lu > now:
                write_audit(db, actor_id, f"puja_otp_verify_fail:{purpose}:locked", "booking", booking_id)
                raise PujaOtpError("Too many attempts. Please wait a few minutes and try again.", status=429, code="locked")

    if not verify_password((code or "").strip(), row["code_hash"]):
        attempts = int(row.get("attempt_count") or 0) + 1
        max_a = max_verify_attempts(db)
        if attempts >= max_a:
            db.execute(
                text(
                    """
                    UPDATE otp_codes
                    SET attempt_count = :n,
                        last_attempt_at = NOW(),
                        locked_until = NOW() + make_interval(mins => :mins)
                    WHERE id = :id
                    """
                ),
                {"n": attempts, "mins": lock_minutes(db), "id": row["id"]},
            )
        else:
            db.execute(
                text(
                    """
                    UPDATE otp_codes
                    SET attempt_count = :n, last_attempt_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"n": attempts, "id": row["id"]},
            )
        write_audit(db, actor_id, f"puja_otp_verify_fail:{purpose}", "booking", booking_id)
        logger.info("PUJA_OTP_VERIFY_FAIL purpose=%s booking=%s attempts=%s", purpose, booking_id, attempts)
        raise PujaOtpError("Invalid or expired OTP")

    db.execute(
        text(
            """
            UPDATE otp_codes
            SET consumed = TRUE, consumed_at = NOW(), attempt_count = COALESCE(attempt_count, 0)
            WHERE id = :id
            """
        ),
        {"id": row["id"]},
    )
    display_col = _DISPLAY_COL[purpose]
    try:
        db.execute(
            text(f"UPDATE bookings SET {display_col} = NULL WHERE id = CAST(:id AS uuid)"),
            {"id": booking_id},
        )
    except Exception:
        pass
    write_audit(db, actor_id, f"puja_otp_verified:{purpose}", "booking", booking_id)
    logger.info("PUJA_OTP_VERIFIED purpose=%s booking=%s", purpose, booking_id)
    return {"ok": True, "purpose": purpose}


def reveal_display_code(booking: dict, purpose: str) -> str | None:
    col = _DISPLAY_COL.get(purpose)
    if not col:
        return None
    val = booking.get(col)
    return str(val).strip() if val else None


def has_active_display(booking: dict, purpose: str) -> bool:
    return bool(reveal_display_code(booking, purpose))


# Back-compat names used by older imports
def issue_start_puja_otp(db: Session, booking: dict, *, notify: bool = True) -> str:
    """Issue start OTP. Return value is unused by callers that only need a side effect."""
    issue_puja_otp(db, booking, PURPOSE_START, notify=notify, skip_rate_limit=True)
    return ""
