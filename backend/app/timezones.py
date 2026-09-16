"""IANA timezone helpers for Virtual Puja (customer local ↔ India)."""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

IST_ZONE = "Asia/Kolkata"
INDIA_COUNTRY_CODES = {"IN", "IND"}

# Common customer zones for the booking UI (value is IANA).
CUSTOMER_TIMEZONES: list[dict[str, str]] = [
    {"id": "Asia/Kolkata", "label": "India (IST)"},
    {"id": "Asia/Dubai", "label": "UAE (GST)"},
    {"id": "Asia/Singapore", "label": "Singapore (SGT)"},
    {"id": "Asia/Kuala_Lumpur", "label": "Malaysia (MYT)"},
    {"id": "Asia/Bangkok", "label": "Thailand (ICT)"},
    {"id": "Asia/Tokyo", "label": "Japan (JST)"},
    {"id": "Australia/Sydney", "label": "Australia – Sydney"},
    {"id": "Australia/Melbourne", "label": "Australia – Melbourne"},
    {"id": "Pacific/Auckland", "label": "New Zealand"},
    {"id": "Europe/London", "label": "United Kingdom (UK)"},
    {"id": "Europe/Berlin", "label": "Central Europe"},
    {"id": "America/New_York", "label": "USA – Eastern"},
    {"id": "America/Chicago", "label": "USA – Central"},
    {"id": "America/Denver", "label": "USA – Mountain"},
    {"id": "America/Los_Angeles", "label": "USA – Pacific"},
    {"id": "America/Toronto", "label": "Canada – Eastern"},
    {"id": "America/Vancouver", "label": "Canada – Pacific"},
]


def is_india_country(code: str | None) -> bool:
    return str(code or "").strip().upper() in INDIA_COUNTRY_CODES or str(code or "").strip().lower() in {
        "india",
    }


def validate_timezone(name: str) -> str:
    raw = (name or "").strip()
    if not raw:
        raise ValueError("Timezone is required")
    try:
        ZoneInfo(raw)
    except ZoneInfoNotFoundError as exc:
        raise ValueError("Invalid timezone") from exc
    return raw


def combine_local(d: date, t: time, tz_name: str) -> datetime:
    tz = ZoneInfo(validate_timezone(tz_name))
    return datetime.combine(d, t.replace(tzinfo=None)).replace(tzinfo=tz)


def to_utc(d: date, t: time, tz_name: str) -> datetime:
    return combine_local(d, t, tz_name).astimezone(ZoneInfo("UTC"))


def to_ist(d: date, t: time, tz_name: str) -> datetime:
    return combine_local(d, t, tz_name).astimezone(ZoneInfo(IST_ZONE))


def ist_date_time(d: date, t: time, tz_name: str) -> tuple[date, time]:
    ist = to_ist(d, t, tz_name)
    return ist.date(), ist.time().replace(microsecond=0)


def format_in_zone(utc_dt: datetime, tz_name: str) -> str:
    local = utc_dt.astimezone(ZoneInfo(validate_timezone(tz_name)))
    return local.strftime("%d-%m-%Y %H:%M")


def display_pair(utc_dt: datetime | None, customer_tz: str | None) -> dict[str, str | None]:
    if utc_dt is None:
        return {"customer_local": None, "india_local": None, "utc": None}
    if utc_dt.tzinfo is None:
        utc_dt = utc_dt.replace(tzinfo=ZoneInfo("UTC"))
    india = utc_dt.astimezone(ZoneInfo(IST_ZONE)).strftime("%d-%m-%Y %H:%M") + " IST"
    cust = None
    if customer_tz:
        try:
            cust = utc_dt.astimezone(ZoneInfo(validate_timezone(customer_tz))).strftime("%d-%m-%Y %H:%M")
        except ValueError:
            cust = None
    return {
        "customer_local": cust,
        "india_local": india,
        "utc": utc_dt.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def end_time_from_start(d: date, start: time, duration_minutes: int, tz_name: str) -> tuple[date, time]:
    local = combine_local(d, start, tz_name) + timedelta(minutes=max(1, duration_minutes))
    ist = local.astimezone(ZoneInfo(IST_ZONE))
    return ist.date(), ist.time().replace(microsecond=0)
