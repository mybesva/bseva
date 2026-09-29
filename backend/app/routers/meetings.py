"""Public meeting invite endpoints — virtual puja and seva events."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.meetings.service import public_invite_url_for
from app.seva.helpers import get_event
from app.seva.registrations import registration_can_join

router = APIRouter(tags=["meetings"])


def _meet_ready(url: str | None) -> bool:
    return bool(url) and "meet.bseva.example" not in str(url)


@router.get("/meetings/invite/{token}")
def public_meeting_invite(token: str, db: Session = Depends(get_db)):
    """Public join page data — no auth. Token acts as the invite secret."""
    tok = (token or "").strip()
    if len(tok) < 16:
        raise HTTPException(404, "Invite not found")

    # Virtual puja booking (existing behavior)
    row = db.execute(
        text(
            """
            SELECT b.id, b.booking_number, b.booking_date, b.start_time, b.end_time,
                   b.mode, b.status, b.meeting_url, b.meeting_invite_token,
                   s.name AS service_name
            FROM bookings b
            JOIN services s ON s.id = b.service_id
            WHERE b.meeting_invite_token = :tok
            LIMIT 1
            """
        ),
        {"tok": tok},
    ).mappings().first()
    if row:
        if str(row.get("mode") or "") != "virtual":
            raise HTTPException(400, "This booking is not a virtual puja")
        if str(row.get("status") or "") in ("cancelled", "rejected", "refunded"):
            raise HTTPException(410, "This booking is no longer active")
        meet = row.get("meeting_url")
        ready = _meet_ready(meet)
        return {
            "kind": "booking",
            "booking_id": str(row["id"]),
            "booking_number": row.get("booking_number"),
            "service_name": row.get("service_name"),
            "booking_date": str(row.get("booking_date") or "")[:10],
            "start_time": str(row.get("start_time") or "")[:8],
            "end_time": str(row.get("end_time") or "")[:8] if row.get("end_time") else None,
            "status": row.get("status"),
            "meeting_url": meet if ready else None,
            "public_invite_url": public_invite_url_for(tok),
            "ready": ready,
            "message": None
            if ready
            else "Google Meet link is being prepared. It will appear here once the virtual session is ready.",
        }

    # Seva event — public event token (pujari/admin) or per-registration token
    reg = db.execute(
        text(
            """
            SELECT r.*, e.title AS event_title, e.start_at, e.end_at, e.meeting_url,
                   e.meeting_invite_token AS event_invite_token, e.online_enabled,
                   e.participation_mode, e.status AS event_status, s.name AS service_name
            FROM seva_event_registrations r
            JOIN seva_events e ON e.id = r.event_id
            JOIN services s ON s.id = e.service_id
            WHERE r.join_token = :tok
            LIMIT 1
            """
        ),
        {"tok": tok},
    ).mappings().first()
    if reg:
        event = get_event(db, str(reg["event_id"]), published_only=False)
        if not event:
            raise HTTPException(404, "Invite not found")
        ok, msg = registration_can_join(db, dict(reg), event)
        if not ok and msg and "30 minutes" not in (msg or ""):
            raise HTTPException(403, msg)
        meet = reg.get("meeting_url") or event.get("meeting_url")
        ready = _meet_ready(meet)
        start = event.get("start_at")
        return {
            "kind": "seva_registration",
            "registration_id": str(reg["id"]),
            "registration_number": reg.get("registration_number"),
            "event_id": str(reg["event_id"]),
            "service_name": event.get("title") or reg.get("service_name"),
            "booking_date": str(start or "")[:10],
            "start_time": str(start or "")[11:19] if start else None,
            "end_time": str(event.get("end_at") or "")[11:19] if event.get("end_at") else None,
            "status": reg.get("status"),
            "meeting_url": meet if ready and ok else None,
            "public_invite_url": public_invite_url_for(tok),
            "ready": ready and ok,
            "message": msg if not ok else (
                None
                if ready
                else "Google Meet link is being prepared. It will appear here once the session is ready."
            ),
        }

    # Event-level tokens are operational only (pujari/admin) — never public join bypass.
    raise HTTPException(404, "Invite not found")
