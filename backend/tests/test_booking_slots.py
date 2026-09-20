from datetime import date, datetime, time

from app.booking_slots import parse_start_time, start_passes_lead, validate_booking_start


def test_parse_start_time_accepts_any_minute():
    assert parse_start_time("10:15") == time(10, 15)
    assert parse_start_time("13:20") == time(13, 20)
    assert parse_start_time("10:15:00") == time(10, 15, 0)


def test_lead_time_rejects_starts_inside_window():
    now = datetime(2026, 9, 20, 8, 0, 0)
    booking_date = date(2026, 9, 21)
    assert not start_passes_lead(
        booking_date=booking_date,
        start=time(10, 15),
        lead_hours=48,
        mode="in_person",
        timezone_name="Asia/Kolkata",
        now=now,
    )
    later = date(2026, 9, 23)
    assert start_passes_lead(
        booking_date=later,
        start=time(10, 15),
        lead_hours=48,
        mode="in_person",
        timezone_name="Asia/Kolkata",
        now=now,
    )
    assert start_passes_lead(
        booking_date=later,
        start=time(13, 20),
        lead_hours=48,
        mode="in_person",
        timezone_name="Asia/Kolkata",
        now=now,
    )


def test_validate_booking_start_returns_structured_result():
    svc = {"booking_lead_hours": 48, "duration_minutes": 90}
    now = datetime(2026, 9, 20, 8, 0, 0)
    out = validate_booking_start(
        None,
        service=svc,
        booking_date=date(2026, 9, 23),
        start_time_raw="10:45",
        mode="in_person",
        now=now,
    )
    assert out["valid"] is True
    assert out["start"] == "10:45"
