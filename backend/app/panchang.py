from datetime import date


TITHIS = [
    "Pratipada",
    "Dwitiya",
    "Tritiya",
    "Chaturthi",
    "Panchami",
    "Shashthi",
    "Saptami",
    "Ashtami",
    "Navami",
    "Dashami",
    "Ekadashi",
    "Dwadashi",
    "Trayodashi",
    "Chaturdashi",
    "Purnima",
]
NAKSHATRAS = [
    "Ashwini",
    "Bharani",
    "Krittika",
    "Rohini",
    "Mrigashira",
    "Ardra",
    "Punarvasu",
    "Pushya",
    "Ashlesha",
    "Magha",
    "Purva Phalguni",
    "Uttara Phalguni",
    "Hasta",
    "Chitra",
    "Swati",
    "Vishakha",
    "Anuradha",
    "Jyeshtha",
    "Mula",
    "Purva Ashadha",
    "Uttara Ashadha",
    "Shravana",
    "Dhanishta",
    "Shatabhisha",
    "Purva Bhadrapada",
    "Uttara Bhadrapada",
    "Revati",
]
NORTH_MONTHS = [
    "Chaitra",
    "Vaishakha",
    "Jyeshtha",
    "Ashadha",
    "Shravana",
    "Bhadrapada",
    "Ashwin",
    "Kartika",
    "Margashirsha",
    "Pausha",
    "Magha",
    "Phalguna",
]
SOUTH_MONTHS = [
    "Chithirai",
    "Vaikasi",
    "Aani",
    "Aadi",
    "Aavani",
    "Purattasi",
    "Aippasi",
    "Karthigai",
    "Margazhi",
    "Thai",
    "Maasi",
    "Panguni",
]
RAHU = {
    0: "04:30 PM – 06:00 PM",
    1: "07:30 AM – 09:00 AM",
    2: "03:00 PM – 04:30 PM",
    3: "12:00 PM – 01:30 PM",
    4: "01:30 PM – 03:00 PM",
    5: "10:30 AM – 12:00 PM",
    6: "09:00 AM – 10:30 AM",
}


def _lunar_tithi_index(d: date) -> int:
    epoch = date(2000, 1, 1)
    lunar_day = (d - epoch).days % 30
    return lunar_day % 15


def is_festival_day(d: date) -> bool:
    """Ekadashi and Purnima/Chaturdashi — festival tithis used for festival surge."""
    return _lunar_tithi_index(d) in (10, 14)


def normalize_calendar_pref(value: str | None) -> str:
    return "lunar" if str(value or "").strip().lower() == "lunar" else "solar"


def panchang_for(d: date, calendar_type: str = "solar") -> dict:
    calendar_type = normalize_calendar_pref(calendar_type)
    epoch = date(2000, 1, 1)
    lunar_day = (d - epoch).days % 30
    tithi_index = _lunar_tithi_index(d)
    paksha = "Shukla Paksha" if lunar_day < 15 else "Krishna Paksha"
    months = SOUTH_MONTHS if calendar_type == "solar" else NORTH_MONTHS
    rahu_key = (d.weekday() + 1) % 7  # convert to Sun=0
    is_peak = d.weekday() >= 5 or is_festival_day(d)
    return {
        "date": d.isoformat(),
        "calendarType": calendar_type,
        "tithi": TITHIS[tithi_index],
        "paksha": paksha,
        "nakshatra": NAKSHATRAS[(d - epoch).days % 27],
        "lunarMonth": months[d.month - 1],
        "lunarDay": (lunar_day % 15) + 1,
        "rahukaalam": RAHU.get(rahu_key, "01:30 PM – 03:00 PM"),
        "isPeakDay": is_peak,
        "notes": None,
    }
