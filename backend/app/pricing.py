"""Central pricing: base + location + surge/weekend − discount + GST."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.platform_config import get_setting


def _weekend_days(db: Session) -> set[int]:
    """ISO weekday: Mon=1 … Sun=7. Default Sat+Sun."""
    raw = get_setting(db, "weekend_days", [6, 7])
    if isinstance(raw, list):
        return {int(x) for x in raw}
    return {6, 7}


def location_adjustment_paise(db: Session, service_id: str, city: str | None) -> int:
    if not city:
        return 0
    row = db.execute(
        text(
            """
            SELECT adjustment_paise FROM location_prices
            WHERE active = TRUE
              AND (service_id IS NULL OR service_id = CAST(:sid AS uuid))
              AND lower(city) = lower(:city)
            ORDER BY service_id NULLS LAST
            LIMIT 1
            """
        ),
        {"sid": service_id, "city": city.strip()},
    ).first()
    return int(row[0]) if row else 0


def surge_paise(
    db: Session,
    *,
    service_id: str,
    base: int,
    city: str | None,
    booking_date: date | None,
) -> tuple[int, str | None]:
    """Return (surge_amount_paise, reason)."""
    peak_fee = 0
    reason = None
    pricing = db.execute(text("SELECT peak_day_fee_paise FROM pricing_config WHERE id = 1")).first()
    default_peak = int(pricing[0] if pricing else 0)

    # Weekend surge from settings
    weekend_pct = float(get_setting(db, "weekend_surge_percent", 0) or 0)
    weekend_fixed = int(get_setting(db, "weekend_surge_paise", 0) or 0)
    if booking_date and booking_date.isoweekday() in _weekend_days(db):
        amt = int(round(base * weekend_pct / 100)) + weekend_fixed
        if amt <= 0 and default_peak > 0:
            amt = default_peak
        if amt > 0:
            peak_fee = amt
            reason = "weekend"

    # Configurable surge rules table (optional)
    try:
        rows = db.execute(
            text(
                """
                SELECT percent_increase, fixed_paise, label, city, applies_weekend
                FROM surge_rules
                WHERE active = TRUE
                  AND (service_id IS NULL OR service_id = CAST(:sid AS uuid))
                  AND (valid_from IS NULL OR valid_from <= COALESCE(:d, CURRENT_DATE))
                  AND (valid_to IS NULL OR valid_to >= COALESCE(:d, CURRENT_DATE))
                ORDER BY priority DESC
                """
            ),
            {"sid": service_id, "d": booking_date},
        ).mappings().all()
    except Exception:
        rows = []

    for r in rows:
        if r.get("city") and city and str(r["city"]).lower() != city.strip().lower():
            continue
        if r.get("city") and not city:
            continue
        if r.get("applies_weekend") and booking_date and booking_date.isoweekday() not in _weekend_days(db):
            continue
        if r.get("applies_weekend") is False and booking_date and booking_date.isoweekday() in _weekend_days(db):
            # rule is for non-weekend only — skip on weekend if already have weekend
            pass
        pct = float(r.get("percent_increase") or 0)
        fixed = int(r.get("fixed_paise") or 0)
        amt = int(round(base * pct / 100)) + fixed
        if amt > peak_fee:
            peak_fee = amt
            reason = r.get("label") or "surge"

    return peak_fee, reason


def compute_quote(
    db: Session,
    *,
    service: Any,
    package_type: str = "standard",
    city: str | None = None,
    booking_date: date | None = None,
    discount_paise: int = 0,
    wallet_credit_paise: int = 0,
) -> dict:
    base = int(
        service["premium_price_paise"] if package_type == "premium" else service["standard_price_paise"]
    )
    loc_adj = location_adjustment_paise(db, str(service["id"]), city)
    adjusted_base = max(0, base + loc_adj)
    peak, peak_reason = surge_paise(
        db, service_id=str(service["id"]), base=adjusted_base, city=city, booking_date=booking_date
    )
    subtotal = max(0, adjusted_base + peak - int(discount_paise or 0) - int(wallet_credit_paise or 0))
    share = float(get_setting(db, "pujari_share_percent", 85))
    platform_fee = int(round(adjusted_base * (100 - share) / 100))
    pujari_share = adjusted_base - platform_fee
    pricing = db.execute(text("SELECT * FROM pricing_config WHERE id = 1")).mappings().one()
    gst_pct = float(pricing["gst_percent"])
    gst_amt = int(round(subtotal * gst_pct / 100))
    total = subtotal + gst_amt
    return {
        "basePrice": base,
        "locationAdjustment": loc_adj,
        "platformFee": platform_fee,
        "pujariShare": pujari_share,
        "peakFee": peak,
        "peakReason": peak_reason,
        "discount": int(discount_paise or 0),
        "walletCredit": int(wallet_credit_paise or 0),
        "subtotal": subtotal,
        "gstPercent": gst_pct,
        "gstAmount": gst_amt,
        "totalAmount": total,
        "currency": pricing.get("currency") or "INR",
    }


def parse_booking_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        return date.fromisoformat(value[:10])
    return None
