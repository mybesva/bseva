"""Pujari live-tracking window, arrival geofence, and stop rules.

Tracking is available only while the booking is still travelling to the customer:
confirmed + inside the pre-start window + not stopped. It MUST stop on arrival,
start-OTP success (in_progress), cancel, complete, or reassignment.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, time, timezone
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain import hours_until
from app.geo import haversine_km
from app.platform_config import get_setting

logger = logging.getLogger("bseva.tracking")

STOP_ARRIVED = "arrived"
STOP_STARTED = "started"
STOP_CANCELLED = "cancelled"
STOP_COMPLETED = "completed"
STOP_REASSIGNED = "reassigned"
STOP_REJECTED = "rejected"

_TERMINAL_STOP = {
    "cancelled": STOP_CANCELLED,
    "completed": STOP_COMPLETED,
    "rejected": STOP_REJECTED,
    "in_progress": STOP_STARTED,
}


def _int_setting(db: Session, key: str, default: int) -> int:
    try:
        return int(get_setting(db, key, default) or default)
    except (TypeError, ValueError):
        return default


def location_window_minutes(db: Session) -> int:
    return max(1, _int_setting(db, "pujari_location_tracking_before_minutes", 15))


def gps_interval_seconds(db: Session) -> int:
    return max(15, _int_setting(db, "pujari_gps_update_interval_seconds", 60))


def customer_refresh_seconds(db: Session) -> int:
    return max(15, _int_setting(db, "customer_tracking_refresh_seconds", 60))


def arrival_radius_meters(db: Session) -> int:
    return max(25, _int_setting(db, "pujari_arrival_radius_meters", 100))


def arrival_confirm_pings(db: Session) -> int:
    return max(1, _int_setting(db, "pujari_arrival_confirm_pings", 2))


def within_pre_start_minutes(db: Session, booking_date, start_time, *, minutes: int) -> bool:
    """True from N minutes before scheduled start onward (no lower bound while still confirmed)."""
    if booking_date is None or start_time is None:
        return False
    hrs = hours_until(booking_date, start_time)
    return hrs * 60 <= minutes + 0.5


def tracking_is_stopped(booking: dict) -> bool:
    if booking.get("tracking_stopped_at"):
        return True
    if booking.get("arrived_at"):
        return True
    return str(booking.get("status") or "") in _TERMINAL_STOP


def tracking_should_be_active(db: Session, booking: dict) -> bool:
    status = str(booking.get("status") or "")
    if status != "confirmed":
        return False
    if not booking.get("pujari_id"):
        return False
    if tracking_is_stopped(booking):
        return False
    mode = str(booking.get("mode") or "in_person")
    if mode == "virtual":
        return False
    return within_pre_start_minutes(
        db, booking.get("booking_date"), booking.get("start_time"), minutes=location_window_minutes(db)
    )


def stop_tracking(db: Session, booking_id: str, reason: str) -> None:
    """Idempotent: first stop reason wins."""
    try:
        db.execute(
            text(
                """
                UPDATE bookings
                SET tracking_stopped_at = COALESCE(tracking_stopped_at, NOW()),
                    tracking_stop_reason = COALESCE(tracking_stop_reason, :reason)
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"id": booking_id, "reason": reason},
        )
    except Exception:
        logger.exception("TRACKING_STOP_FAILED booking=%s reason=%s", booking_id, reason)


