"""Google Meet integration for Seva events (group puja, pravachan)."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.mail.smtp_config import app_base_url
from app.meetings.google_meet import create_google_meet_event, google_meet_configured
from app.meetings.service import public_invite_url_for

logger = logging.getLogger(__name__)


def ensure_event_meeting(
    db: Session,
    event: dict[str, Any],
    *,
    service_name: str = "Seva Event",
    pujari_email: str | None = None,
    duration_minutes: int = 90,
) -> dict[str, Any]:
    """Ensure invite token + Google Meet for online/hybrid seva events."""
    eid = str(event.get("id") or "")
    if not eid or not event.get("online_enabled"):
        return {}
    if str(event.get("participation_mode") or "") not in ("online", "hybrid"):
        return {}

    token = event.get("meeting_invite_token")
    if not token:
        token = uuid4().hex
        db.execute(
            text(
                """
                UPDATE seva_events
                SET meeting_invite_token = :tok, updated_at = NOW()
                WHERE id = CAST(:id AS uuid) AND meeting_invite_token IS NULL
                """
            ),
            {"tok": token, "id": eid},
        )

    meeting_url = event.get("meeting_url")
    event_id = event.get("google_calendar_event_id")
    start_raw = event.get("start_at")
    end_raw = event.get("end_at")
    try:
        start_dt = datetime.fromisoformat(str(start_raw).replace("Z", "+00:00"))
        if end_raw:
            end_dt = datetime.fromisoformat(str(end_raw).replace("Z", "+00:00"))
        else:
            end_dt = start_dt + timedelta(minutes=max(15, int(duration_minutes or 90)))
    except Exception:
        return {
            "meeting_url": meeting_url,
            "meeting_invite_token": token,
            "public_invite_url": public_invite_url_for(str(token) if token else None),
        }

    if google_meet_configured() and not meeting_url:
        title = event.get("title") or service_name
        desc = (
            f"BSeva live seva\nEvent: {title}\nPublic join: {public_invite_url_for(str(token))}\n"
        )
        try:
            created = create_google_meet_event(
                summary=f"BSeva Live — {title}",
                description=desc,
                start=start_dt,
                end=end_dt,
                attendee_emails=[pujari_email] if pujari_email else [],
                request_id=f"bseva-event-{eid}",
            )
            meeting_url = created["meeting_url"]
            event_id = created.get("google_calendar_event_id")
            db.execute(
                text(
                    """
                    UPDATE seva_events
                    SET meeting_url = :url, google_calendar_event_id = :eid, updated_at = NOW()
                    WHERE id = CAST(:id AS uuid)
                    """
                ),
                {"url": meeting_url, "eid": event_id, "id": eid},
            )
        except Exception:
            logger.exception("Failed to create Google Meet for event %s", eid)

    return {
        "meeting_url": meeting_url,
        "meeting_invite_token": token,
        "public_invite_url": public_invite_url_for(str(token) if token else None),
        "google_calendar_event_id": event_id,
    }
