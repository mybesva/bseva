"""Booking notifications on WhatsApp through MSG91's template API.

Callers only say what happened: `notify(db, "booking_cancelled", booking_id, user_id)`. The message is
queued on the caller's session and sent after that session commits (nothing is sent for a change that
rolls back). Each send runs on a background thread with its own database session: it reloads the booking,
builds the template values and looks up the recipient's number, so a slow MSG91 never slows a request.

Safety:
- Off unless MSG91_WHATSAPP_ENABLED is true and MSG91_AUTHKEY is set.
- Outside production only numbers in WHATSAPP_RECIPIENT_ALLOWLIST are messaged (an empty list sends nothing),
  and the qa_-prefixed templates are used, so QA links point at qa.b-seva.com.
- Each (event, booking, person, booking time) is sent at most once (job_dedupe), so a retried task or a job
  that runs again never repeats a message.
- Calls go out over IPv4 only, because MSG91 checks the caller against IPv4 addresses whitelisted on the key.
- Only a connection that never opened is retried. Template values (names, dates) are never logged or stored.
"""
from __future__ import annotations

import logging
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, time
from typing import Any, Callable

import httpx
from sqlalchemy import event as sa_event
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.whatsapp import store

logger = logging.getLogger("bseva.whatsapp.msg91")

URL = "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/"
LANGUAGE = "en"

# Event -> production template name. QA adds "qa_" (see template_name). All take five body values.
TEMPLATES: dict[str, str] = {
    "booking_confirmed": "bseva_booking_confirmed",
    "booking_reminder": "booking_reminder",
    "booking_cancelled": "booking_cancelled",
    "booking_rescheduled": "booking_rescheduled",
    "pujari_new_booking": "pujari_new_booking",
    "pujari_booking_reminder": "pujari_booking_reminder",
    "pujari_location_available": "pujari_location_available",
    "pujari_booking_cancelled": "pujari_booking_cancelled",
    "pujari_booking_rescheduled": "pujari_booking_rescheduled",
}
CUSTOMER_EVENTS = {"booking_confirmed", "booking_reminder", "booking_cancelled", "booking_rescheduled"}
# Approved templates whose "View booking" button URL ends in {{1}} = the booking id.
URL_BUTTON_TEMPLATES = {"qa_pujari_new_booking"}

# Replaced in tests: `dispatch` runs a send (default: background thread), `http_client_factory` makes the client.
_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="msg91")
dispatch: Callable[[Callable[[], Any]], Any] = _executor.submit


def _session_factory() -> Session:
    from app.db import SessionLocal

    return SessionLocal()


session_factory: Callable[[], Session] = _session_factory


def _make_client() -> httpx.Client:
    # local_address 0.0.0.0 makes the connection IPv4; retries=2 retries only a connection that failed to open.
    return httpx.Client(
        timeout=settings.msg91_request_timeout_seconds,
        transport=httpx.HTTPTransport(local_address="0.0.0.0", retries=2),
    )


http_client_factory: Callable[[], httpx.Client] = _make_client


def _production() -> bool:
    return (settings.environment or "").strip().lower() == "production"


def enabled() -> bool:
    return bool(settings.msg91_whatsapp_enabled and settings.msg91_authkey.strip())


def template_name(event: str) -> str:
    base = TEMPLATES[event]
    return base if _production() else f"qa_{base}"


def clean_value(value: Any, limit: int = 60) -> str:
    """WhatsApp refuses template values with newlines, tabs or long runs of spaces."""
    s = re.sub(r"\s+", " ", str(value or "")).strip()
    return (s[:limit].rstrip() or "-")


def format_date(value: Any) -> str:
    if isinstance(value, datetime):
        value = value.date()
    if isinstance(value, str):
        try:
            value = date.fromisoformat(value[:10])
        except ValueError:
            return clean_value(value)
    if isinstance(value, date):
        return f"{value.day} {value.strftime('%b %Y')}"
    return "-"


