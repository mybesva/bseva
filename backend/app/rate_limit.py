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
# Registration and email-verification codes go to addresses with no account yet, so they get their own
# site-wide budget and per-client daily cap: abusing them cannot use up sign-in, reset or deletion mail.
OTP_REGISTER_EMAILS_HOUR = ("otp_register_emails_hour", 0, 60 * 60)
OTP_REGISTER_IP_DAY = ("otp_register_ip_day", 0, 24 * 60 * 60)  # limit from settings
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


def enforce_otp_request_ip(db: Session, ip: str, per_day: int) -> None:
    """Per-client caps shared by every public endpoint that emails a code; a broken counter store refuses."""
    enforce(db, OTP_REQUEST_IP, ip, fail_closed=True)
    bucket, _limit, window = OTP_REQUEST_IP_DAY
    enforce(db, (bucket, int(per_day), window), ip, fail_closed=True)


def public_otp_circuit(db: Session, limit: int, rule: tuple[str, int, int] = OTP_PUBLIC_EMAILS_HOUR, kind: str = "otp") -> None:
    """Whole-deployment cap on OTP mail anonymous callers can trigger; refuses rather than flood the mailbox."""
    bucket, _limit, window = rule
    limit = int(limit)
    try:
        count = record(db, (bucket, limit, window), GLOBAL_KEY, fail_closed=True)
    except StoreUnavailable:
        raise unavailable() from None
    db.commit()
    if count > limit:
        if count == limit + 1:
            logger.critical("EMAIL_CIRCUIT_OPEN kind=%s limit_per_hour=%s", kind, limit)
        raise unavailable()


# Per-account caps on records signed-in customers and pujaris create. Staff are never limited. Only
# successful creations are counted (check first, count just before the commit), so failed validation and
# idempotent retries do not use up anyone's allowance. These counters fail open: a broken store must not
# stop bookings or urgent support.
SELF_SERVICE_ROLES = ("customer", "pujari", "head_pujari")
USER_ACTIONS: dict[str, tuple[tuple[str, int, int], ...]] = {
    "booking": (("user_booking_hour", 10, 60 * 60), ("user_booking_day", 30, 24 * 60 * 60)),
    "ticket": (("user_ticket_day", 10, 24 * 60 * 60),),
    "conversation": (("user_conversation_day", 10, 24 * 60 * 60),),
    "support_message": (("user_support_message_hour", 60, 60 * 60),),
    "report": (("user_report_day", 10, 24 * 60 * 60),),
}
USER_LIMIT_MESSAGES = {
    "booking": "You have made many bookings in a short time. Please try again later, or contact support if you need more.",
    "ticket": "You have opened many support requests today. Please add to an existing request, or call or WhatsApp us if it is urgent.",
    "conversation": "You have started many support chats today. Please continue an existing chat, or call or WhatsApp us if it is urgent.",
    "support_message": "You are sending messages very quickly. Please wait a few minutes, or call or WhatsApp us if it is urgent.",
    "report": "You have sent many reports today. Please try again tomorrow, or contact support if it is urgent.",
}


def _limited(user: dict | None) -> bool:
    return bool(user) and str(user.get("role") or "") in SELF_SERVICE_ROLES


def check_user_action(db: Session, user: dict | None, action: str) -> None:
    """Refuse (429 USER_LIMIT_REACHED) when this customer or pujari already reached a cap for the action."""
    if not _limited(user):
        return
    for rule in USER_ACTIONS[action]:
        if is_blocked(db, rule, f"user:{user['id']}"):
            logger.warning("USER_LIMIT_REACHED action=%s bucket=%s", action, rule[0])
            raise coded_http(429, "USER_LIMIT_REACHED", USER_LIMIT_MESSAGES[action])


def count_user_action(db: Session, user: dict | None, action: str) -> None:
    """Count one successful creation; call inside the same transaction, just before the commit."""
    if not _limited(user):
        return
    for rule in USER_ACTIONS[action]:
        record(db, rule, f"user:{user['id']}")

