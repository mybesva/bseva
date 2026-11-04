"""Meta WhatsApp webhook: challenge check, X-Hub-Signature-256 verification and idempotent event processing.

Logs carry event kinds, message ids, statuses and masked numbers only: never message text, template
parameters, the verify token, the app secret or the raw payload.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from app.whatsapp import store

logger = logging.getLogger("bseva.whatsapp")

# Meta caps webhook payloads at 3 MB; anything larger is not from Meta.
MAX_BODY_BYTES = 3 * 1024 * 1024
# Meta's challenge is a short random string; refuse anything else rather than echo it back.
_CHALLENGE_RE = re.compile(r"^[A-Za-z0-9_\-.]{1,128}$")
DELIVERY_STATUSES = ("sent", "delivered", "read", "failed")


class MalformedPayload(ValueError):
    pass


def challenge_response(mode: str | None, token: str | None, challenge: str | None) -> str | None:
    """The challenge to echo when Meta's subscription check is genuine, else None."""
    expected = settings.whatsapp_webhook_verify_token or ""
    if not expected or mode != "subscribe" or not challenge or not _CHALLENGE_RE.match(challenge):
        return None
    if not hmac.compare_digest((token or "").encode(), expected.encode()):
        return None
    return challenge


def signature_valid(body: bytes, header: str | None) -> bool:
    """X-Hub-Signature-256 is 'sha256=' + hex HMAC-SHA256 of the raw body, keyed with the Meta App Secret."""
    secret = settings.whatsapp_app_secret or ""
    if not secret or not header or not header.startswith("sha256="):
        return False
    given = header[len("sha256="):].strip().lower()
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(given.encode(), expected.encode())


def parse(body: bytes) -> dict[str, Any]:
    try:
        payload = json.loads(body)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise MalformedPayload("body is not JSON") from None
    if not isinstance(payload, dict) or not isinstance(payload.get("entry", []), list):
        raise MalformedPayload("unexpected payload shape")
    return payload


def _ts(raw: Any) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(raw), tz=timezone.utc)
    except (TypeError, ValueError, OverflowError, OSError):
        return None


def _first_error(item: dict) -> tuple[int | None, str | None]:
    errors = item.get("errors")
    if isinstance(errors, list) and errors and isinstance(errors[0], dict):
        code = errors[0].get("code")
        return (code if isinstance(code, int) else None), str(errors[0].get("title") or "")[:200] or None
    return None, None


def _digest(value: Any) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True, default=str).encode()).hexdigest()


def process(db: Session, payload: dict[str, Any]) -> dict[str, int]:
    """Apply every event in one webhook delivery. The caller commits once, so a failure part-way leaves
    nothing behind and Meta's retry starts again from a clean state (each event is claimed only once)."""
    counts = {"statuses": 0, "messages": 0, "other": 0, "duplicates": 0, "ignored": 0}
    if payload.get("object") != "whatsapp_business_account":
        counts["ignored"] += 1
        logger.info("WHATSAPP_WEBHOOK_IGNORED object=%s", str(payload.get("object"))[:40])
        return counts
    for entry in payload.get("entry") or []:
        if not isinstance(entry, dict):
            raise MalformedPayload("entry is not an object")
        for change in entry.get("changes") or []:
            if not isinstance(change, dict):
                raise MalformedPayload("change is not an object")
            field = str(change.get("field") or "")[:60]
            value = change.get("value") if isinstance(change.get("value"), dict) else {}
            if field != "messages":
                if store.claim_event(db, f"change:{field}:{_digest(change)}", field or "unknown"):
                    counts["other"] += 1
                    logger.info("WHATSAPP_WEBHOOK_EVENT field=%s", field)
                else:
                    counts["duplicates"] += 1
                continue
            for item in value.get("statuses") or []:
                _status(db, item, counts)
            for item in value.get("messages") or []:
                _inbound(db, item, counts)
    return counts


def _status(db: Session, item: Any, counts: dict[str, int]) -> None:
    if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
        raise MalformedPayload("status without a message id")
    wamid, status = item["id"][:200], str(item.get("status") or "")
    if status not in DELIVERY_STATUSES:
        counts["ignored"] += 1
        logger.info("WHATSAPP_STATUS_IGNORED wamid=%s status=%s", wamid, status[:20])
        return
    if not store.claim_event(db, f"status:{wamid}:{status}", "status"):
        counts["duplicates"] += 1
        return
    code, title = _first_error(item)
    pricing = item.get("pricing") if isinstance(item.get("pricing"), dict) else {}
    outcome = store.apply_status(
        db,
        wamid=wamid,
        status=status,
        recipient_digits=str(item.get("recipient_id") or ""),
        at=_ts(item.get("timestamp")),
        error_code=code,
        error_title=title,
        pricing_category=pricing.get("category"),
    )
    counts["statuses"] += 1
    if status == "failed":
        # 131049 (per-user marketing limit) must not be retried for 24 hours; nothing here resends.
        logger.warning(
            "WHATSAPP_MESSAGE_FAILED wamid=%s to=%s error_code=%s outcome=%s",
            wamid, store.mask(item.get("recipient_id")), code, outcome,
        )
    else:
        logger.info("WHATSAPP_STATUS wamid=%s status=%s outcome=%s", wamid, status, outcome)


def _inbound(db: Session, item: Any, counts: dict[str, int]) -> None:
    if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not item["id"]:
        raise MalformedPayload("message without an id")
    if not store.claim_event(db, f"message:{item['id'][:200]}", "message"):
        counts["duplicates"] += 1
        return
    counts["messages"] += 1
    # Inbound replies are not handled yet (Phase 1); only the fact and type are recorded, never the text.
    logger.info(
        "WHATSAPP_INBOUND id=%s from=%s type=%s",
        item["id"][:200], store.mask(item.get("from")), str(item.get("type") or "")[:20],
    )
