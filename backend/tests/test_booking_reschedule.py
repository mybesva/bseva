"""Rescheduling cutoff boundary and fee rules."""
from datetime import date, datetime, time, timedelta, timezone

import pytest

from app import booking_reschedule as br

NOW = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)


def rules(**over):
    base = {
        "enabled": True,
        "cutoff_hours": 48.0,
        "fee_enabled": False,
        "first_fee_paise": 10000,
        "subsequent_fee_paise": 20000,
        "performance_rule_enabled": False,
        "performance_min_rating": 4.0,
        "performance_fee_paise": 5000,
    }
    return {**base, **over}


@pytest.mark.parametrize(
    ("gap", "allowed"),
    [
        (timedelta(hours=48, seconds=1), True),
        (timedelta(hours=48), False),
        (timedelta(hours=47, minutes=59), False),
        (timedelta(0), False),
    ],
)
def test_cutoff_is_strictly_more_than_the_hours(gap, allowed):
    assert br.outside_cutoff(NOW + gap, NOW, 48) is allowed


def test_all_reschedules_are_free_by_default_whatever_the_amounts():
    assert br.reschedule_fee(rules(), 0, 1.0) == (0, "free")
    assert br.reschedule_fee(rules(), 5, None) == (0, "free")


def test_first_and_later_fees_follow_the_booking_count():
    on = rules(fee_enabled=True)
    assert br.reschedule_fee(on, 0, None) == (10000, "first")
    assert br.reschedule_fee(on, 1, None) == (20000, "subsequent")


def test_pujari_rating_rule_applies_only_below_the_minimum():
    on = rules(fee_enabled=True, performance_rule_enabled=True)
    assert br.reschedule_fee(on, 0, 3.9) == (5000, "pujari_performance")
    assert br.reschedule_fee(on, 0, 4.0) == (10000, "first")
    assert br.reschedule_fee(on, 0, None) == (10000, "first")


def test_in_person_start_is_india_time():
    start = br.booking_start({"booking_date": date(2026, 11, 3), "start_time": time(17, 30), "start_at_utc": None})
    assert start == datetime(2026, 11, 3, 12, 0, tzinfo=timezone.utc)


def test_virtual_start_uses_the_stored_utc_time():
    utc = datetime(2026, 11, 3, 1, 0, tzinfo=timezone.utc)
    assert br.booking_start({"booking_date": date(2026, 11, 3), "start_time": time(6, 30), "start_at_utc": utc}) == utc


@pytest.mark.parametrize(
    ("change", "code"),
    [
        ({"status": "in_progress"}, "RESCHEDULE_NOT_ALLOWED"),
        ({"status": "completed"}, "RESCHEDULE_NOT_ALLOWED"),
        ({"status": "cancelled"}, "RESCHEDULE_NOT_ALLOWED"),
        ({"payment_status": "pending"}, "RESCHEDULE_NOT_ALLOWED"),
    ],
)
def test_only_open_paid_bookings_can_move(change, code):
    booking = {"status": "confirmed", "payment_status": "paid", "start_at_utc": NOW + timedelta(days=10), **change}
    assert br.blocked_reason(booking, rules(), NOW)[0] == code


def test_switched_off_blocks_everything():
    booking = {"status": "confirmed", "payment_status": "paid", "start_at_utc": NOW + timedelta(days=10)}
    assert br.blocked_reason(booking, rules(enabled=False), NOW)[0] == "RESCHEDULE_DISABLED"
    assert br.blocked_reason(booking, rules(), NOW) is None


def test_pujari_stays_hidden_until_the_customer_may_see_them(monkeypatch):
    from app import booking_visibility

    booking = {"status": "confirmed", "booking_date": date(2026, 11, 3), "start_time": time(9, 0)}
    monkeypatch.setattr(booking_visibility, "can_pujari_see_full", lambda *a: False)
    assert br.pujari_visible_to_customer(None, booking) is False
    monkeypatch.setattr(booking_visibility, "can_pujari_see_full", lambda *a: True)
    assert br.pujari_visible_to_customer(None, booking) is True
    assert br.pujari_visible_to_customer(None, {**booking, "status": "pending_acceptance"}) is False
