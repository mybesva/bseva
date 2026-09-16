"""Puja lifecycle: start/complete OTP, 20h location reveal, tracking stop/arrival."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.booking_tracking import (
    STOP_ARRIVED,
    location_payload,
    maybe_detect_arrival,
    tracking_should_be_active,
)
from app.geo import haversine_km
from app.platform_config import _DEFAULTS
from app.puja_otp import PURPOSE_COMPLETE, PURPOSE_START, generate_puja_otp


def test_generate_puja_otp_is_random_six_digits():
    codes = {generate_puja_otp() for _ in range(40)}
    assert all(len(c) == 6 and c.isdigit() for c in codes)
    assert len(codes) > 1


def test_platform_defaults_match_product_windows():
    assert _DEFAULTS["pujari_full_booking_details_before_hours"] == 20
    assert _DEFAULTS["puja_start_otp_before_minutes"] == 15
    assert _DEFAULTS["pujari_location_tracking_before_minutes"] == 15
    assert _DEFAULTS["pujari_gps_update_interval_seconds"] == 60
    assert _DEFAULTS["customer_tracking_refresh_seconds"] == 60
    assert _DEFAULTS["pujari_arrival_radius_meters"] == 100
    assert _DEFAULTS["puja_complete_otp_before_minutes"] == 15


def test_haversine_arrival_radius():
    # ~111m north of dest
    dest_lat, dest_lng = 12.9352, 77.6245
    near_lat = dest_lat + 0.0008
    far_lat = dest_lat + 0.01
    near_m = haversine_km(near_lat, dest_lng, dest_lat, dest_lng) * 1000
    far_m = haversine_km(far_lat, dest_lng, dest_lat, dest_lng) * 1000
    assert near_m < 100
    assert far_m > 100


def _booking(**extra):
    from zoneinfo import ZoneInfo

    tz = ZoneInfo("Asia/Kolkata")
    start_dt = datetime.now(tz) + timedelta(minutes=10)
    base = {
        "id": "11111111-1111-1111-1111-111111111111",
        "status": "confirmed",
        "pujari_id": "pujari-1",
        "mode": "in_person",
        "booking_date": start_dt.date(),
        "start_time": start_dt.time().replace(microsecond=0),
        "latitude": 12.9352,
        "longitude": 77.6245,
        "tracking_stopped_at": None,
        "arrived_at": None,
        "tracking_stop_reason": None,
        "arrival_hit_count": 0,
    }
    base.update(extra)
    return base


def test_tracking_only_while_confirmed_pre_start(monkeypatch):
    monkeypatch.setattr("app.booking_tracking.get_setting", lambda db, key, default=None: default)
    db = MagicMock()
    assert tracking_should_be_active(db, _booking()) is True
    assert tracking_should_be_active(db, _booking(status="in_progress")) is False
    assert tracking_should_be_active(db, _booking(status="cancelled")) is False
    assert tracking_should_be_active(db, _booking(status="completed")) is False
    assert tracking_should_be_active(db, _booking(tracking_stopped_at=datetime.now(timezone.utc))) is False
    from zoneinfo import ZoneInfo

    tz = ZoneInfo("Asia/Kolkata")
    far = datetime.now(tz) + timedelta(hours=2)
    assert tracking_should_be_active(
        db, _booking(booking_date=far.date(), start_time=far.time().replace(microsecond=0))
    ) is False


def test_location_payload_hides_live_coords_when_stopped(monkeypatch):
    monkeypatch.setattr("app.booking_tracking.get_setting", lambda db, key, default=None: default)
    db = MagicMock()
    booking = _booking(status="in_progress", tracking_stop_reason="started")
    ping = {"latitude": 12.94, "longitude": 77.62, "recorded_at": datetime.now(timezone.utc)}
    out = location_payload(db, booking, ping, include_destination=True)
    assert out["latitude"] is None
    assert out["longitude"] is None
    assert out["available"] is False
    assert out["tracking_active"] is False
    assert out["destination_latitude"] == 12.9352


def test_otp_purpose_constants():
    assert PURPOSE_START == "start_puja"
    assert PURPOSE_COMPLETE == "complete_puja"


def test_arrival_requires_consecutive_hits(monkeypatch):
    monkeypatch.setattr("app.booking_tracking.get_setting", lambda db, key, default=None: default)
    db = MagicMock()
    returning = SimpleNamespace()
    returning.first = lambda: (1,)
    db.execute.return_value = returning
    booking = _booking()
    # First in-radius ping increments but does not arrive (need 2)
    arrived = maybe_detect_arrival(db, booking, lat=12.9352, lng=77.6245, accuracy_m=10)
    assert arrived is False
    returning.first = lambda: (2,)
    arrived = maybe_detect_arrival(db, booking, lat=12.9352, lng=77.6245, accuracy_m=10)
    assert arrived is True
    assert STOP_ARRIVED == "arrived"


def test_noisy_accuracy_does_not_count_as_arrival(monkeypatch):
    monkeypatch.setattr("app.booking_tracking.get_setting", lambda db, key, default=None: default)
    db = MagicMock()
    booking = _booking()
    assert maybe_detect_arrival(db, booking, lat=12.9352, lng=77.6245, accuracy_m=500) is False
    db.execute.assert_not_called()
