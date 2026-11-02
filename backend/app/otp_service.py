"""Secure OTP create / verify / invalidate with email delivery."""
from __future__ import annotations

import hashlib
import logging
import secrets
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.config import settings
from app.otp_delivery import get_otp_delivery_provider
from app.security import hash_otp, verify_otp

logger = logging.getLogger("bseva.otp")

OTP_TTL_MINUTES = 5
RESEND_COOLDOWN_SECONDS = 60
# Sends per email per purpose in any rolling 24 hours, for the public sign-up, sign-in and verify flows.
DAILY_SENDS_PER_PURPOSE = 5
# Wrong guesses allowed against one issued code before it is burned (a new OTP must be requested).
MAX_VERIFY_ATTEMPTS = 5


class OtpStoreUnavailable(Exception):
    """The send counter could not be read or written; callers refuse the request (fail closed)."""


def _is_development() -> bool:
    return (settings.environment or "").strip().lower() == "development"


def generate_otp_code() -> str:
    """Cryptographically secure 6-digit OTP (000000–999999)."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _normalize_email(email: str | None) -> str | None:
    if not email:
        return None
    return str(email).strip().lower() or None


def mask_email(email: str | None) -> str:
    """For logs: enough to correlate a report, not enough to harvest addresses."""
    name, _, domain = str(email or "").partition("@")
    return f"{name[:2]}***@{domain}" if domain else "***"


def _hash_key(raw: str) -> str:
    return hashlib.sha256(str(raw or "").strip().lower().encode()).hexdigest()[:40]


def invalidate_prior_otps(db: Session, *, email: str | None, purpose: str) -> None:
    email_n = _normalize_email(email)
    if not email_n:
        return
    db.execute(
        text(
            """
            UPDATE otp_codes
            SET consumed = TRUE
            WHERE consumed = FALSE
              AND purpose = :purpose
              AND lower(email::text) = :email
            """
        ),
        {"purpose": purpose, "email": email_n},
    )


def reserve_otp_send(
    db: Session,
    *,
    email: str,
    scope: str,
    daily_limit: int | None = DAILY_SENDS_PER_PURPOSE,
    hourly_limit: int | None = None,
    cooldown_seconds: int = RESEND_COOLDOWN_SECONDS,
    ip: str | None = None,
) -> dict[str, Any]:
    """Count one send for this email and scope, or refuse it. Rolling windows, committed before returning.

    A transaction-scoped advisory lock on the (scope, email) pair makes the check and the insert atomic, so
    concurrent requests cannot both pass. Unknown addresses are counted exactly like known ones."""
    email_n = _normalize_email(email)
    if not email_n:
        return {"allowed": False, "reason": "email_required"}
    key = _hash_key(email_n)
    try:
        db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:lock, 0))"), {"lock": f"otp_send:{scope}:{key}"})
        row = db.execute(
            text(
                """
                SELECT
                  COUNT(*) AS day_count,
                  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') AS hour_count,
                  EXTRACT(EPOCH FROM (NOW() - MAX(created_at))) AS since_last,
                  EXTRACT(EPOCH FROM (MIN(created_at) + INTERVAL '24 hours' - NOW())) AS day_reset_in,
                  EXTRACT(EPOCH FROM (
                    MIN(created_at) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') + INTERVAL '1 hour' - NOW()
                  )) AS hour_reset_in
                FROM otp_send_events
                WHERE scope = :scope AND key_hash = :key AND created_at > NOW() - INTERVAL '24 hours'
                """
            ),
            {"scope": scope, "key": key},
        ).mappings().first() or {}
        day_count = int(row.get("day_count") or 0)
        hour_count = int(row.get("hour_count") or 0)
        since_last = row.get("since_last")
        denial: dict[str, Any] | None = None
        if daily_limit is not None and day_count >= daily_limit:
            denial = {"reason": "daily_limit", "retry_after_seconds": max(1, int(float(row.get("day_reset_in") or 0)) + 1)}
        elif hourly_limit is not None and hour_count >= hourly_limit:
            denial = {"reason": "hourly_limit", "retry_after_seconds": max(1, int(float(row.get("hour_reset_in") or 0)) + 1)}
        elif since_last is not None and float(since_last) < cooldown_seconds:
            denial = {"reason": "cooldown", "retry_after_seconds": int(cooldown_seconds - float(since_last)) + 1}
        if denial:
            db.commit()  # releases the lock; nothing was written
            logger.info("OTP_SEND_REFUSED scope=%s to=%s reason=%s", scope, mask_email(email_n), denial["reason"])
            return {"allowed": False, **denial}
        db.execute(
            text("INSERT INTO otp_send_events (scope, key_hash, ip_hash) VALUES (:scope, :key, :ip)"),
            {"scope": scope, "key": key, "ip": _hash_key(ip) if ip else None},
        )
        if secrets.randbelow(100) == 0:
            db.execute(text("DELETE FROM otp_send_events WHERE created_at < NOW() - INTERVAL '2 days'"))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.error("OTP_SEND_STORE_UNAVAILABLE scope=%s (apply supabase/migrations/037)", scope)
        raise OtpStoreUnavailable(scope) from None
    return {"allowed": True}


def issue_email_otp(
    db: Session,
    *,
    email: str,
    purpose: str,
    customer_name: str = "",
    language: str = "en",
    phone: str | None = None,
    deliver: bool = True,
    ttl_minutes: int = OTP_TTL_MINUTES,
    daily_limit: int | None = DAILY_SENDS_PER_PURPOSE,
    hourly_limit: int | None = None,
    cooldown_seconds: int = RESEND_COOLDOWN_SECONDS,
    limit_scope: str | None = None,
    reserved: bool = False,
    ip: str | None = None,
) -> dict[str, Any]:
    """
    Create hashed OTP (5 min by default), invalidate prior codes for same email+purpose,
    optionally deliver via email provider.

    Send limits are counted per email and per limit_scope (the purpose unless given). Pass reserved=True when
    the caller already ran reserve_otp_send for this request.
    Never returns plaintext OTP except in non-production when SMTP is not configured
    and OTP_DEV_CODE is set for local fallback.
    """
    email_n = _normalize_email(email)
    if not email_n:
        return {"ok": False, "error": "email_required"}

    purpose_n = purpose if purpose in (
        "register", "login", "verify", "reset", "verify_email", "sensitive_action", "delete_account", "cancel_deletion"
    ) else "login"

    if not reserved:
        try:
            rate = reserve_otp_send(
                db,
                email=email_n,
                scope=limit_scope or purpose_n,
                daily_limit=daily_limit,
                hourly_limit=hourly_limit,
                cooldown_seconds=cooldown_seconds,
                ip=ip,
            )
        except OtpStoreUnavailable:
            return {"ok": False, "error": "unavailable"}
        if not rate.get("allowed"):
            return {
                "ok": False,
                "error": rate.get("reason") or "rate_limited",
                "retry_after_seconds": rate.get("retry_after_seconds"),
            }

    # Random OTP everywhere; the fixed OTP_DEV_CODE is honoured only for local development without SMTP,
    # and the secret OTP_TEST_CODE only for configured synthetic test domains on QA (no email is sent).
    from app.mail.smtp_client import smtp_configured

    test_code = settings.otp_test_code_for(email_n)
    if test_code:
        code = test_code
    elif smtp_configured() or not _is_development():
        code = generate_otp_code()
    else:
        code = (settings.otp_dev_code or generate_otp_code()).strip() or generate_otp_code()

    invalidate_prior_otps(db, email=email_n, purpose=purpose_n)
    db.execute(
        text(
            """
            INSERT INTO otp_codes (phone, email, code_hash, purpose, expires_at)
            VALUES (:phone, :email, :hash, :purpose, NOW() + make_interval(mins => :ttl))
            """
        ),
        {
            "phone": phone,
            "email": email_n,
            "hash": hash_otp(code),
            "purpose": purpose_n,
            "ttl": ttl_minutes,
        },
    )
    db.commit()

    delivery: dict[str, Any] = {"ok": True, "status": "skipped", "channel": "none"}
    if test_code:
        logger.info("OTP_ISSUED purpose=%s to=%s channel=qa_test_code", purpose_n, mask_email(email_n))
        delivery = {"ok": True, "status": "qa_test_code", "channel": "none"}
    elif deliver:
        provider = get_otp_delivery_provider("email")
        try:
            delivery = provider.send_otp(
                destination=email_n,
                otp_code=code,
                purpose=purpose_n,
                customer_name=customer_name,
                language=language,
                ttl_minutes=ttl_minutes,
            )
        except Exception:
            logger.exception("OTP_DELIVERY_FAILED channel=email to=%s", mask_email(email_n))
            delivery = {"ok": False, "status": "failed", "channel": "email", "error": "delivery_failed"}
        # Never log full OTP — only destination + delivery status
        logger.info(
            "OTP_ISSUED purpose=%s to=%s channel=email delivery=%s ok=%s",
            purpose_n,
            mask_email(email_n),
            delivery.get("status"),
            delivery.get("ok"),
        )

        delivery_status = str(delivery.get("status") or "")
        delivery_ok = bool(delivery.get("ok"))
        if delivery_status == "suppressed":
            # EMAIL_ALLOWLIST (QA): this address is not an approved recipient, so nothing was sent.
            invalidate_prior_otps(db, email=email_n, purpose=purpose_n)
            db.commit()
            return {
                "ok": False,
                "error": "recipient_not_allowed",
                "message": "This test environment only sends email to approved team addresses. Use an approved address or an @bseva.test test account.",
                "expires_in_minutes": ttl_minutes,
                "delivery": {"status": "suppressed", "channel": "email"},
            }
        if smtp_configured():
            # Must be accepted by SMTP for the visitor to receive mail
            delivery_ok = delivery_ok and delivery_status == "sent"
        else:
            # Local stub only — never pretend success outside local development without SMTP
            delivery_ok = delivery_ok and delivery_status in ("queued", "sent") and _is_development()
        if not delivery_ok:
            invalidate_prior_otps(db, email=email_n, purpose=purpose_n)
            db.commit()
            return {
                "ok": False,
                "error": "delivery_failed",
                "message": "Could not deliver OTP email. Please try again shortly.",
                "expires_in_minutes": ttl_minutes,
                "delivery": {
                    "status": delivery.get("status"),
                    "channel": delivery.get("channel", "email"),
                    "error": delivery.get("error"),
                },
            }

    out: dict[str, Any] = {
        "ok": True,
        "message": f"OTP sent to {email_n}. Valid for {ttl_minutes} minutes.",
        "expires_in_minutes": ttl_minutes,
        "email": email_n,
        "delivery": {"status": delivery.get("status"), "channel": delivery.get("channel", "email")},
    }
    # Local-only hint when SMTP not configured
    if not smtp_configured() and _is_development():
        out["dev_hint"] = "SMTP not configured; use OTP_DEV_CODE from environment"
    return out


def verify_email_otp(
    db: Session,
    *,
    email: str,
    code: str,
    purpose: str | None = None,
    consume: bool = True,
) -> dict[str, Any]:
    email_n = _normalize_email(email)
    if not email_n or not code:
        return {"ok": False, "error": "invalid"}

    params: dict[str, Any] = {"email": email_n}
    purpose_sql = ""
    if purpose:
        purpose_sql = " AND purpose = :purpose"
        params["purpose"] = purpose

    rows = db.execute(
        text(
            f"""
            SELECT * FROM otp_codes
            WHERE consumed = FALSE
              AND expires_at > NOW()
              AND lower(email::text) = :email
              {purpose_sql}
            ORDER BY created_at DESC
            LIMIT 5
            FOR UPDATE
            """
        ),
        params,
    ).mappings().all()

    if any(int(row.get("attempt_count") or 0) >= MAX_VERIFY_ATTEMPTS for row in rows):
        _invalidate_rows(db, rows)
        return {"ok": False, "error": "too_many_attempts"}

    for row in rows:
        if verify_otp(code.strip(), row["code_hash"]):
            if consume:
                db.execute(
                    text("UPDATE otp_codes SET consumed = TRUE WHERE id = :id"),
                    {"id": row["id"]},
                )
                # Invalidate siblings for same purpose/email
                db.execute(
                    text(
                        """
                        UPDATE otp_codes SET consumed = TRUE
                        WHERE consumed = FALSE
                          AND lower(email::text) = :email
                          AND purpose = :purpose
                          AND id <> :id
                        """
                    ),
                    {"email": email_n, "purpose": row["purpose"], "id": row["id"]},
                )
                db.commit()
            return {"ok": True, "purpose": row["purpose"]}

    if not rows:
        return {"ok": False, "error": "invalid_or_expired"}
    # Wrong code: count the attempt on every live code for this email; burn them at the limit.
    ids = [row["id"] for row in rows]
    attempts = db.execute(
        text(
            """
            UPDATE otp_codes SET attempt_count = COALESCE(attempt_count, 0) + 1, last_attempt_at = NOW()
            WHERE id = ANY(:ids)
            RETURNING attempt_count
            """
        ),
        {"ids": ids},
    ).scalars().all()
    if max((int(a or 0) for a in attempts), default=0) >= MAX_VERIFY_ATTEMPTS:
        _invalidate_rows(db, rows)
        return {"ok": False, "error": "too_many_attempts"}
    db.commit()
    return {"ok": False, "error": "invalid_or_expired"}


def _invalidate_rows(db: Session, rows) -> None:
    db.execute(
        text("UPDATE otp_codes SET consumed = TRUE WHERE id = ANY(:ids)"),
        {"ids": [row["id"] for row in rows]},
    )
    db.commit()
    logger.warning("OTP_ATTEMPTS_EXCEEDED codes_invalidated=%s", len(rows))
