"""Panchangam values come from real sun/moon positions (BUG-06), checked against published dates."""
from datetime import date

from app.panchang import panchang_for


def test_solar_mode_uses_solar_month_not_lunar():
    s = panchang_for(date(2026, 10, 9), "solar")
    assert s["calendarType"] == "solar"
    assert s["lunarMonth"] == "Purattasi" and s["lunarDay"] == s["solarDay"] == 23
    l = panchang_for(date(2026, 10, 9), "lunar")
    assert l["lunarMonth"] == "Bhadrapada"  # amanta; purnimanta is Ashwin
    assert l["purnimantaMonth"] == "Ashwin"


def test_tamil_new_year_and_pongal_start_solar_months():
    assert (panchang_for(date(2026, 4, 14))["solarMonth"], panchang_for(date(2026, 4, 14))["solarDay"]) == ("Chithirai", 1)
    assert (panchang_for(date(2026, 1, 14))["solarMonth"], panchang_for(date(2026, 1, 14))["solarDay"]) == ("Thai", 1)
    assert panchang_for(date(2026, 10, 18))["solarMonth"] == "Aippasi"  # Tula Sankranti


def test_tithi_and_nakshatra_match_drik_reference():
    p = panchang_for(date(2026, 10, 12), "lunar")
    assert (p["tithi"], p["paksha"], p["nakshatra"]) == ("Dwitiya", "Shukla Paksha", "Swati")
    # Drik Panchang: Dwitiya upto 10:13 PM, Swati upto 11:52 PM (end instants are location independent)
    assert p["tithiEndsAt"][11:16] in ("22:13", "22:14")
    assert p["nakshatraEndsAt"][11:16] in ("23:51", "23:52", "23:53")


def test_amavasya_and_rahu_kalam_from_sunrise():
    p = panchang_for(date(2026, 3, 19), "lunar")
    assert p["tithi"] == "Amavasya" and p["paksha"] == "Krishna Paksha"
    # Thursday: 6th eighth of daytime, computed from local sunrise/sunset (not a fixed slot)
    assert p["rahukaalam"].count("–") == 1 and p["sunrise"].endswith("AM")


def test_response_keeps_existing_keys():
    p = panchang_for(date(2026, 10, 9), "solar")
    for k in ("date", "calendarType", "tithi", "paksha", "nakshatra", "lunarMonth", "lunarDay", "rahukaalam", "isPeakDay", "notes"):
        assert k in p
