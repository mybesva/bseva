from datetime import date, datetime, time
from decimal import Decimal
from math import cos, radians
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.geo import haversine_km


def row_dict(row) -> dict:
    d = dict(row)
    for k, v in list(d.items()):
        if isinstance(v, UUID):
            d[k] = str(v)
        elif isinstance(v, Decimal):
            d[k] = float(v)
        elif isinstance(v, (datetime, date, time)):
            d[k] = v.isoformat()
    return d


def hours_until(booking_date: date, start: time) -> float:
    """Hours until booking start, treating booking_date/start_time as Asia/Kolkata wall clock.

    Bookings store naive local India times; production hosts often run in UTC, so comparing
    with datetime.now() alone would open OTP/tracking windows at the wrong time.
    """
    try:
        from zoneinfo import ZoneInfo

        tz = ZoneInfo("Asia/Kolkata")
        start_dt = datetime.combine(booking_date, start, tzinfo=tz)
        now = datetime.now(tz)
    except Exception:
        start_dt = datetime.combine(booking_date, start)
        now = datetime.now()
    return (start_dt - now).total_seconds() / 3600.0


def cancel_policy(hours: float, db: Session | None = None, actor: str = "customer") -> dict:
    """Time-based cancel fees. `actor` is customer|pujari — each has admin-configurable %.

    Defaults match legacy: >48h → 10% fee, 24–48h → 50% fee, <24h → not allowed.
    """
    prefix = "pujari" if actor == "pujari" else "customer"
    over_48 = 10
    mid = 50
    min_hours = 24.0
    if db is not None:
        from app.platform_config import get_setting

        over_48 = int(get_setting(db, f"{prefix}_cancel_fee_over_48h_percent", over_48) or over_48)
        mid = int(get_setting(db, f"{prefix}_cancel_fee_24_48h_percent", mid) or mid)
        min_hours = float(get_setting(db, f"{prefix}_cancel_min_hours", min_hours) or min_hours)
    over_48 = max(0, min(100, over_48))
    mid = max(0, min(100, mid))
    min_hours = max(0.0, min_hours)
    if hours > 48:
        return {
            "allowed": True,
            "policy": ">48h",
            "fee_percent": over_48,
            "refund_percent": 100 - over_48,
            "hours": round(hours, 1),
            "min_hours": min_hours,
            "actor": prefix,
        }
    if hours >= min_hours:
        return {
            "allowed": True,
            "policy": f"{int(min_hours)}-48h",
            "fee_percent": mid,
            "refund_percent": 100 - mid,
            "hours": round(hours, 1),
            "min_hours": min_hours,
            "actor": prefix,
        }
    return {
        "allowed": False,
        "policy": f"<{int(min_hours)}h",
        "fee_percent": 0,
        "refund_percent": 0,
        "hours": round(hours, 1),
        "min_hours": min_hours,
        "actor": prefix,
    }


def pujari_blocked_on_slot(
    db: Session,
    pujari_id: str,
    booking_date: date,
    start: time,
    end: time,
) -> bool:
    """True if pujari marked this date/slot unavailable (calendar block)."""
    row = db.execute(
        text(
            """
            SELECT 1 FROM pujari_blocked_dates
            WHERE pujari_id = CAST(:pid AS uuid) AND blocked_date = :d
              AND (
                start_time IS NULL OR end_time IS NULL
                OR (start_time < :et AND end_time > :st)
              )
            LIMIT 1
            """
        ),
        {"pid": pujari_id, "d": booking_date, "st": start, "et": end},
    ).first()
    return row is not None


def pujari_free_for_slot(
    db: Session,
    pujari_id: str,
    booking_date: date,
    start: time,
    end: time,
) -> bool:
    if pujari_blocked_on_slot(db, pujari_id, booking_date, start, end):
        return False
    if slot_conflict(db, pujari_id, booking_date, start, end):
        return False
    return True


def slot_conflict(db: Session, pujari_id: str, booking_date: date, start: time, end: time) -> bool:
    row = db.execute(
        text(
            """
            SELECT 1 FROM bookings
            WHERE pujari_id = CAST(:pid AS uuid)
              AND booking_date = :d
              AND status IN ('pending', 'pending_acceptance', 'confirmed', 'in_progress')
              AND start_time < :end_t AND end_time > :start_t
            LIMIT 1
            """
        ),
        {"pid": pujari_id, "d": booking_date, "start_t": start, "end_t": end},
    ).first()
    return row is not None


SERVICE_RADIUS_KM = 10.0


