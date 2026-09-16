"""Compatibility shim — implementation lives in app.puja_otp and app.booking_tracking."""
from app.booking_tracking import location_window_minutes, within_pre_start_minutes
from app.puja_otp import (
    issue_start_puja_otp,
    otp_window_minutes,
    within_start_window,
)


def within_location_window(db, booking_date, start_time, status: str) -> bool:
    """Deprecated: live tracking no longer stays open during in_progress."""
    from app.booking_tracking import tracking_should_be_active

    return tracking_should_be_active(
        db,
        {
            "status": status,
            "booking_date": booking_date,
            "start_time": start_time,
            "pujari_id": True,
            "mode": "in_person",
        },
    )


__all__ = [
    "issue_start_puja_otp",
    "otp_window_minutes",
    "location_window_minutes",
    "within_start_window",
    "within_location_window",
    "within_pre_start_minutes",
]
