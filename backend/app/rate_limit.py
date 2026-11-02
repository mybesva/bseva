"""Fixed-window rate limits stored in Postgres, so they hold across serverless instances and workers.

Keys are hashed before storage (no raw emails or IPs in the table). If the table is missing — e.g.
migration 024 not applied yet — limits fail open and log an error rather than taking login down, except
where the caller asks to fail closed (public endpoints that send email).
"""
from __future__ import annotations

import hashlib
import logging
import random

from fastapi import Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.i18n import coded_http

logger = logging.getLogger("bseva.rate_limit")

# bucket -> (limit, window seconds)
LOGIN_FAIL_IDENTIFIER = ("login_fail_id", 10, 15 * 60)
LOGIN_FAIL_IP = ("login_fail_ip", 50, 15 * 60)
OTP_REQUEST_IP = ("otp_request_ip", 20, 60 * 60)
OTP_REQUEST_IP_DAY = ("otp_request_ip_day", 60, 24 * 60 * 60)  # limit overridden by settings
OTP_VERIFY_FAIL_IP = ("otp_verify_fail_ip", 30, 15 * 60)
CONTACT_IP = ("contact_ip", 5, 60 * 60)
CONTACT_IP_DAY = ("contact_ip_day", 10, 24 * 60 * 60)
CONTACT_EMAIL = ("contact_email", 3, 60 * 60)
CONTACT_EMAIL_DAY = ("contact_email_day", 5, 24 * 60 * 60)
CONTACT_PHONE_DAY = ("contact_phone_day", 5, 24 * 60 * 60)
# Whole-deployment circuit breakers; the limit comes from settings, so these hold only bucket and window.
OTP_PUBLIC_EMAILS_HOUR = ("otp_public_emails_hour", 0, 60 * 60)
CONTACT_TEAM_EMAILS_HOUR = ("contact_team_emails_hour", 0, 60 * 60)
CONTACT_VOLUME_ALERT_HOUR = ("contact_volume_alert_hour", 1, 60 * 60)
GLOBAL_KEY = "all"

_WINDOW_START = "to_timestamp(floor(extract(epoch FROM now()) / :w) * :w)"


def client_ip(request: Request | None) -> str:
    """Client address as set by the edge proxy (Vercel / Nginx overwrite X-Real-IP and X-Forwarded-For)."""
    if request is None:
        return "unknown"
    real = (request.headers.get("x-real-ip") or "").strip()
    if real:
        return real
    forwarded = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if forwarded:
        return forwarded
    return request.client.host if request.client else "unknown"


def _key(raw: str) -> str:
    return hashlib.sha256(str(raw or "").strip().lower().encode()).hexdigest()[:40]


def _savepoint(db: Session):
    begin_nested = getattr(db, "begin_nested", None)
    return begin_nested() if begin_nested else _NullContext()


class _NullContext:
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def hits(db: Session, rule: tuple[str, int, int], raw_key: str) -> int:
    """Current count in this window, without incrementing."""
    bucket, _limit, window = rule
    try:
        with _savepoint(db):
            value = db.execute(
                text(
                    f"""
                    SELECT hits FROM security_rate_limits
                    WHERE bucket = :b AND key_hash = :k AND window_start = {_WINDOW_START}
                    """
                ),
                {"b": bucket, "k": _key(raw_key), "w": window},
            ).scalar()
    except SQLAlchemyError:
        logger.error("RATE_LIMIT_STORE_UNAVAILABLE bucket=%s (apply supabase/migrations/024)", bucket)
        return 0
    return int(value or 0)


class StoreUnavailable(Exception):
    """The counter table could not be read or written (raised only when the caller fails closed)."""


def unavailable():
    return coded_http(503, "SERVICE_BUSY", "This service is temporarily unavailable. Please try again in a few minutes.")


def record(db: Session, rule: tuple[str, int, int], raw_key: str, *, fail_closed: bool = False) -> int:
    """Increment this window's counter and return the new count."""
    bucket, _limit, window = rule
    try:
        with _savepoint(db):
            value = db.execute(
                text(
                    f"""
                    INSERT INTO security_rate_limits (bucket, key_hash, window_start, hits)
                    VALUES (:b, :k, {_WINDOW_START}, 1)
                    ON CONFLICT (bucket, key_hash, window_start)
                    DO UPDATE SET hits = security_rate_limits.hits + 1
                    RETURNING hits
                    """
                ),
                {"b": bucket, "k": _key(raw_key), "w": window},
            ).scalar()
            if random.random() < 0.01:
                db.execute(text("DELETE FROM security_rate_limits WHERE window_start < now() - interval '2 days'"))
    except SQLAlchemyError:
        logger.error("RATE_LIMIT_STORE_UNAVAILABLE bucket=%s (apply supabase/migrations/024)", bucket)
        if fail_closed:
            raise StoreUnavailable(bucket) from None
        return 0
    return int(value or 0)


def reset(db: Session, rule: tuple[str, int, int], raw_key: str) -> None:
    bucket = rule[0]
    try:
        with _savepoint(db):
            db.execute(
                text("DELETE FROM security_rate_limits WHERE bucket = :b AND key_hash = :k"),
                {"b": bucket, "k": _key(raw_key)},
            )
    except SQLAlchemyError:
        logger.error("RATE_LIMIT_STORE_UNAVAILABLE bucket=%s", bucket)


def too_many(message: str = "Too many attempts. Please wait a few minutes and try again."):
    return coded_http(429, "RATE_LIMITED", message)


def is_blocked(db: Session, rule: tuple[str, int, int], raw_key: str) -> bool:
    return hits(db, rule, raw_key) >= rule[1]


def enforce(
    db: Session,
    rule: tuple[str, int, int],
    raw_key: str,
    message: str | None = None,
    *,
    fail_closed: bool = False,
) -> None:
    """Count this request (committed immediately) and refuse it once the window's limit is exceeded.

    Call before the endpoint makes any writes of its own. With fail_closed, a broken counter store refuses
    the request (503) instead of letting it through."""
    try:
        count = record(db, rule, raw_key, fail_closed=fail_closed)
    except StoreUnavailable:
        raise unavailable() from None
    db.commit()
    if count > rule[1]:
        raise too_many(message) if message else too_many()