def _eligible_pujari_location_rows(db: Session, required_level: int):
    """Approved, available, unblocked pujaris with coordinates (no coords returned to callers)."""
    return db.execute(
        text(
            """
            SELECT u.id, u.name, p.approved_level, p.verification_status, p.available,
                   p.latitude, p.longitude, p.service_radius_km, p.location_label,
                   p.experience_years, p.languages, p.specializations, p.city
            FROM pujari_profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.blocked = FALSE AND u.role IN ('pujari', 'head_pujari')
              AND p.verification_status = 'approved'
              AND p.approved_level IS NOT NULL AND p.approved_level >= :lvl
              AND p.available = TRUE
              AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
            """
        ),
        {"lvl": required_level},
    ).mappings().all()


def service_available_near(
    db: Session,
    lat: float,
    lng: float,
    required_level: int = 1,
    radius_km: float = SERVICE_RADIUS_KM,
) -> bool:
    """True if at least one eligible pujari is within radius_km of (lat, lng)."""
    pad = (radius_km * 1.2) / 111.0
    lng_pad = pad / max(0.2, abs(cos(radians(lat))))
    rows = db.execute(
        text(
            """
            SELECT p.latitude, p.longitude, p.service_radius_km
            FROM pujari_profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.blocked = FALSE AND u.role IN ('pujari', 'head_pujari')
              AND p.verification_status = 'approved'
              AND p.approved_level IS NOT NULL AND p.approved_level >= :lvl
              AND p.available = TRUE
              AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
              AND p.latitude BETWEEN :min_lat AND :max_lat
              AND p.longitude BETWEEN :min_lng AND :max_lng
            """
        ),
        {
            "lvl": required_level,
            "min_lat": lat - pad,
            "max_lat": lat + pad,
            "min_lng": lng - lng_pad,
            "max_lng": lng + lng_pad,
        },
    ).mappings().all()
    for r in rows:
        dist = haversine_km(lat, lng, float(r["latitude"]), float(r["longitude"]))
        effective = min(radius_km, float(r["service_radius_km"] or radius_km))
        if dist <= effective:
            return True
    return False


def pujari_covers_location(
    db: Session,
    pujari_id: str,
    lat: float,
    lng: float,
    radius_km: float = SERVICE_RADIUS_KM,
) -> bool:
    """True if the given eligible pujari is within radius of the booking location."""
    row = db.execute(
        text(
            """
            SELECT p.latitude, p.longitude, p.service_radius_km, p.available, p.verification_status,
                   u.blocked
            FROM pujari_profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.id = CAST(:id AS uuid)
            """
        ),
        {"id": pujari_id},
    ).mappings().first()
    if not row or row["blocked"] or row["verification_status"] != "approved" or not row["available"]:
        return False
    if row["latitude"] is None or row["longitude"] is None:
        return False
    dist = haversine_km(lat, lng, float(row["latitude"]), float(row["longitude"]))
    effective = min(radius_km, float(row["service_radius_km"] or radius_km))
    return dist <= effective


def nearby_pujaris(db: Session, lat: float, lng: float, required_level: int, radius_km: float = SERVICE_RADIUS_KM):
    rows = _eligible_pujari_location_rows(db, required_level)
    out = []
    for r in rows:
        dist = haversine_km(lat, lng, float(r["latitude"]), float(r["longitude"]))
        if dist <= min(radius_km, float(r["service_radius_km"] or radius_km)):
            item = row_dict(r)
            item["distance_km"] = round(dist, 2)
            # Strip coords and internal radius from public response
            item.pop("latitude", None)
            item.pop("longitude", None)
            item.pop("phone", None)
            item.pop("service_radius_km", None)
            from app.booking_visibility import public_pujari

            out.append(public_pujari(item))
    out.sort(key=lambda x: x["distance_km"])
    return out


def apply_wallet(db: Session, user_id: str, delta_paise: int, tx_type: str, description: str, booking_id=None, reference=None) -> int:
    w = db.execute(
        text("SELECT id, balance_paise, status FROM wallets WHERE user_id = CAST(:id AS uuid) FOR UPDATE"),
        {"id": user_id},
    ).mappings().first()
    if not w:
        raise ValueError("Wallet not found")
    if w["status"] != "active":
        raise ValueError("Wallet frozen")
    new_bal = int(w["balance_paise"]) + int(delta_paise)
    if new_bal < 0:
        raise ValueError("Insufficient wallet balance")
    db.execute(text("UPDATE wallets SET balance_paise = :b WHERE id = :id"), {"b": new_bal, "id": w["id"]})
    bid = UUID(str(booking_id)) if booking_id else None
    db.execute(
        text(
            """
            INSERT INTO wallet_transactions (wallet_id, amount_paise, type, booking_id, reference, description, status)
            VALUES (:wid, :amt, :typ, :bid, :ref, :descr, 'completed')
            """
        ),
        {
            "wid": w["id"],
            "amt": abs(int(delta_paise)),
            "typ": "credit" if tx_type == "credit" else "debit",
            "bid": bid,
            "ref": reference,
            "descr": description,
        },
    )
    return new_bal
