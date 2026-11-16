"""Send approved template messages through the WhatsApp Cloud API (POST /<PHONE_NUMBER_ID>/messages).

Off unless WHATSAPP_SEND_ENABLED is true, and refused in production by app.config for now. Outside production
only numbers in WHATSAPP_RECIPIENT_ALLOWLIST can be messaged, so Meta's test number and QA never reach a
real customer. Works the same with Meta's test number: only the Phone Number ID and token differ.

A send is retried only when it certainly did not reach Meta (connection refused, 429, 5xx, or a throttling
error code), never after a timeout on an accepted connection, so a code is not delivered twice.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Callable

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.whatsapp import store

logger = logging.getLogger("bseva.whatsapp")

GRAPH_BASE = "https://graph.facebook.com"
# Meta error codes for throttling or a temporary outage: safe to try again after a pause.
RETRYABLE_ERROR_CODES = {1, 2, 4, 80007, 130429, 131016}
BACKOFF_SECONDS = (0.5, 1.5, 3.0)

# Replaced in tests; production code always uses a real httpx client.
http_client_factory: Callable[[], httpx.Client] = lambda: httpx.Client(
    timeout=settings.whatsapp_request_timeout_seconds
)
sleep: Callable[[float], None] = time.sleep


def _production() -> bool:
    return (settings.environment or "").strip().lower() == "production"


def allowlist() -> set[str]:
    out = set()
    for raw in (settings.whatsapp_recipient_allowlist or "").split(","):
        if raw.strip():
            try:
                out.add(store.normalize_recipient(raw))
            except store.InvalidRecipient:
                logger.warning("WHATSAPP_ALLOWLIST_ENTRY_INVALID entry=%s", store.mask(raw))
    return out


def recipient_allowed(digits: str) -> bool:
    allowed = allowlist()
    if allowed:
        return digits in allowed
    # No list: nothing may be sent outside production (QA and local can never reach a real customer).
    return _production()


def template_payload(digits: str, template_name: str, language: str, components: list[dict] | None) -> dict:
    template: dict[str, Any] = {"name": template_name, "language": {"code": language}}
    if components:
        template["components"] = components
    return {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": digits,
        "type": "template",
        "template": template,
    }


def _error(resp: httpx.Response) -> tuple[int | None, str | None]:
    try:
        err = resp.json().get("error") or {}
    except (ValueError, AttributeError):
        return None, None
    code = err.get("code")
    title = err.get("error_user_title") or err.get("type") or ""
    return (code if isinstance(code, int) else None), str(title)[:200] or None


def send_template(
    db: Session,
    *,
    to: str,
    template_name: str,
    language: str = "en",
    components: list[dict] | None = None,
    purpose: str = "test",
) -> dict[str, Any]:
    """Send one approved template. Returns {"ok", "status", ...}; never raises for delivery problems.

    `components` can carry a one-time code: it goes only to Meta and is never logged or stored."""
    if not settings.whatsapp_send_enabled:
        return {"ok": False, "status": "disabled"}
    token, phone_id = settings.whatsapp_access_token.strip(), settings.whatsapp_phone_number_id.strip()
    if not token or not phone_id or not phone_id.isdigit():
        logger.error("WHATSAPP_NOT_CONFIGURED token=%s phone_number_id=%s", bool(token), bool(phone_id))
        return {"ok": False, "status": "not_configured"}
    try:
        digits = store.normalize_recipient(to)
    except store.InvalidRecipient:
        return {"ok": False, "status": "invalid_recipient"}
    if not recipient_allowed(digits):
        logger.warning("WHATSAPP_RECIPIENT_NOT_ALLOWED to=%s purpose=%s", store.mask(digits), purpose)
        return {"ok": False, "status": "not_allowed"}

    url = f"{GRAPH_BASE}/{settings.whatsapp_graph_api_version.strip()}/{phone_id}/messages"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    payload = template_payload(digits, template_name, language, components)
    retries = max(0, min(int(settings.whatsapp_send_retries), len(BACKOFF_SECONDS)))
    code: int | None = None
    title: str | None = None
    attempts = 0
    with http_client_factory() as http:
        for attempt in range(retries + 1):
            attempts = attempt + 1
            try:
                resp = http.post(url, json=payload, headers=headers)
            except httpx.ConnectError:
                code, title = None, "connection failed"
                if attempt < retries:
                    sleep(BACKOFF_SECONDS[attempt])
                    continue
                break
            except httpx.HTTPError as exc:
                # A timeout after connecting may still have been accepted: do not send again.
                code, title = None, type(exc).__name__
                break
            if resp.status_code == 200:
                try:
                    wamid = str(resp.json()["messages"][0]["id"])
                except (ValueError, KeyError, IndexError, TypeError):
                    wamid = None
                if wamid:
                    store.record_outbound(
                        db, digits=digits, purpose=purpose, template_name=template_name, language=language,
                        status="accepted", attempts=attempts, wamid=wamid,
                    )
                    db.commit()
                    logger.info(
                        "WHATSAPP_SENT wamid=%s to=%s template=%s purpose=%s attempts=%s",
                        wamid, store.mask(digits), template_name, purpose, attempts,
                    )
                    return {"ok": True, "status": "accepted", "wamid": wamid, "attempts": attempts}
                code, title = None, "unexpected response"
                break
            code, title = _error(resp)
            if (resp.status_code == 429 or resp.status_code >= 500 or code in RETRYABLE_ERROR_CODES) and attempt < retries:
                sleep(BACKOFF_SECONDS[attempt])
                continue
            break

    store.record_outbound(
        db, digits=digits, purpose=purpose, template_name=template_name, language=language,
        status="send_failed", attempts=attempts, error_code=code, error_title=title,
    )
    db.commit()
    logger.warning(
        "WHATSAPP_SEND_FAILED to=%s template=%s purpose=%s attempts=%s error_code=%s",
        store.mask(digits), template_name, purpose, attempts, code,
    )
    return {"ok": False, "status": "send_failed", "error_code": code, "attempts": attempts}
