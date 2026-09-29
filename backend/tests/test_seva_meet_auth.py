"""Meet invite authorization and seva feature-flag enforcement tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.routers import meetings
from app.seva.helpers import chadhava_enabled, pravachan_enabled, seva_enabled, service_type_enabled


def test_public_event_invite_token_returns_404():
    """Event-level meeting_invite_token must not grant public join access."""
    db = MagicMock()
    db.execute.return_value.mappings.return_value.first.side_effect = [None, None]
    with pytest.raises(HTTPException) as exc:
        meetings.public_meeting_invite("a" * 32, db=db)
    assert exc.value.status_code == 404


def test_short_invite_token_returns_404():
    with pytest.raises(HTTPException) as exc:
        meetings.public_meeting_invite("short", db=MagicMock())
    assert exc.value.status_code == 404


def test_unpaid_registration_cannot_join_meet(monkeypatch):
    db = MagicMock()
    reg_row = {
        "id": "r1",
        "event_id": "e1",
        "registration_number": "SEVA-001",
        "status": "confirmed",
        "payment_status": "pending",
        "participation_mode": "online",
        "join_token": "b" * 32,
        "meeting_url": "https://meet.google.com/abc-defg-hij",
        "event_title": "Test Event",
        "start_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        "end_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "online_enabled": True,
        "participation_mode": "online",
        "event_status": "published",
        "service_name": "Gita Pravachan",
    }

    booking_result = MagicMock()
    booking_result.mappings.return_value.first.return_value = None
    reg_result = MagicMock()
    reg_result.mappings.return_value.first.return_value = reg_row
    setting_result = MagicMock()
    setting_result.first.return_value = ("true",)
    db.execute.side_effect = [booking_result, reg_result, setting_result, setting_result, setting_result]

    event = {
        **reg_row,
        "service_type": "pravachan",
        "status": "published",
    }
    monkeypatch.setattr(meetings, "get_event", lambda _db, _eid, published_only=False: event)

    with pytest.raises(HTTPException) as exc:
        meetings.public_meeting_invite("b" * 32, db=db)
    assert exc.value.status_code == 403
    assert "Payment" in str(exc.value.detail)


def test_cancelled_registration_cannot_join_meet(monkeypatch):
    db = MagicMock()
    reg_row = {
        "id": "r1",
        "event_id": "e1",
        "registration_number": "SEVA-002",
        "status": "cancelled",
        "payment_status": "paid",
        "participation_mode": "online",
        "join_token": "c" * 32,
        "meeting_url": "https://meet.google.com/abc-defg-hij",
        "event_title": "Test Event",
        "start_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        "end_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "online_enabled": True,
        "participation_mode": "online",
        "event_status": "published",
        "service_name": "Group Puja",
    }

    booking_result = MagicMock()
    booking_result.mappings.return_value.first.return_value = None
    reg_result = MagicMock()
    reg_result.mappings.return_value.first.return_value = reg_row
    setting_result = MagicMock()
    setting_result.first.return_value = ("true",)
    db.execute.side_effect = [booking_result, reg_result, setting_result, setting_result]

    event = {**reg_row, "service_type": "puja", "status": "published"}
    monkeypatch.setattr(meetings, "get_event", lambda _db, _eid, published_only=False: event)

    with pytest.raises(HTTPException) as exc:
        meetings.public_meeting_invite("c" * 32, db=db)
    assert exc.value.status_code == 403


def test_service_type_enabled_respects_flags(monkeypatch):
    db = MagicMock()

    def fake_setting(_db, key, default=True):
        return {
            "chadhava_enabled": False,
            "pravachan_enabled": False,
            "seva_events_enabled": True,
        }.get(key, default)

    monkeypatch.setattr("app.seva.helpers.get_setting", fake_setting)
    assert service_type_enabled(db, "puja") is True
    assert service_type_enabled(db, "chadhava") is False
    assert service_type_enabled(db, "pravachan") is False


def test_seva_disabled_blocks_join(monkeypatch):
    db = MagicMock()
    monkeypatch.setattr("app.seva.helpers.get_setting", lambda _db, key, default=True: False)
    from app.seva.registrations import registration_can_join

    ok, msg = registration_can_join(
        db,
        {"status": "confirmed", "payment_status": "free", "participation_mode": "online"},
        {
            "online_enabled": True,
            "participation_mode": "online",
            "service_type": "pravachan",
            "start_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        },
    )
    assert ok is False
    assert "unavailable" in (msg or "").lower()