def format_time(value: Any) -> str:
    if isinstance(value, str):
        try:
            value = time.fromisoformat(value[:8])
        except ValueError:
            return clean_value(value)
    if isinstance(value, time):
        return value.strftime("%I:%M %p").lstrip("0")
    return "-"


def area_of(booking: dict) -> str:
    """Only the area (last part of the location label): the pujari sees the address closer to the puja."""
    if str(booking.get("mode") or "") == "virtual":
        return "Online"
    label = str(booking.get("location_label") or "").strip()
    parts = [p.strip() for p in label.split(",") if p.strip()]
    return parts[-1] if parts else "your area"


def payload(to: str, template: str, values: list[str], button: str | None = None) -> dict:
    components: dict[str, Any] = {f"body_{i}": {"type": "text", "value": v} for i, v in enumerate(values, 1)}
    if button:
        components["button_1"] = {"subtype": "url", "type": "text", "value": button}
    return {
        "integrated_number": settings.msg91_whatsapp_number.strip(),
        "content_type": "template",
        "payload": {
            "messaging_product": "whatsapp",
            "type": "template",
            "template": {
                "name": template,
                "language": {"code": LANGUAGE, "policy": "deterministic"},
                "namespace": settings.msg91_template_namespace.strip(),
                "to_and_components": [{"to": [to], "components": components}],
            },
        },
    }


def _record(digits: str, purpose: str, template: str, status: str, request_id: str | None, error: str | None) -> None:
    try:
        db = session_factory()
        try:
            store.record_outbound(
                db, digits=digits, purpose=purpose, template_name=template, language=LANGUAGE, status=status,
                attempts=1, wamid=f"msg91:{request_id}" if request_id else None, error_title=error,
            )
            db.commit()
        finally:
            db.close()
    except Exception:
        logger.exception("MSG91_LOG_WRITE_FAILED template=%s", template)


def send_template(*, to: str, template: str, values: list[str], button: str | None = None, purpose: str) -> dict:
    """Send one approved template now. Returns {"ok", "status", ...}; never raises for delivery problems."""
    if not enabled():
        return {"ok": False, "status": "disabled"}
    try:
        digits = store.normalize_recipient(to)
    except store.InvalidRecipient:
        return {"ok": False, "status": "invalid_recipient"}
    from app.whatsapp.client import recipient_allowed

    if not recipient_allowed(digits):
        logger.info("MSG91_RECIPIENT_NOT_ALLOWED to=%s purpose=%s", store.mask(digits), purpose)
        return {"ok": False, "status": "not_allowed"}
    headers = {"authkey": settings.msg91_authkey.strip(), "Content-Type": "application/json", "Accept": "application/json"}
    body = payload(digits, template, values, button)
    error: str | None = None
    request_id: str | None = None
    try:
        with http_client_factory() as http:
            resp = http.post(URL, json=body, headers=headers)
        try:
            data = resp.json()
        except ValueError:
            data = {}
        if resp.status_code == 200 and isinstance(data, dict) and not data.get("hasError") and data.get("request_id"):
            request_id = str(data["request_id"])[:100]
        else:
            # MSG91 errors carry no message content; keep a short code for the log (e.g. 401 apiError 418 = IP).
            api_error = data.get("apiError") if isinstance(data, dict) else None
            error = f"http {resp.status_code}" + (f" apiError {api_error}" if api_error else "")
    except httpx.HTTPError as exc:
        # A timeout after connecting may still have been accepted: never sent again.
        error = type(exc).__name__
    if request_id:
        _record(digits, purpose, template, "accepted", request_id, None)
        logger.info("MSG91_SENT request_id=%s to=%s template=%s", request_id, store.mask(digits), template)
        return {"ok": True, "status": "accepted", "request_id": request_id}
    _record(digits, purpose, template, "send_failed", None, error)
    logger.warning("MSG91_SEND_FAILED to=%s template=%s error=%s", store.mask(digits), template, error)
    return {"ok": False, "status": "send_failed", "error": error}


# ---------------------------------------------------------------- booking events


