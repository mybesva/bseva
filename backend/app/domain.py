from datetime import date, datetime, time
from decimal import Decimal
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
    return (datetime.combine(booking_date, start) - datetime.now()).total_seconds() / 3600.0


def cancel_policy(hours: float) -> dict:
    if hours > 48:
        return {"allowed": True, "policy": ">48h", "fee_percent": 10, "refund_percent": 90}
    if hours >= 24:
        return {"allowed": True, "policy": "24-48h", "fee_percent": 50, "refund_percent": 50}
    return {"allowed": False, "policy": "<24h", "fee_percent": 0, "refund_percent": 0}


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


def nearby_pujaris(db: Session, lat: float, lng: float, required_level: int, radius_km: float = 10):
    rows = db.execute(
        text(
            """
            SELECT u.id, u.name, p.approved_level, p.verification_status, p.available,
                   p.latitude, p.longitude, p.service_radius_km, p.location_label,
                   p.experience_years, p.languages, p.specializations, p.city
            FROM pujari_profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.blocked = FALSE AND u.role = 'pujari'
              AND p.verification_status = 'approved'
              AND p.approved_level IS NOT NULL AND p.approved_level >= :lvl
              AND p.available = TRUE
              AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL
            """
        ),
        {"lvl": required_level},
    ).mappings().all()
    out = []
    for r in rows:
        dist = haversine_km(lat, lng, float(r["latitude"]), float(r["longitude"]))
        if dist <= min(radius_km, float(r["service_radius_km"] or radius_km)):
            item = row_dict(r)
            item["distance_km"] = round(dist, 2)
            # Strip coords from public response (keep distance only)
            item.pop("latitude", None)
            item.pop("longitude", None)
            item.pop("phone", None)
            out.append(item)
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
