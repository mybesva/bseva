"""Pujari schedule: confirmed bookings + service duration + configurable buffer."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.platform_config import get_setting

_BLOCKING_STATUSES = ("confirmed", "in_progress")


def pujari_schedule_buffer_hours(db: Session) -> float:
    raw = get_setting(db, "pujari_schedule_buffer_hours", 4)
    try:
        h = float(raw)
    except (TypeError, ValueError):
        h = 4.0
    return max(0.0, min(h, 24.0))


def _combine(d: date, t: time) -> datetime:
    return datetime.combine(d, t)


def _service_duration_minutes(db: Session, service_id) -> int:
    if not service_id:
        return 90
    row = db.execute(
        text("SELECT duration_minutes FROM services WHERE id = CAST(:id AS uuid)"),
        {"id": str(service_id)},
    ).first()
    return int(row[0] or 90) if row else 90


def booking_end_datetime(db: Session, booking_date: date, start_time: time, end_time: time | None, service_id) -> datetime:
    start = _combine(booking_date, start_time)
    if end_time is not None:
        end = _combine(booking_date, end_time)
        if end <= start:
            end += timedelta(days=1)
        return end
    dur = _service_duration_minutes(db, service_id)
    return start + timedelta(minutes=dur)


def blocked_interval(
    db: Session,
    booking_date: date,
    start_time: time,
    end_time: time | None,
    service_id,
) -> tuple[datetime, datetime]:
    """Unavailable window: (start − buffer) through (end + buffer)."""
    buf = timedelta(hours=pujari_schedule_buffer_hours(db))
    start = _combine(booking_date, start_time)
    end = booking_end_datetime(db, booking_date, start_time, end_time, service_id)
    return start - buf, end + buf


def _intervals_overlap(a: tuple[datetime, datetime], b: tuple[datetime, datetime]) -> bool:
    return a[0] < b[1] and b[0] < a[1]


def _blocking_bookings(db: Session, pujari_id: str, exclude_booking_id: str | None = None) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT b.id, b.booking_date, b.start_time, b.end_time, b.service_id, s.duration_minutes
            FROM bookings b
            JOIN services s ON s.id = b.service_id
            WHERE b.pujari_id = CAST(:pid AS uuid)
              AND b.status IN ('confirmed', 'in_progress')
            """
        ),
        {"pid": pujari_id},
    ).mappings().all()
    out = []
    for r in rows:
        if exclude_booking_id and str(r["id"]) == str(exclude_booking_id):
            continue
        out.append(dict(r))
    return out


def pujari_has_schedule_conflict(
    db: Session,
    pujari_id: str,
    booking_date: date,
    start_time: time,
    end_time: time | None,
    service_id,
    *,
    exclude_booking_id: str | None = None,
) -> bool:
    """True if proposed puja overlaps a confirmed/in_progress puja (with one buffer between them).

    Example: 10:00–12:00 confirmed with 4h buffer → next puja may start at 16:00 (not 20:00).
    """
    buf = timedelta(hours=pujari_schedule_buffer_hours(db))
    p_start = _combine(booking_date, start_time)
    p_end = booking_end_datetime(db, booking_date, start_time, end_time, service_id)
    for existing in _blocking_bookings(db, pujari_id, exclude_booking_id):
        if existing["booking_date"] != booking_date:
            continue
        e_start = _combine(existing["booking_date"], existing["start_time"])
        e_end = booking_end_datetime(
            db,
            existing["booking_date"],
            existing["start_time"],
            existing.get("end_time"),
            existing.get("service_id"),
        )
        if p_start < e_end + buf and e_start < p_end + buf:
            return True
    return False


def assert_pujari_available_for_booking(
    db: Session,
    pujari_id: str,
    booking: dict,
    *,
    exclude_booking_id: str | None = None,
) -> None:
    if pujari_has_schedule_conflict(
        db,
        pujari_id,
        booking["booking_date"],
        booking["start_time"],
        booking.get("end_time"),
        booking.get("service_id"),
        exclude_booking_id=exclude_booking_id or str(booking.get("id") or ""),
    ):
        raise HTTPException(
            409,
            "You are not available for this puja time. Another confirmed booking and the required buffer overlap this slot. Please reject this request or contact support if you believe this is an error.",
        )


def pujari_free_for_slot(
    db: Session,
    pujari_id: str,
    booking_date: date,
    start: time,
    end: time,
    service_id,
    *,
    exclude_booking_id: str | None = None,
) -> bool:
    from app.domain import pujari_blocked_on_slot

    if pujari_blocked_on_slot(db, pujari_id, booking_date, start, end):
        return False
    return not pujari_has_schedule_conflict(
        db,
        pujari_id,
        booking_date,
        start,
        end,
        service_id,
        exclude_booking_id=exclude_booking_id,
    )
