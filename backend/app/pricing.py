"""Central pricing: base + location + surge/weekend − discount + GST."""
from __future__ import annotations

import json
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.platform_config import get_setting

DEFAULT_DAKSHINA_SHARE_PERCENT = 85.0


def dakshina_share_percent(service: Any | None = None) -> float:
    """Pujari dakshina % for a puja. Default 85; admin can override per service."""
    raw = None
    if service is not None and hasattr(service, "get"):
        raw = service.get("dakshina_share_percent")
    try:
        value = float(raw) if raw is not None else DEFAULT_DAKSHINA_SHARE_PERCENT
    except (TypeError, ValueError):
        value = DEFAULT_DAKSHINA_SHARE_PERCENT
    if value < 0 or value > 100:
        return DEFAULT_DAKSHINA_SHARE_PERCENT
    return value


def _weekend_days(db: Session) -> set[int]:
    """ISO weekday: Mon=1 … Sun=7. Default Sat+Sun."""
    raw = get_setting(db, "weekend_days", [6, 7])
    if isinstance(raw, list):
        return {int(x) for x in raw}
    return {6, 7}


def surge_amount_from_mode(
    base: int,
    mode: str | None,
    percent: float | None,
    paise: int | None,
) -> int:
    """Percent of base, or a fixed paise amount — never both."""
    mode_n = str(mode or "percent").strip().lower()
    if mode_n in {"amount", "fixed", "paise", "rupees"}:
        try:
            return max(0, int(paise or 0))
        except (TypeError, ValueError):
            return 0
    try:
        pct = float(percent or 0)
    except (TypeError, ValueError):
        pct = 0.0
    if pct <= 0:
        return 0
    return max(0, int(round(int(base or 0) * pct / 100.0)))


