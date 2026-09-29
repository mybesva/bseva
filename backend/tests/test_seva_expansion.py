"""Seva events, registrations, and service classification tests."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.seva.constants import (
    EVENT_STATUSES,
    FAMILY_RELATIONSHIPS,
    PARTICIPATION_MODES,
    PUJA_EVENT_KINDS,
    SERVICE_TYPES,
)
from app.seva.helpers import enrich_event
from app.seva.registrations import RegistrationError, registration_can_join


def test_service_types_include_puja_chadhava_pravachan():
    assert SERVICE_TYPES == {"puja", "chadhava", "pravachan"}


def test_participation_modes():
    assert PARTICIPATION_MODES == {"offline", "online", "hybrid"}


def test_puja_event_kinds():
    assert PUJA_EVENT_KINDS == {"group_live", "proxy"}


def test_family_relationships():
    assert "self" in FAMILY_RELATIONSHIPS
    assert "spouse" in FAMILY_RELATIONSHIPS


def test_enrich_event_computes_seats_and_status():
    now = datetime.now(timezone.utc)
    row = {
        "id": "e1",
        "capacity": 100,
        "registration_count": 40,
        "status": "published",
        "published": True,
        "start_at": (now + timedelta(hours=2)).isoformat(),
        "end_at": (now + timedelta(hours=3)).isoformat(),
        "booking_cutoff_at": (now + timedelta(hours=1)).isoformat(),
    }
    out = enrich_event(row)
    assert out["seats_remaining"] == 60
    assert out["sold_out"] is False
    assert out["display_status"] == "upcoming"
    assert out["registration_open"] is True


def test_enrich_event_sold_out():
    row = {
        "capacity": 10,
        "registration_count": 10,
        "status": "published",
        "published": True,
        "start_at": datetime.now(timezone.utc).isoformat(),
    }
    out = enrich_event(row)
    assert out["sold_out"] is True
    assert out["seats_remaining"] == 0


def test_registration_can_join_requires_payment():
    ok, msg = registration_can_join(
        None,
        {"status": "confirmed", "payment_status": "pending", "participation_mode": "online"},
        {"online_enabled": True, "participation_mode": "online", "start_at": datetime.now(timezone.utc).isoformat()},
    )
    assert ok is False
    assert "Payment" in (msg or "")


def test_registration_can_join_free_paid_online():
    ok, msg = registration_can_join(
        None,
        {"status": "confirmed", "payment_status": "free", "participation_mode": "online"},
        {
            "online_enabled": True,
            "participation_mode": "hybrid",
            "start_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat(),
        },
    )
    assert ok is True
    assert msg is None


def test_registration_error_codes():
    err = RegistrationError("DUPLICATE_REGISTRATION", "dup", 409)
    assert err.code == "DUPLICATE_REGISTRATION"
    assert err.status == 409
