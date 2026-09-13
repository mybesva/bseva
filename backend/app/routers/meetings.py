"""Public virtual-puja meeting invite endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.meetings.service import public_invite_url_for

router = APIRouter(tags=["meetings"])


@router.get("/meetings/invite/{token}")
def public_meeting_invite(token: str, db: Session = Depends(get_db)):
    """Public join page data — no auth. Token acts as the invite secret."""
    tok = (token or "").strip()
    if len(tok) < 16:
        raise HTTPException(404, "Invite not found")

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
    if not row:
        raise HTTPException(404, "Invite not found")
    if str(row.get("mode") or "") != "virtual":
        raise HTTPException(400, "This booking is not a virtual puja")
    if str(row.get("status") or "") in ("cancelled", "rejected", "refunded"):
        raise HTTPException(410, "This booking is no longer active")

    meet = row.get("meeting_url")
    ready = bool(meet) and "meet.bseva.example" not in str(meet)
    return {
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
