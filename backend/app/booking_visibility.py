"""Booking visibility: 24h rule for pujaris; public pujari DTO."""
from __future__ import annotations

from datetime import date, datetime, time

from sqlalchemy.orm import Session

from app.domain import hours_until, row_dict
from app.meetings.service import public_invite_url_for
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


def _attach_invite_urls(data: dict, *, reveal_meet: bool) -> None:
    token = data.get("meeting_invite_token")
    public = public_invite_url_for(str(token) if token else None)
    if reveal_meet:
        if public:
            data["public_invite_url"] = public
        data["meeting_link_visible"] = True
    else:
        data.pop("meeting_url", None)
        data.pop("public_invite_url", None)
        data.pop("meeting_invite_token", None)
        data.pop("google_calendar_event_id", None)
        data["meeting_link_visible"] = False
        if str(data.get("mode") or "") == "virtual":
            data["meeting_reveal_note"] = (
                "Google Meet link unlocks within 24 hours before your scheduled virtual puja."
            )


def booking_for_role(db: Session, booking: dict, user: dict) -> dict:
    """Return role/time-appropriate booking representation."""
    data = row_dict(booking) if not isinstance(booking, dict) else dict(booking)
    role = user.get("role")

    def _finish() -> dict:
        from app.pujari_team import enrich_booking_pujari_team

        enrich_booking_pujari_team(data)
        return data

    if role in ("admin", "super_admin"):
        data["details_level"] = "full"
        data["pujari_details_visible"] = True
        _attach_invite_urls(data, reveal_meet=True)
        return _finish()

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
            ):
                data.pop(k, None)
            data["pujari_reveal_note"] = (
                "Pujari details will be shared within 24 hours before your scheduled puja."
            )
        _attach_invite_urls(data, reveal_meet=within_window)
        return _finish()

    if role in ("pujari", "head_pujari"):
        assigned = data.get("pujari_id") and str(data.get("pujari_id")) == str(user.get("id"))
        invited = False
        if not assigned:
            from app.booking_offers import pujari_invited_offer

            offer = pujari_invited_offer(db, str(data.get("id")), str(user.get("id")))
            if offer and data.get("pujari_id") is None and data.get("status") in (
                "pending",
                "pending_acceptance",
            ):
                invited = True
                data["offer_status"] = offer.get("status")
                data["offer_distance_km"] = offer.get("distance_km")
                data["pujari_offer_invited"] = True
            elif data.get("offer_status") == "invited" and data.get("pujari_id") is None:
                invited = True
                data["pujari_offer_invited"] = True
        if assigned or invited:
            full = within_window or data.get("status") in ("in_progress", "completed", "cancelled")
            data["details_level"] = "full" if full else "basic"
            data["pujari_details_visible"] = True
            raw_name = str(data.get("customer_name") or "").strip()
            if raw_name:
                parts = [p for p in raw_name.split() if p]
                if len(parts) == 1:
                    data["customer_name"] = parts[0][0].upper() + "." if parts[0] else "Customer"
                else:
                    data["customer_name"] = f"{parts[0]} {parts[-1][0].upper()}."
                data["customer_display_name"] = data["customer_name"]
            data.pop("customer_email", None)
            if not full:
                for k in (
                    "address",
                    "customer_phone",
                    "latitude",
                    "longitude",
                ):
                    data.pop(k, None)
                if data.get("location_label"):
                    parts = str(data["location_label"]).split(",")
                    data["location_label"] = parts[-1].strip() if parts else data["location_label"]
                    data["location_area"] = data["location_label"]
            if invited:
                data["pujari_accept_required"] = True
            _attach_invite_urls(data, reveal_meet=full)
            return _finish()
    raise PermissionError("Not allowed")
