"""Secure OTP create / verify / invalidate with email delivery."""
from __future__ import annotations

import logging
import secrets
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.otp_delivery import get_otp_delivery_provider
from app.security import hash_otp, verify_otp

logger = logging.getLogger("bseva.otp")

OTP_TTL_MINUTES = 10
RESEND_COOLDOWN_SECONDS = 60
MAX_REQUESTS_PER_HOUR = 5


def generate_otp_code() -> str:
    """Cryptographically secure 6-digit OTP (000000–999999)."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _normalize_email(email: str | None) -> str | None:
    if not email:
        return None
    return str(email).strip().lower() or None


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


def check_otp_rate_limit(db: Session, *, email: str) -> dict[str, Any]:
    email_n = _normalize_email(email)
    if not email_n:
        return {"allowed": False, "reason": "email_required"}

    recent = db.execute(
        text(
            """
            SELECT created_at
            FROM otp_codes
            WHERE lower(email::text) = :email
              AND created_at > NOW() - INTERVAL '1 hour'
            ORDER BY created_at DESC
            LIMIT :lim
            """
        ),
        {"email": email_n, "lim": MAX_REQUESTS_PER_HOUR + 1},
    ).mappings().all()

    if len(recent) >= MAX_REQUESTS_PER_HOUR:
        return {"allowed": False, "reason": "hourly_limit", "retry_after_seconds": 3600}

    if recent:
        last = recent[0]["created_at"]
        age = db.execute(
            text("SELECT EXTRACT(EPOCH FROM (NOW() - CAST(:ts AS timestamptz)))"),
            {"ts": last},
        ).scalar()
        try:
            age_s = float(age or 0)
        except (TypeError, ValueError):
            age_s = 0.0
        if age_s < RESEND_COOLDOWN_SECONDS:
            wait = int(RESEND_COOLDOWN_SECONDS - age_s) + 1
            return {"allowed": False, "reason": "cooldown", "retry_after_seconds": wait}

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
) -> dict[str, Any]:
    """
    Create hashed OTP (10 min), invalidate prior codes for same email+purpose,
    optionally deliver via email provider.
    Never returns plaintext OTP except in non-production when SMTP is not configured
    and OTP_DEV_CODE is set for local fallback.
    """
    email_n = _normalize_email(email)
    if not email_n:
        return {"ok": False, "error": "email_required"}

    purpose_n = purpose if purpose in ("register", "login", "verify", "reset", "verify_email") else "login"

    rate = check_otp_rate_limit(db, email=email_n)
    if not rate.get("allowed"):
        return {
            "ok": False,
            "error": rate.get("reason") or "rate_limited",
            "retry_after_seconds": rate.get("retry_after_seconds"),
        }

    # Prefer real random OTP when SMTP is configured; allow fixed dev code only when not configured
    from app.mail.smtp_client import smtp_configured

    if smtp_configured():
        code = generate_otp_code()
    else:
        code = (settings.otp_dev_code or generate_otp_code()).strip() or generate_otp_code()

    invalidate_prior_otps(db, email=email_n, purpose=purpose_n)
    db.execute(
        text(
            """
            INSERT INTO otp_codes (phone, email, code_hash, purpose, expires_at)
            VALUES (:phone, :email, :hash, :purpose, NOW() + INTERVAL '10 minutes')
            """
        ),
        {
            "phone": phone,
            "email": email_n,
            "hash": hash_otp(code),
            "purpose": purpose_n,
        },
    )
    db.commit()

    delivery: dict[str, Any] = {"ok": True, "status": "skipped", "channel": "none"}
    if deliver:
        provider = get_otp_delivery_provider("email")
        try:
            delivery = provider.send_otp(
                destination=email_n,
                otp_code=code,
                purpose=purpose_n,
                customer_name=customer_name,
                language=language,
            )
        except Exception:
            logger.exception("OTP_DELIVERY_FAILED channel=email")
            delivery = {"ok": False, "status": "failed", "channel": "email", "error": "delivery_failed"}
        # Never log full OTP
        logger.info(
            "OTP_ISSUED purpose=%s channel=email delivery=%s",
            purpose_n,
            delivery.get("status"),
        )

    out: dict[str, Any] = {
        "ok": True,
        "message": "If an account can receive email, an OTP has been sent.",
        "expires_in_minutes": OTP_TTL_MINUTES,
        "delivery": {"status": delivery.get("status"), "channel": delivery.get("channel", "email")},
    }
    # Local-only hint when SMTP not configured
    if not smtp_configured() and settings.environment != "production":
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
            """
        ),
        params,
    ).mappings().all()

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
    return {"ok": False, "error": "invalid_or_expired"}