def festival_date_set(raw: Any) -> set[str]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except Exception:
            raw = [p.strip() for p in raw.replace(";", ",").split(",")]
    if not isinstance(raw, (list, tuple, set)):
        return set()
    out: set[str] = set()
    for item in raw:
        s = str(item or "").strip()[:10]
        if len(s) == 10 and s[4] == "-" and s[7] == "-":
            out.add(s)
    return out


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
    """Return (surge_amount_paise, reason). Weekend + selected festival dates stack."""
    peak_fee = 0
    reason = None

    if booking_date and booking_date.isoweekday() in _weekend_days(db):
        amt = surge_amount_from_mode(
            base,
            get_setting(db, "weekend_surge_mode", "percent"),
            get_setting(db, "weekend_surge_percent", 0),
            get_setting(db, "weekend_surge_paise", 0),
        )
        if amt > 0:
            peak_fee += amt
            reason = "weekend"

    fest_dates = festival_date_set(get_setting(db, "festival_surge_dates", []))
    if booking_date and booking_date.isoformat() in fest_dates:
        amt = surge_amount_from_mode(
            base,
            get_setting(db, "festival_surge_mode", "amount"),
            get_setting(db, "festival_surge_percent", 0),
            get_setting(db, "festival_surge_paise", 0),
        )
        if amt > 0:
            peak_fee += amt
            reason = "festival" if reason is None else f"{reason}+festival"

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
    include_samagri: bool | None = None,
    include_alankaram: bool | None = None,
    include_food: bool | None = None,
    mode: str | None = None,
    country: str | None = None,
) -> dict:
    # Prefer explicit main_puja component when set; else basic/standard/premium package price.

    def _pkg(key: str) -> int:
        raw = service.get(key)
        if raw is not None:
            try:
                return int(raw)
            except (TypeError, ValueError):
                pass
        return 0

    virtual_tier = None
    if str(mode or "") == "virtual":
        from app.timezones import is_india_country

        virtual_tier = "domestic" if is_india_country(country) else "international"
        key = "virtual_domestic_price_paise" if virtual_tier == "domestic" else "virtual_international_price_paise"
        virt = _pkg(key) or _pkg("online_nri_price_paise")
        if virt <= 0:
            raise ValueError("Virtual Puja price is not configured for this service")
        base = virt
    else:
        main = service.get("main_puja_price_paise")
        if main is not None:
            base = int(main)
            std = _pkg("standard_price_paise")
            if package_type == "premium":
                prem = _pkg("premium_price_paise")
                if prem > std:
                    base = base + (prem - std)
            elif package_type == "basic":
                basic = _pkg("basic_price_paise")
                if basic > 0 and std > basic:
                    base = max(0, base - (std - basic))
        else:
            if package_type == "premium":
                base = _pkg("premium_price_paise")
            elif package_type == "basic":
                base = _pkg("basic_price_paise") or _pkg("standard_price_paise")
            else:
                base = _pkg("standard_price_paise")

    def _comp(key: str, default: int = 0) -> int:
        try:
            return max(0, int(service.get(key) if service.get(key) is not None else default))
        except (TypeError, ValueError):
            return default

    from app.service_addons import customer_samagri_price_paise

    samagri_list = customer_samagri_price_paise(db, service)
    alankaram = _comp("alankaram_price_paise")
    food = _comp("food_price_paise")
    alankaram_list = alankaram
    samagri_prov = (service.get("samagri_provider") or "included").lower()
    alankaram_prov = (service.get("alankaram_provider") or "included").lower()
    food_prov = (service.get("food_provider") or "included").lower()

    # Explicit customer opt-in (booking wizard): charge as reimbursable line items.
    # Always allow Samagri / Alankaram opt-in for every puja (availability flags no longer hide options).
    if include_samagri is not None or include_alankaram is not None or include_food is not None:
        food_on = bool(service.get("food_available"))
        samagri_charge = samagri_list if include_samagri and samagri_list > 0 else 0
        alankaram_charge = alankaram_list if include_alankaram and alankaram_list > 0 else 0
        food_charge = food if include_food and food_on and food > 0 else 0
        reimbursement = 0
        if include_samagri:
            samagri_prov = "reimbursable"
            if samagri_charge:
                reimbursement += samagri_charge
        if include_alankaram:
            alankaram_prov = "reimbursable"
            if alankaram_charge:
                reimbursement += alankaram_charge
        if include_food and food_charge:
            reimbursement += food_charge
            food_prov = "reimbursable"
    else:
        # Legacy: customer pays when included or reimbursable.
        chargeable_providers = {"included", "reimbursable"}
        samagri_charge = samagri_list if samagri_prov in chargeable_providers else 0
        alankaram_charge = alankaram if alankaram_prov in chargeable_providers else 0
        food_charge = food if food_prov in chargeable_providers else 0
        reimbursement = 0
        if samagri_prov == "reimbursable":
            reimbursement += samagri_list
        if alankaram_prov == "reimbursable":
            reimbursement += alankaram
        if food_prov == "reimbursable":
            reimbursement += food

    components_total = samagri_charge + alankaram_charge + food_charge

    loc_adj = location_adjustment_paise(db, str(service["id"]), city)
    adjusted_base = max(0, base + loc_adj)
    peak, peak_reason = surge_paise(
        db, service_id=str(service["id"]), base=adjusted_base, city=city, booking_date=booking_date
    )
    # Share split is on main puja only — components/reimbursements stay separate.
    subtotal = max(
        0,
        adjusted_base + peak + components_total - int(discount_paise or 0) - int(wallet_credit_paise or 0),
    )
    share = dakshina_share_percent(service)
    platform_fee = int(round(adjusted_base * (100 - share) / 100))
    pujari_share = adjusted_base - platform_fee
    pricing = db.execute(text("SELECT * FROM pricing_config WHERE id = 1")).mappings().one()
    gst_pct = float(pricing["gst_percent"])
    gst_amt = int(round(subtotal * gst_pct / 100))
    total = subtotal + gst_amt
    return {
        "basePrice": base,
        "mainPuja": base,
        "samagri": samagri_charge,
        "alankaram": alankaram_charge,
        "foodPrasadam": food_charge,
        "samagriListPrice": samagri_list,
        "alankaramListPrice": alankaram_list if include_alankaram is not None else alankaram,
        "foodListPrice": food,
        "componentsTotal": components_total,
        "pujariReimbursement": reimbursement,
        "samagriProvider": samagri_prov,
        "alankaramProvider": alankaram_prov,
        "foodProvider": food_prov,
        "includeSamagri": bool(include_samagri) if include_samagri is not None else None,
        "includeAlankaram": bool(include_alankaram) if include_alankaram is not None else None,
        "includeFood": bool(include_food) if include_food is not None else None,
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
        "mode": str(mode or ""),
        "virtualPriceTier": virtual_tier,
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
