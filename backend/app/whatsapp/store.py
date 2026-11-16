"""Message log and webhook de-duplication for WhatsApp (tables from supabase/migrations/042).

Recipients are stored as a SHA-256 hash plus the last four digits. Message content and template parameters
are never stored or logged, because a parameter can be a one-time code.
"""
from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session

# Forward-only order of Meta delivery statuses; a late or repeated webhook never moves a message backwards.
STATUS_RANK = {"send_failed": 0, "accepted": 1, "sent": 2, "delivered": 3, "read": 4}
TIMESTAMP_COLUMN = {"sent": "sent_at", "delivered": "delivered_at", "read": "read_at", "failed": "failed_at"}


class InvalidRecipient(ValueError):
    pass


def normalize_recipient(raw: str | None) -> str:
    """Digits with country code, as Cloud API expects (no '+'). A bare 10-digit Indian mobile gets 91."""
    digits = re.sub(r"\D", "", str(raw or ""))
    if len(digits) == 10 and digits[0] in "6789":
        digits = "91" + digits
    elif len(digits) == 11 and digits.startswith("0") and digits[1] in "6789":
        digits = "91" + digits[1:]
    if not 8 <= len(digits) <= 15 or digits.startswith("0"):
        raise InvalidRecipient("recipient must be a phone number with country code")
    return digits


def recipient_hash(digits: str) -> str:
    return hashlib.sha256(f"whatsapp:{digits}".encode()).hexdigest()


def mask(digits: str | None) -> str:
    d = re.sub(r"\D", "", str(digits or ""))
    return f"***{d[-4:]}" if len(d) >= 4 else "***"


def claim_event(db: Session, key: str, kind: str) -> bool:
    """True the first time an event key is seen; False for a duplicate. Commits with the caller's transaction."""
    row = db.execute(
        text(
            """
            INSERT INTO whatsapp_webhook_events (event_key, kind) VALUES (:k, :kind)
            ON CONFLICT (event_key) DO NOTHING
            RETURNING event_key
            """
        ),
        {"k": key[:200], "kind": kind[:40]},
    ).first()
    return row is not None


def record_outbound(
    db: Session,
    *,
    digits: str,
    purpose: str,
    template_name: str,
    language: str,
    status: str,
    attempts: int,
    wamid: str | None = None,
    error_code: int | None = None,
    error_title: str | None = None,
) -> str:
    row = db.execute(
        text(
            """
            INSERT INTO whatsapp_messages
              (wamid, source, purpose, template_name, language, recipient_hash, recipient_last4, status, attempts,
               error_code, error_title)
            VALUES (:wamid, 'outbound', :purpose, :tpl, :lang, :rh, :last4, :status, :attempts, :ec, :et)
            ON CONFLICT (wamid) DO UPDATE SET attempts = EXCLUDED.attempts, updated_at = NOW()
            RETURNING id
            """
        ),
        {
            "wamid": wamid,
            "purpose": purpose[:40],
            "tpl": template_name[:120],
            "lang": language[:12],
            "rh": recipient_hash(digits),
            "last4": digits[-4:],
            "status": status,
            "attempts": attempts,
            "ec": error_code,
            "et": (error_title or "")[:200] or None,
        },
    ).scalar_one()
    return str(row)


def apply_status(
    db: Session,
    *,
    wamid: str,
    status: str,
    recipient_digits: str | None,
    at: datetime | None,
    error_code: int | None = None,
    error_title: str | None = None,
    pricing_category: str | None = None,
) -> str:
    """Update one message from a status webhook. Returns 'updated', 'created' or 'stale'."""
    at = at or datetime.now(timezone.utc)
    current = db.execute(
        text("SELECT status FROM whatsapp_messages WHERE wamid = :w FOR UPDATE"), {"w": wamid}
    ).scalar_one_or_none()
    column = TIMESTAMP_COLUMN.get(status)
    if current is None:
        digits = re.sub(r"\D", "", recipient_digits or "")
        db.execute(
            text(
                f"""
                INSERT INTO whatsapp_messages
                  (wamid, source, recipient_hash, recipient_last4, status, error_code, error_title, pricing_category
                   {', ' + column if column else ''})
                VALUES (:w, 'webhook', :rh, :last4, :status, :ec, :et, :pc {', :at' if column else ''})
                ON CONFLICT (wamid) DO NOTHING
                """
            ),
            {
                "w": wamid,
                "rh": recipient_hash(digits) if digits else "unknown",
                "last4": digits[-4:] or None,
                "status": status,
                "ec": error_code,
                "et": (error_title or "")[:200] or None,
                "pc": (pricing_category or "")[:40] or None,
                "at": at,
            },
        )
        return "created"
    if status == "failed":
        # A failure after the message was delivered or read is not believable; keep the better status.
        move = current in ("send_failed", "accepted", "sent")
    else:
        move = current != "failed" and STATUS_RANK.get(status, -1) > STATUS_RANK.get(current, -1)
    db.execute(
        text(
            f"""
            UPDATE whatsapp_messages SET
              status = CASE WHEN :move THEN :status ELSE status END,
              error_code = CASE WHEN :status = 'failed' AND :move THEN :ec ELSE error_code END,
              error_title = CASE WHEN :status = 'failed' AND :move THEN :et ELSE error_title END,
              pricing_category = COALESCE(:pc, pricing_category),
              {column + ' = COALESCE(' + column + ', :at),' if column else ''}
              updated_at = NOW()
            WHERE wamid = :w
            """
        ),
        {
            "w": wamid,
            "move": move,
            "status": status,
            "ec": error_code,
            "et": (error_title or "")[:200] or None,
            "pc": (pricing_category or "")[:40] or None,
            "at": at,
        },
    )
    return "updated" if move else "stale"