def mark_arrived(db: Session, booking_id: str) -> None:
    try:
        db.execute(
            text(
                """
                UPDATE bookings
                SET arrived_at = COALESCE(arrived_at, NOW()),
                    tracking_stopped_at = COALESCE(tracking_stopped_at, NOW()),
                    tracking_stop_reason = COALESCE(tracking_stop_reason, :reason)
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"id": booking_id, "reason": STOP_ARRIVED},
        )
    except Exception:
        logger.exception("TRACKING_ARRIVAL_FAILED booking=%s", booking_id)


def maybe_detect_arrival(
    db: Session,
    booking: dict,
    *,
    lat: float,
    lng: float,
    accuracy_m: float | None = None,
) -> bool:
    """Return True if this ping caused arrival. Uses haversine, not Google Routes."""
    dest_lat = booking.get("latitude")
    dest_lng = booking.get("longitude")
    if dest_lat is None or dest_lng is None:
        return False
    try:
        dest_lat_f = float(dest_lat)
        dest_lng_f = float(dest_lng)
    except (TypeError, ValueError):
        return False
    radius = arrival_radius_meters(db)
    needed = arrival_confirm_pings(db)
    if accuracy_m is not None and accuracy_m > max(radius * 2, 80):
        return False
    dist_m = haversine_km(lat, lng, dest_lat_f, dest_lng_f) * 1000.0
    if dist_m > radius:
        try:
            db.execute(
                text("UPDATE bookings SET arrival_hit_count = 0 WHERE id = CAST(:id AS uuid)"),
                {"id": str(booking["id"])},
            )
        except Exception:
            pass
        return False
    try:
        row = db.execute(
            text(
                """
                UPDATE bookings
                SET arrival_hit_count = COALESCE(arrival_hit_count, 0) + 1
                WHERE id = CAST(:id AS uuid)
                RETURNING arrival_hit_count
                """
            ),
            {"id": str(booking["id"])},
        ).first()
        hits = int(row[0]) if row else 1
    except Exception:
        hits = needed
    if hits >= needed:
        mark_arrived(db, str(booking["id"]))
        logger.info("TRACKING_ARRIVED booking=%s dist_m=%.1f", booking["id"], dist_m)
        return True
    return False


def destination_pair(booking: dict) -> tuple[float | None, float | None]:
    try:
        lat = booking.get("latitude")
        lng = booking.get("longitude")
        if lat is None or lng is None:
            return None, None
        return float(lat), float(lng)
    except (TypeError, ValueError):
        return None, None


def ping_distance_m(lat: float, lng: float, booking: dict) -> float | None:
    dlat, dlng = destination_pair(booking)
    if dlat is None or dlng is None:
        return None
    return haversine_km(lat, lng, dlat, dlng) * 1000.0


def location_payload(
    db: Session,
    booking: dict,
    ping: dict | None,
    *,
    include_destination: bool,
) -> dict[str, Any]:
    active = tracking_should_be_active(db, booking)
    stopped = tracking_is_stopped(booking)
    reason = booking.get("tracking_stop_reason")
    mins = location_window_minutes(db)
    out: dict[str, Any] = {
        "available": bool(active and ping and ping.get("latitude") is not None),
        "tracking_active": active,
        "window_minutes": mins,
        "poll_interval_seconds": customer_refresh_seconds(db),
        "gps_interval_seconds": gps_interval_seconds(db),
        "arrival_radius_meters": arrival_radius_meters(db),
        "arrived": bool(booking.get("arrived_at") or reason == STOP_ARRIVED),
        "stop_reason": reason if stopped else None,
        "latitude": None,
        "longitude": None,
        "recorded_at": None,
        "accuracy_m": None,
        "distance_m": None,
        "destination_latitude": None,
        "destination_longitude": None,
        "message": None,
    }
    if include_destination:
        dlat, dlng = destination_pair(booking)
        out["destination_latitude"] = dlat
        out["destination_longitude"] = dlng
    if not active:
        if reason == STOP_ARRIVED or booking.get("arrived_at"):
            out["message"] = "Your pujari has arrived at the puja location."
        elif reason == STOP_STARTED or str(booking.get("status")) == "in_progress":
            out["message"] = "Live tracking ended when the puja started."
        elif str(booking.get("status")) in ("cancelled", "rejected"):
            out["message"] = "Tracking is not available for this booking."
        elif str(booking.get("status")) == "completed":
            out["message"] = "This puja is complete. Live tracking has ended."
        else:
            out["message"] = f"Pujari tracking appears from {mins} minutes before start."
        return out
    if not ping or ping.get("latitude") is None:
        out["message"] = "Waiting for the latest location update from your Pujari."
        return out
    lat = float(ping["latitude"])
    lng = float(ping["longitude"])
    out["latitude"] = lat
    out["longitude"] = lng
    out["recorded_at"] = ping.get("recorded_at")
    out["accuracy_m"] = ping.get("accuracy_m")
    out["distance_m"] = ping_distance_m(lat, lng, booking)
    rec = ping.get("recorded_at")
    stale = False
    if rec:
        try:
            dt = rec if isinstance(rec, datetime) else datetime.fromisoformat(str(rec).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds()
            stale = age > max(gps_interval_seconds(db) * 3, 180)
        except Exception:
            stale = False
    if stale:
        out["message"] = "Waiting for the latest location update from your Pujari."
        out["stale"] = True
    return out
