"""Booking start validation — same lead-time rules as POST /bookings.

Web uses a free time input; mobile uses any HH:MM. This module validates a
proposed start without exposing pujari identities or imposing slot grids.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.pujari_schedule import pujari_schedule_buffer_hours


def parse_start_time(raw: str) -> time:
    text = (raw or "").strip()
    if not text:
        raise ValueError("Start time is required")
    parts = text.split(":")
    if len(parts) < 2:
        raise ValueError("Start time must be HH:MM")
    hour = int(parts[0])
    minute = int(parts[1])
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError("Invalid start time")
    return time(hour, minute, int(parts[2]) if len(parts) > 2 else 0)


def booking_start_and_earliest(
    *,
    booking_date: date,
    start: time,
    lead_hours: int,
    mode: str,
    timezone_name: str | None,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    """Same clock comparison as POST /bookings (naive datetimes)."""
    lead = max(1, int(lead_hours or 48))
    if mode == "virtual":
        from app.timezones import to_utc

        start_at_utc = to_utc(booking_date, start, timezone_name or "Asia/Kolkata")
        booking_start = start_at_utc.replace(tzinfo=None)
        clock = now if now is not None else datetime.utcnow()
        return booking_start, clock + timedelta(hours=lead)
    booking_start = datetime.combine(booking_date, start)
    clock = now if now is not None else datetime.now()
    return booking_start, clock + timedelta(hours=lead)


def start_passes_lead(
    *,
    booking_date: date,
    start: time,
    lead_hours: int,
    mode: str,
    timezone_name: str | None,
    now: datetime | None = None,
) -> bool:
    booking_start, earliest = booking_start_and_earliest(
        booking_date=booking_date,
        start=start,
        lead_hours=lead_hours,
        mode=mode,
        timezone_name=timezone_name,
        now=now,
    )
    return booking_start >= earliest


def validate_booking_start(
    db: Session,
    *,
    service: dict,
    booking_date: date,
    start_time_raw: str,
    mode: str = "in_person",
    timezone_name: str | None = None,
    now: datetime | None = None,
) -> dict:
    lead_hours = int(service.get("booking_lead_hours") if service.get("booking_lead_hours") is not None else 48)
    if lead_hours < 1:
        lead_hours = 48
    duration = int(service.get("duration_minutes") or 90)
    mode_norm = "virtual" if mode == "virtual" else "in_person"
    tz = timezone_name or "Asia/Kolkata"
    try:
        start = parse_start_time(start_time_raw)
    except ValueError as exc:
        return {
            "valid": False,
            "reason": str(exc),
            "lead_hours": lead_hours,
            "duration_minutes": duration,
            "buffer_hours": pujari_schedule_buffer_hours(db) if db is not None else 0,
            "timezone": tz if mode_norm == "virtual" else "Asia/Kolkata",
        }
    valid = start_passes_lead(
        booking_date=booking_date,
        start=start,
        lead_hours=lead_hours,
        mode=mode_norm,
        timezone_name=tz,
        now=now,
    )
    return {
        "valid": valid,
        "start": start.strftime("%H:%M"),
        "reason": None if valid else "lead_time",
        "lead_hours": lead_hours,
        "duration_minutes": duration,
        "buffer_hours": pujari_schedule_buffer_hours(db) if db is not None else 0,
        "timezone": tz if mode_norm == "virtual" else "Asia/Kolkata",
    }
