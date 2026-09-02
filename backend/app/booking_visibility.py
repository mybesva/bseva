"""Booking visibility: 24h rule for pujaris; public pujari DTO."""
from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy.orm import Session

from app.domain import hours_until, row_dict
from app.platform_config import get_setting


def pujari_hours_before_full(db: Session) -> float:
    return float(get_setting(db, "pujari_full_booking_details_before_hours", 24))


def can_pujari_see_full(db: Session, booking_date: date, start: time) -> bool:
    return hours_until(booking_date, start) <= pujari_hours_before_full(db)


PUBLIC_PUJARI_KEYS = {
    "id",
    "name",
    "approved_level",
    "verification_status",
    "available",
    "location_label",
    "distance_km",
    "experience_years",
    "languages",
    "specializations",
    "city",
}


def public_pujari(row: dict) -> dict:
    """Strip sensitive fields for pre-booking discovery."""
    out = {k: row.get(k) for k in PUBLIC_PUJARI_KEYS if k in row}
    # Never expose phone/bank/docs on public list
    out.pop("phone", None)
    return out


def booking_for_role(db: Session, booking: dict, user: dict) -> dict:
    """Return role/time-appropriate booking representation."""
    data = row_dict(booking) if not isinstance(booking, dict) else dict(booking)
    role = user.get("role")
    if role in ("admin", "super_admin"):
        data["details_level"] = "full"
        data["pujari_details_visible"] = True
        return data

    bd = data.get("booking_date")
    st = data.get("start_time")
    if isinstance(bd, str):
        bd = date.fromisoformat(bd[:10])
    if isinstance(st, str):
        parts = st.split(":")
        st = time(int(parts[0]), int(parts[1]))

    within_window = False
    if data.get("status") in ("in_progress", "completed"):
        within_window = True
    elif isinstance(bd, date) and isinstance(st, time):
        within_window = can_pujari_see_full(db, bd, st)

    if role == "customer" and str(data.get("customer_id")) == str(user.get("id")):
        data["details_level"] = "full" if within_window else "customer_basic"
        data["pujari_details_visible"] = within_window
        if not within_window:
            for k in (
                "pujari_name",
                "pujari_phone",
                "pujari_email",
                "pujari_id",
                "meeting_url",
            ):
                data.pop(k, None)
            data["pujari_reveal_note"] = (
                "Pujari details will be shared within 24 hours before your scheduled puja."
            )
        return data

    if role in ("pujari", "head_pujari") and str(data.get("pujari_id")) == str(user.get("id")):
        full = within_window or data.get("status") in ("in_progress", "completed", "cancelled")
        data["details_level"] = "full" if full else "basic"
        data["pujari_details_visible"] = True
        if not full:
            for k in (
                "address",
                "customer_phone",
                "customer_email",
                "latitude",
                "longitude",
                "meeting_url",
            ):
                data.pop(k, None)
            if data.get("location_label"):
                parts = str(data["location_label"]).split(",")
                data["location_label"] = parts[-1].strip() if parts else data["location_label"]
                data["location_area"] = data["location_label"]
        return data
    raise PermissionError("Not allowed")
