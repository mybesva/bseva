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


# --------------------------------------------------------------------------------------------
# Astronomical Panchangam (drik ganita) using astronomy-engine (MIT, no data files).
# Tithi / nakshatra are taken at local sunrise; nakshatra and months use the Lahiri ayanamsa.
# --------------------------------------------------------------------------------------------
from datetime import datetime, timedelta, timezone  # noqa: E402
from functools import lru_cache  # noqa: E402

import astronomy as _ae  # noqa: E402

IST = timezone(timedelta(hours=5, minutes=30))
# Default region for B-Seva (Hyderabad). Panchangam timings depend on location.
DEFAULT_LOCATION = {"name": "Hyderabad", "lat": 17.3850, "lon": 78.4867, "elevation_m": 505.0}
RAHU_SEGMENT = {0: 2, 1: 7, 2: 5, 3: 6, 4: 4, 5: 3, 6: 8}  # Python weekday (Mon=0) -> eighth of daytime
_NAK_SPAN = 360.0 / 27.0


def _ae_time(dt: datetime) -> "_ae.Time":
    u = dt.astimezone(timezone.utc)
    return _ae.Time.Make(u.year, u.month, u.day, u.hour, u.minute, u.second + u.microsecond / 1e6)


def _to_ist(t: "_ae.Time") -> datetime:
    return t.Utc().replace(tzinfo=timezone.utc).astimezone(IST)


def _lahiri(t: "_ae.Time") -> float:
    """Lahiri (Chitrapaksha) ayanamsa in degrees (23 deg 51' 25.5" at J2000, ~50.2788"/yr)."""
    years = t.tt / 365.25
    return 23.857092 + years * (50.2788 / 3600.0) + (years * years) * (0.000222 / 3600.0)


def _sun_tropical(t) -> float:
    return _ae.SunPosition(t).elon % 360.0


def _moon_tropical(t) -> float:
    return _ae.EclipticGeoMoon(t).lon % 360.0


def _sun_sidereal(t) -> float:
    return (_sun_tropical(t) - _lahiri(t)) % 360.0


def _moon_sidereal(t) -> float:
    return (_moon_tropical(t) - _lahiri(t)) % 360.0


def _crossing(fn, start, target: float, max_days: float):
    """First time after `start` (within max_days) when the steadily increasing angle fn(t)
    reaches `target` (mod 360). Coarse 2-hour steps, then bisection to ~1 second."""
    def ahead(t):
        return (target - fn(t)) % 360.0

    step = 1.0 / 12.0
    a = start
    prev = ahead(a)
    n = int(max_days / step) + 1
    for _ in range(n):
        b = a.AddDays(step)
        cur = ahead(b)
        if cur > prev:  # wrapped past the target between a and b
            lo, hi = a, b
            for _ in range(30):
                mid = lo.AddDays((hi.ut - lo.ut) / 2)
                if ahead(mid) > ahead(lo):
                    hi = mid
                else:
                    lo = mid
            return hi
        a, prev = b, cur
    return None


def _fmt_time(dt: datetime) -> str:
    return dt.strftime("%I:%M %p").lstrip("0")


