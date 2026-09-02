"""Booking state machine — server-authoritative transitions."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

# Primary booking.status values
ALLOWED = {
    "pending",
    "pending_acceptance",
    "confirmed",
    "in_progress",
    "completed",
    "cancelled",
    "rejected",
}

TRANSITIONS: dict[str, set[str]] = {
    "pending": {"pending_acceptance", "confirmed", "cancelled"},
    "pending_acceptance": {"confirmed", "rejected", "cancelled"},
    "confirmed": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
    "rejected": set(),
}


def assert_transition(current: str, new: str) -> None:
    if new not in ALLOWED:
        raise HTTPException(400, f"Invalid status {new}")
    allowed = TRANSITIONS.get(current, set())
    if new not in allowed:
        raise HTTPException(400, f"Cannot transition from {current} to {new}")


def set_booking_status(
    db: Session,
    booking_id: str,
    new_status: str,
    *,
    actor_id: str | None = None,
) -> None:
    row = db.execute(
        text("SELECT status FROM bookings WHERE id = CAST(:id AS uuid) FOR UPDATE"),
        {"id": booking_id},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Booking not found")
    current = row["status"]
    assert_transition(current, new_status)
    extras = ""
    params: dict = {"id": booking_id, "st": new_status}
    if new_status == "in_progress":
        extras = ", started_at = COALESCE(started_at, NOW())"
    elif new_status == "completed":
        extras = ", completed_at = COALESCE(completed_at, NOW()), rating_status = 'pending', settlement_status = CASE WHEN settlement_status = 'legacy' THEN 'legacy' ELSE 'pending' END"
    elif new_status == "confirmed":
        extras = ", accepted_at = COALESCE(accepted_at, NOW())"
    db.execute(
        text(f"UPDATE bookings SET status = :st{extras} WHERE id = CAST(:id AS uuid)"),
        params,
    )
