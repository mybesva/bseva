"""Create real live-tracking test bookings for Customer 1 → pujari2.

Booking A: starts ~12 hours from now (within 24h unlock window).
Booking B: starts ~10 minutes from now (within 15m live-tracking window).

Usage (from backend/):
  python3 -m scripts.seed_live_tracking_bookings
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import text

from app.db import SessionLocal


CUSTOMER_EMAIL = "customer1@bseva.test"
PUJARI_EMAIL = "pujari2@bseva.test"
# Koramangala-ish service address (customer home for seed)
DEST_LAT = 12.9352
DEST_LNG = 77.6245


def _user_id(db, email: str) -> str:
    row = db.execute(text("SELECT id FROM users WHERE email = :e"), {"e": email}).first()
    if not row:
        raise RuntimeError(f"User not found: {email}. Run seed.py first.")
    return str(row[0])


def _active_service(db) -> dict:
    row = db.execute(
        text(
            """
            SELECT id, name, duration_minutes, standard_price_paise, required_level
            FROM services
            WHERE active = TRUE AND standard_price_paise IS NOT NULL
            ORDER BY name
            LIMIT 1
            """
        )
    ).mappings().first()
    if not row:
        raise RuntimeError("No active priced service found")
    return dict(row)


def _ensure_wallet(db, user_id: str, min_paise: int = 500_000) -> None:
    row = db.execute(
        text("SELECT balance_paise FROM wallets WHERE user_id = CAST(:id AS uuid)"),
        {"id": user_id},
    ).first()
    if not row:
        db.execute(
            text(
                """
                INSERT INTO wallets (user_id, balance_paise)
                VALUES (CAST(:id AS uuid), :bal)
                """
            ),
            {"id": user_id, "bal": min_paise},
        )
    elif int(row[0] or 0) < min_paise:
        db.execute(
            text(
                """
                UPDATE wallets SET balance_paise = :bal
                WHERE user_id = CAST(:id AS uuid)
                """
            ),
            {"id": user_id, "bal": min_paise},
        )


def _insert_booking(
    db,
    *,
    customer_id: str,
    pujari_id: str,
    service: dict,
    start_at: datetime,
    tag: str,
) -> dict:
    booking_id = str(uuid4())
    number = f"BSV-TRACK-{tag}-{booking_id[:6].upper()}"
    duration = int(service.get("duration_minutes") or 90)
    end_at = start_at + timedelta(minutes=duration)
    base = int(service.get("standard_price_paise") or 250000)
    platform = int(round(base * 0.15))
    gst = int(round(base * 0.18))
    total = base + gst
    payable = base - platform

    # Cancel prior open track-test bookings with same tag to keep data clean
    db.execute(
        text(
            """
            UPDATE bookings SET status = 'cancelled', updated_at = NOW()
            WHERE customer_id = CAST(:cid AS uuid)
              AND pujari_id = CAST(:pid AS uuid)
              AND booking_number LIKE :pat
              AND status IN ('pending', 'pending_acceptance', 'confirmed', 'in_progress')
            """
        ),
        {"cid": customer_id, "pid": pujari_id, "pat": f"BSV-TRACK-{tag}-%"},
    )

    db.execute(
        text(
            """
            INSERT INTO bookings (
              id, booking_number, customer_id, pujari_id, service_id, package_type, mode,
              booking_date, start_time, end_time, location_label, address, latitude, longitude,
              status, payment_status, settlement_status, rating_status,
              base_price_paise, peak_fee_paise, platform_fee_paise, pujari_payable_paise,
              gst_percent, gst_amount_paise, total_paise, terms_accepted, special_instructions,
              main_puja_charge_paise, accepted_at
            ) VALUES (
              CAST(:id AS uuid), :num, CAST(:cid AS uuid), CAST(:pid AS uuid), CAST(:sid AS uuid),
              'standard', 'in_person',
              :d, :st, :et, :loc, :addr, :lat, :lng,
              'confirmed', 'paid', 'pending', 'not_applicable',
              :base, 0, :plat, :payable, 18, :gst, :total, TRUE, :instr,
              :base, NOW()
            )
            """
        ),
        {
            "id": booking_id,
            "num": number,
            "cid": customer_id,
            "pid": pujari_id,
            "sid": str(service["id"]),
            "d": start_at.date(),
            "st": start_at.time().replace(microsecond=0),
            "et": end_at.time().replace(microsecond=0),
            "loc": "Koramangala, Bengaluru",
            "addr": "Demo address — live tracking test (Block A, Koramangala)",
            "lat": DEST_LAT,
            "lng": DEST_LNG,
            "base": base,
            "plat": platform,
            "payable": payable,
            "gst": gst,
            "total": total,
            "instr": f"LIVE_TRACKING_TEST:{tag}",
        },
    )
    return {
        "id": booking_id,
        "booking_number": number,
        "start_at": start_at.isoformat(sep=" ", timespec="minutes"),
        "tag": tag,
        "service": service.get("name"),
    }


def main() -> int:
    db = SessionLocal()
    try:
        customer_id = _user_id(db, CUSTOMER_EMAIL)
        pujari_id = _user_id(db, PUJARI_EMAIL)
        service = _active_service(db)
        _ensure_wallet(db, customer_id)

        now = datetime.now()
        b24 = _insert_booking(
            db,
            customer_id=customer_id,
            pujari_id=pujari_id,
            service=service,
            start_at=now + timedelta(hours=12),
            tag="24H",
        )
        b15 = _insert_booking(
            db,
            customer_id=customer_id,
            pujari_id=pujari_id,
            service=service,
            start_at=now + timedelta(minutes=10),
            tag="15M",
        )
        db.commit()

        print("OK — created confirmed bookings")
        print(f"  Customer: {CUSTOMER_EMAIL}")
        print(f"  Pujari:   {PUJARI_EMAIL}")
        print(f"  Service:  {service.get('name')}")
        print()
        print(f"  [24H] {b24['booking_number']}")
        print(f"        id={b24['id']}")
        print(f"        start={b24['start_at']}")
        print()
        print(f"  [15M] {b15['booking_number']}")
        print(f"        id={b15['id']}")
        print(f"        start={b15['start_at']}")
        print()
        print("Password for both demo users: TestPass123!")
        return 0
    except Exception as e:
        db.rollback()
        print("FAIL:", e)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