@lru_cache(maxsize=512)
def _compute(d: date) -> dict:
    loc = DEFAULT_LOCATION
    obs = _ae.Observer(loc["lat"], loc["lon"], loc["elevation_m"])
    midnight = _ae_time(datetime(d.year, d.month, d.day, tzinfo=IST))
    rise = _ae.SearchRiseSet(_ae.Body.Sun, obs, _ae.Direction.Rise, midnight, 1)
    sset = _ae.SearchRiseSet(_ae.Body.Sun, obs, _ae.Direction.Set, rise, 1)
    sunrise, sunset = _to_ist(rise), _to_ist(sset)

    # Tithi (moon-sun elongation / 12 deg) at sunrise
    elong = _ae.MoonPhase(rise) % 360.0
    tithi_idx = int(elong // 12.0)  # 0..29
    tithi_end = _crossing(lambda t: _ae.MoonPhase(t), rise, ((tithi_idx + 1) * 12.0) % 360.0, 2.0)
    if tithi_idx == 29:
        tithi_name = "Amavasya"
    elif tithi_idx == 14:
        tithi_name = "Purnima"
    else:
        tithi_name = TITHIS[tithi_idx % 15]
    paksha = "Shukla Paksha" if tithi_idx < 15 else "Krishna Paksha"

    # Nakshatra (sidereal moon) at sunrise
    nak_idx = int(_moon_sidereal(rise) // _NAK_SPAN)
    nak_end = _crossing(_moon_sidereal, rise, ((nak_idx + 1) * _NAK_SPAN) % 360.0, 1.5)

    # Lunar month (amanta): named from the sidereal sign of the Sun at the new moon that starts it
    prev_nm = _ae.SearchMoonPhase(0.0, rise.AddDays(-31.0), 31.0)
    while True:
        nxt = _ae.SearchMoonPhase(0.0, prev_nm.AddDays(1.0), 31.0)
        if nxt.ut > rise.ut:
            break
        prev_nm = nxt
    next_nm = _ae.SearchMoonPhase(0.0, prev_nm.AddDays(1.0), 31.0)
    rashi_start = int(_sun_sidereal(prev_nm) // 30.0)
    rashi_next = int(_sun_sidereal(next_nm) // 30.0)
    amanta_idx = (rashi_start + 1) % 12
    adhika = rashi_start == rashi_next  # no sankranti during the month
    amanta = ("Adhika " if adhika else "") + NORTH_MONTHS[amanta_idx]
    purnimanta = NORTH_MONTHS[(amanta_idx + 1) % 12] if tithi_idx >= 15 else NORTH_MONTHS[amanta_idx]
    if adhika:
        purnimanta = "Adhika " + purnimanta

    # Solar month (Tamil names) + day: the day counts from the sankranti (if the Sun enters the
    # sign after sunset, the month starts the next day).
    sun_rashi = int(_sun_sidereal(sset) // 30.0)  # the sign at sunset decides the day's solar month
    sankranti = _crossing(_sun_sidereal, sset.AddDays(-33.0), sun_rashi * 30.0, 34.0)
    if sankranti is not None and sankranti.ut > sset.ut:  # guard: crossing found after today
        sankranti = None
    solar_day = None
    if sankranti is not None:
        s_ist = _to_ist(sankranti)
        s_obs_set = _ae.SearchRiseSet(
            _ae.Body.Sun, obs, _ae.Direction.Set,
            _ae_time(datetime(s_ist.year, s_ist.month, s_ist.day, tzinfo=IST)), 1,
        )
        first_day = s_ist.date() if sankranti.ut <= s_obs_set.ut else s_ist.date() + timedelta(days=1)
        solar_day = (d - first_day).days + 1

    # Rahu Kalam: one eighth of local daytime, by weekday
    seg = (sunset - sunrise) / 8
    k = RAHU_SEGMENT[d.weekday()]
    rahu = f"{_fmt_time(sunrise + seg * (k - 1))} – {_fmt_time(sunrise + seg * k)}"

    return {
        "tithi": tithi_name,
        "paksha": paksha,
        "tithiDay": tithi_idx % 15 + 1,
        "tithiEndsAt": _to_ist(tithi_end).isoformat() if tithi_end else None,
        "nakshatra": NAKSHATRAS[nak_idx],
        "nakshatraEndsAt": _to_ist(nak_end).isoformat() if nak_end else None,
        "amantaMonth": amanta,
        "purnimantaMonth": purnimanta,
        "solarMonth": SOUTH_MONTHS[sun_rashi],
        "solarDay": solar_day,
        "sunrise": _fmt_time(sunrise),
        "sunset": _fmt_time(sunset),
        "rahukaalam": rahu,
        "location": loc["name"],
    }


def panchang_for(d: date, calendar_type: str = "solar") -> dict:
    """Panchangam for a date. Response keys are unchanged; `lunarMonth` / `lunarDay` follow the
    selected mode (solar: solar month + day of solar month; lunar: amanta month + tithi day)."""
    calendar_type = normalize_calendar_pref(calendar_type)
    p = _compute(d)
    is_peak = d.weekday() >= 5 or is_festival_day(d)  # pricing rule unchanged
    if calendar_type == "solar":
        month, day = p["solarMonth"], p["solarDay"]
    else:
        month, day = p["amantaMonth"], p["tithiDay"]
    return {
        "date": d.isoformat(),
        "calendarType": calendar_type,
        "tithi": p["tithi"],
        "paksha": p["paksha"],
        "nakshatra": p["nakshatra"],
        "lunarMonth": month,
        "lunarDay": day,
        "rahukaalam": p["rahukaalam"],
        "isPeakDay": is_peak,
        "notes": None,
        # Additional detail (new, optional for clients)
        "tithiEndsAt": p["tithiEndsAt"],
        "nakshatraEndsAt": p["nakshatraEndsAt"],
        "solarMonth": p["solarMonth"],
        "solarDay": p["solarDay"],
        "amantaMonth": p["amantaMonth"],
        "purnimantaMonth": p["purnimantaMonth"],
        "sunrise": p["sunrise"],
        "sunset": p["sunset"],
        "location": p["location"],
    }
