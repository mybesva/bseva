"""Demo: create a live-tracking booking for Customer 1 → pujari2 (within ~10 min).

No redeploy needed: booking is set to ``in_progress`` so the tracking window
is open on production even if the server clock is UTC, and a GPS ping is
inserted so the customer map shows a pin immediately.

Usage (from backend/):
  python3 -m scripts.demo_live_tracking

Login:
  customer1@bseva.test / TestPass123!
  pujari2@bseva.test   / TestPass123!
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

from app import env_loader  # noqa: F401 — load DATABASE_URL
from app.db import SessionLocal

CUSTOMER_EMAIL = "customer1@bseva.test"
PUJARI_EMAIL = "pujari2@bseva.test"
DEST_LAT = 12.9352
DEST_LNG = 77.6245
# Pujari pin ~1 km from destination
PING_LAT = DEST_LAT + 0.008
PING_LNG = DEST_LNG - 0.005


def _uid(db, email: str) -> str:
    row = db.execute(text("SELECT id FROM users WHERE email = :e"), {"e": email}).first()
    if not row:
        raise SystemExit(f"User not found: {email}. Run: python3 seed.py")
    return str(row[0])


def main() -> int:
    db = SessionLocal()
    try:
        customer_id = _uid(db, CUSTOMER_EMAIL)
        pujari_id = _uid(db, PUJARI_EMAIL)
        service = db.execute(
            text(
                """
                SELECT id, name, duration_minutes, standard_price_paise
                FROM services
                WHERE active = TRUE AND standard_price_paise IS NOT NULL
                ORDER BY name LIMIT 1
                """
            )
        ).mappings().first()
        if not service:
            raise SystemExit("No active priced service found")

        # Cancel prior open demo track bookings
        db.execute(
            text(
                """
                UPDATE bookings SET status = 'cancelled', updated_at = NOW()
                WHERE customer_id = CAST(:cid AS uuid)
                  AND pujari_id = CAST(:pid AS uuid)
                  AND booking_number LIKE 'BSV-DEMO-TRACK-%'
                  AND status IN ('pending', 'pending_acceptance', 'confirmed', 'in_progress')
                """
            ),
            {"cid": customer_id, "pid": pujari_id},
        )

        now = datetime.now()
        start_at = now + timedelta(minutes=10)
        duration = int(service.get("duration_minutes") or 90)
        end_at = start_at + timedelta(minutes=duration)
        booking_id = str(uuid4())
        number = f"BSV-DEMO-TRACK-{booking_id[:6].upper()}"
        base = int(service.get("standard_price_paise") or 250000)
        platform = int(round(base * 0.15))
        gst = int(round(base * 0.18))
        total = base + gst
        payable = base - platform

        # in_progress → tracking API always open (no timezone / deploy dependency)
        db.execute(
            text(
                """
                INSERT INTO bookings (
                  id, booking_number, customer_id, pujari_id, service_id, package_type, mode,
                  booking_date, start_time, end_time, location_label, address, latitude, longitude,
                  status, payment_status, settlement_status, rating_status,
                  base_price_paise, peak_fee_paise, platform_fee_paise, pujari_payable_paise,
                  gst_percent, gst_amount_paise, total_paise, terms_accepted, special_instructions,
                  main_puja_charge_paise, accepted_at, started_at
                ) VALUES (
                  CAST(:id AS uuid), :num, CAST(:cid AS uuid), CAST(:pid AS uuid), CAST(:sid AS uuid),
                  'standard', 'in_person',
                  :d, :st, :et, :loc, :addr, :lat, :lng,
                  'in_progress', 'paid', 'pending', 'not_applicable',
                  :base, 0, :plat, :payable, 18, :gst, :total, TRUE, :instr,
                  :base, NOW(), NOW()
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
                "addr": "Demo address — live tracking (Block A, Koramangala)",
                "lat": DEST_LAT,
                "lng": DEST_LNG,
                "base": base,
                "plat": platform,
                "payable": payable,
                "gst": gst,
                "total": total,
                "instr": "DEMO_LIVE_TRACKING",
            },
        )

        db.execute(
            text(
                """
                INSERT INTO pujari_location_pings (booking_id, pujari_id, latitude, longitude)
                VALUES (CAST(:b AS uuid), CAST(:p AS uuid), :lat, :lng)
                """
            ),
            {"b": booking_id, "p": pujari_id, "lat": PING_LAT, "lng": PING_LNG},
        )

        # Ensure wallet has balance (harmless for already-paid demo booking)
        bal = db.execute(
            text("SELECT balance_paise FROM wallets WHERE user_id = CAST(:id AS uuid)"),
            {"id": customer_id},
        ).first()
        if not bal:
            db.execute(
                text("INSERT INTO wallets (user_id, balance_paise) VALUES (CAST(:id AS uuid), 500000)"),
                {"id": customer_id},
            )
        elif int(bal[0] or 0) < 100000:
            db.execute(
                text("UPDATE wallets SET balance_paise = 500000 WHERE user_id = CAST(:id AS uuid)"),
                {"id": customer_id},
            )

        db.commit()

        print("OK — demo live-tracking booking ready")
        print(f"  Booking:  {number}")
        print(f"  id:       {booking_id}")
        print(f"  Service:  {service['name']}")
        print(f"  Start:    {start_at.strftime('%Y-%m-%d %H:%M')} (local)")
        print(f"  Status:   in_progress (tracking open)")
        print(f"  Customer: {CUSTOMER_EMAIL}")
        print(f"  Pujari:   {PUJARI_EMAIL}")
        print(f"  Password: TestPass123!")
        print()
        print("Refresh customer dashboard → Ongoing Puja → live map.")
        return 0
    except Exception as e:
        db.rollback()
        print("FAIL:", e)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
