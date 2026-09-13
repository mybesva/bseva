"""Ensure virtual bookings have Meet link + public invite token."""
from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.mail.smtp_config import app_base_url
from app.meetings.google_meet import (
    create_google_meet_event,
    google_meet_configured,
    patch_google_meet_attendees,
)

logger = logging.getLogger(__name__)


def ensure_meeting_columns(db: Session) -> None:
    db.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meeting_url TEXT"))
    db.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT"))
    db.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS meeting_invite_token TEXT"))


def public_invite_url_for(token: str | None) -> str | None:
    if not token:
        return None
    return f"{app_base_url()}/join/{token}"


def _as_date(v: Any) -> date | None:
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str) and v:
        return date.fromisoformat(v[:10])
    return None


def _as_time(v: Any) -> time | None:
    if isinstance(v, time):
        return v
    if isinstance(v, datetime):
        return v.time()
    if isinstance(v, str) and v:
        parts = v.split(":")
        return time(int(parts[0]), int(parts[1]), int(parts[2]) if len(parts) > 2 else 0)
    return None


def _is_real_meet_url(url: str | None) -> bool:
    if not url:
        return False
    u = url.lower()
    return "meet.google.com" in u or "google.com/calendar" in u


def ensure_virtual_meeting(
    db: Session,
    booking: dict[str, Any],
    *,
    service_name: str = "Virtual Puja",
    customer_email: str | None = None,
    pujari_email: str | None = None,
    duration_minutes: int = 90,
    send_google_invites: bool = True,
) -> dict[str, Any]:
    """
    For virtual bookings: ensure invite token + (when configured) Google Meet link.
    Safe to call multiple times; returns meeting fields for the booking.
    """
    ensure_meeting_columns(db)
    bid = str(booking.get("id") or "")
    if not bid:
        return {}
    if str(booking.get("mode") or "") != "virtual":
        return {
            "meeting_url": booking.get("meeting_url"),
            "meeting_invite_token": booking.get("meeting_invite_token"),
            "public_invite_url": public_invite_url_for(booking.get("meeting_invite_token")),
            "google_calendar_event_id": booking.get("google_calendar_event_id"),
        }

    token = booking.get("meeting_invite_token")
    if not token:
        token = uuid4().hex
        db.execute(
            text(
                """
                UPDATE bookings
                SET meeting_invite_token = :tok
                WHERE id = CAST(:id AS uuid) AND meeting_invite_token IS NULL
                """
            ),
            {"tok": token, "id": bid},
        )
        # reload if race
        row = db.execute(
            text("SELECT meeting_invite_token FROM bookings WHERE id = CAST(:id AS uuid)"),
            {"id": bid},
        ).first()
        token = (row[0] if row and row[0] else token)

    meeting_url = booking.get("meeting_url")
    event_id = booking.get("google_calendar_event_id")
    attendees = [e for e in [customer_email, pujari_email] if e]

    if google_meet_configured() and not _is_real_meet_url(meeting_url):
        bd = _as_date(booking.get("booking_date"))
        st = _as_time(booking.get("start_time"))
        et = _as_time(booking.get("end_time"))
        if bd and st:
            start_dt = datetime.combine(bd, st)
            if et:
                end_dt = datetime.combine(bd, et)
            else:
                end_dt = start_dt + timedelta(minutes=max(15, int(duration_minutes or 90)))
            number = booking.get("booking_number") or bid[:8]
            desc = (
                f"BSeva virtual puja\n"
                f"Booking: {number}\n"
                f"Service: {service_name}\n"
                f"Public join page: {public_invite_url_for(token)}\n"
            )
            try:
                created = create_google_meet_event(
                    summary=f"BSeva Virtual Puja — {service_name} ({number})",
                    description=desc,
                    start=start_dt,
                    end=end_dt,
                    attendee_emails=attendees if send_google_invites else [],
                    request_id=f"bseva-{bid}",
                )
                meeting_url = created["meeting_url"]
                event_id = created.get("google_calendar_event_id")
                db.execute(
                    text(
                        """
                        UPDATE bookings
                        SET meeting_url = :url,
                            google_calendar_event_id = :eid
                        WHERE id = CAST(:id AS uuid)
                        """
                    ),
                    {"url": meeting_url, "eid": event_id, "id": bid},
                )
            except Exception:
                logger.exception("Failed to create Google Meet for booking %s", bid)
    elif google_meet_configured() and event_id and attendees and send_google_invites:
        try:
            patch_google_meet_attendees(event_id=str(event_id), attendee_emails=attendees)
        except Exception:
            logger.exception("Failed to update Meet attendees for booking %s", bid)

    # Clear obsolete placeholder demo links
    if meeting_url and "meet.bseva.example" in str(meeting_url) and not google_meet_configured():
        meeting_url = None
        db.execute(
            text("UPDATE bookings SET meeting_url = NULL WHERE id = CAST(:id AS uuid)"),
            {"id": bid},
        )

    public = public_invite_url_for(str(token) if token else None)
    return {
        "meeting_url": meeting_url,
        "meeting_invite_token": token,
        "public_invite_url": public,
        "google_calendar_event_id": event_id,
    }
