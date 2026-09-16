from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from app.platform_config import _DEFAULTS
from app.timezones import display_pair, is_india_country, ist_date_time, to_utc
from app.vpn_check import inspect_ip


def test_virtual_puja_disabled_by_default():
    assert _DEFAULTS["virtual_puja_enabled"] is False


def test_india_country_codes():
    assert is_india_country("IN")
    assert is_india_country("india")
    assert is_india_country("IND")
    assert not is_india_country("US")
    assert not is_india_country("")


def test_virtual_price_uses_country_tier():
    from app.timezones import is_india_country

    service = {
        "virtual_domestic_price_paise": 50_000,
        "virtual_international_price_paise": 90_000,
        "online_nri_price_paise": 80_000,
        "standard_price_paise": 40_000,
    }

    def pick(country: str) -> int:
        key = (
            "virtual_domestic_price_paise"
            if is_india_country(country)
            else "virtual_international_price_paise"
        )
        return int(service.get(key) or service.get("online_nri_price_paise") or 0)

    assert pick("IN") == 50_000
    assert pick("US") == 90_000
    assert pick("AE") == 90_000


def test_customer_local_converts_to_ist_and_utc():
    d = date(2026, 9, 16)
    t = time(10, 0)
    utc = to_utc(d, t, "America/New_York")
    ist_d, ist_t = ist_date_time(d, t, "America/New_York")
    ny = datetime(2026, 9, 16, 10, 0, tzinfo=ZoneInfo("America/New_York"))
    assert utc == ny.astimezone(ZoneInfo("UTC"))
    expected_ist = ny.astimezone(ZoneInfo("Asia/Kolkata"))
    assert ist_d == expected_ist.date()
    assert ist_t.hour == expected_ist.hour
    assert ist_t.minute == expected_ist.minute
    pair = display_pair(utc, "America/New_York")
    assert pair["india_local"] and "IST" in str(pair["india_local"])
    assert pair["customer_local"]


def test_vpn_lookup_skips_localhost():
    info = inspect_ip("127.0.0.1")
    assert info["vpn_or_proxy"] is False
    assert info["source"] == "local"