def _load(db: Session, booking_id: str, user_id: str, pujari: bool) -> tuple[dict | None, dict | None]:
    b = db.execute(
        text(
            """
            SELECT id, booking_number, service_id, booking_date, start_time, mode, location_label
            FROM bookings WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": booking_id},
    ).mappings().first()
    if pujari:
        person = db.execute(
            text(
                """
                SELECT u.name, COALESCE(NULLIF(TRIM(pp.whatsapp_number), ''), NULLIF(TRIM(pp.mobile_number), ''), u.phone) AS phone
                FROM users u LEFT JOIN pujari_profiles pp ON pp.user_id = u.id
                WHERE u.id = CAST(:id AS uuid)
                """
            ),
            {"id": user_id},
        ).mappings().first()
    else:
        person = db.execute(
            text("SELECT name, phone FROM users WHERE id = CAST(:id AS uuid)"), {"id": user_id}
        ).mappings().first()
    return (dict(b) if b else None), (dict(person) if person else None)


def build_values(event: str, booking: dict, person_name: str, service_name: str) -> tuple[list[str], str | None]:
    who = clean_value(person_name, 40) if person_name and person_name.strip() else (
        "Customer" if event in CUSTOMER_EVENTS else "Pujari ji"
    )
    last = area_of(booking) if event == "pujari_new_booking" else str(booking.get("booking_number") or "")
    values = [
        who,
        clean_value(service_name or "Puja"),
        format_date(booking.get("booking_date")),
        format_time(booking.get("start_time")),
        clean_value(last, 40),
    ]
    button = str(booking["id"]) if template_name(event) in URL_BUTTON_TEMPLATES else None
    return values, button


def deliver(event: str, booking_id: str, user_id: str) -> dict:
    """Load the booking and person, claim the once-only key and send. Runs on the background thread."""
    from app.catalog import localized_service_name
    from app.jobs.dedupe import claim_once

    db = session_factory()
    try:
        booking, person = _load(db, booking_id, user_id, pujari=event not in CUSTOMER_EVENTS)
        if not booking or not person:
            return {"ok": False, "status": "not_found"}
        if not person.get("phone"):
            return {"ok": False, "status": "no_phone"}
        key = f"wa:{event}:{booking_id}:{user_id}:{booking.get('booking_date')}T{booking.get('start_time')}"
        if not claim_once(db, key):
            return {"ok": False, "status": "duplicate"}
        db.commit()
        service = localized_service_name(db, str(booking["service_id"]), LANGUAGE)
        values, button = build_values(event, booking, str(person.get("name") or ""), service)
        phone = str(person["phone"])
    finally:
        db.close()
    return send_template(to=phone, template=template_name(event), values=values, button=button, purpose=event)


def _run(event: str, booking_id: str, user_id: str) -> None:
    try:
        deliver(event, booking_id, user_id)
    except Exception:
        logger.exception("MSG91_NOTIFY_FAILED event=%s booking=%s", event, booking_id)


def _flush(session: Session) -> None:
    pending = session.info.pop("msg91_pending", None) or []
    for event, booking_id, user_id in pending:
        try:
            dispatch(lambda e=event, b=booking_id, u=user_id: _run(e, b, u))
        except Exception:
            logger.exception("MSG91_DISPATCH_FAILED event=%s", event)


def _discard(session: Session) -> None:
    session.info.pop("msg91_pending", None)


def notify(db: Session, event: str, booking_id: Any, user_id: Any) -> None:
    """Queue one booking WhatsApp for after `db` commits. Never raises; does nothing while switched off."""
    try:
        if event not in TEMPLATES or not booking_id or not user_id or not enabled():
            return
        pending = db.info.setdefault("msg91_pending", [])
        item = (event, str(booking_id), str(user_id))
        if item in pending:
            return
        pending.append(item)
        if not db.info.get("msg91_hooked"):
            db.info["msg91_hooked"] = True
            sa_event.listen(db, "after_commit", _flush)
            sa_event.listen(db, "after_rollback", _discard)
    except Exception:
        logger.exception("MSG91_QUEUE_FAILED event=%s", event)
