"""Seed a small realistic dataset. Fake identities only.

Keeps existing demo customers/pujaris/admin if already present.
Adds Super Admin + Head Pujari elevation when missing.
"""
from __future__ import annotations

import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

PASSWORD = "TestPass123!"

# Stable demo roster (do not change existing emails/phones)
USERS = [
    # Super Admin (new)
    {
        "name": "BSeva Super Admin",
        "email": "super@bseva.test",
        "phone": "9000000000",
        "role": "super_admin",
        "lang": "en",
        "cal": "north",
    },
    # Normal Admin (existing)
    {
        "name": "BSeva Admin",
        "email": "admin@bseva.test",
        "phone": "9000000001",
        "role": "admin",
        "lang": "en",
        "cal": "north",
    },
    # Customers (existing)
    {
        "name": "Ananya Customer",
        "email": "customer1@bseva.test",
        "phone": "9000000002",
        "role": "customer",
        "lang": "en",
        "cal": "north",
    },
    {
        "name": "Rohan Customer",
        "email": "customer2@bseva.test",
        "phone": "9000000003",
        "role": "customer",
        "lang": "hi",
        "cal": "north",
    },
    {
        "name": "Meera Customer",
        "email": "customer3@bseva.test",
        "phone": "9000000004",
        "role": "customer",
        "lang": "te",
        "cal": "south",
    },
    # Pujaris (existing) — Sharma is also Head Pujari
    {
        "name": "Pandit Sharma",
        "email": "pujari1@bseva.test",
        "phone": "9000000005",
        "role": "head_pujari",
        "lang": "hi",
        "cal": "north",
    },
    {
        "name": "Pandit Reddy",
        "email": "pujari2@bseva.test",
        "phone": "9000000006",
        "role": "pujari",
        "lang": "te",
        "cal": "south",
    },
]


def _database_url() -> str:
    for candidate in (Path(__file__).resolve().parents[1] / ".env", Path(__file__).resolve().parent / ".env"):
        if not candidate.exists():
            continue
        for line in candidate.read_text().splitlines():
            s = line.strip()
            if s.startswith("DATABASE_URL=") and not s.startswith("#"):
                return s.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DATABASE_URL missing from .env")


def _hash_password(plain: str) -> str:
    try:
        import bcrypt

        return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()
    except Exception:
        from passlib.context import CryptContext

        return CryptContext(schemes=["bcrypt"], deprecated="auto").hash(plain)


def _ensure_user(cur, pw: str, u: dict) -> bool:
    """Insert user if missing. Returns True if inserted."""
    cur.execute("SELECT id, role FROM users WHERE email = %s OR phone = %s", (u["email"], u["phone"]))
    row = cur.fetchone()
    if row:
        # Keep existing row; gently upgrade role only for known elevators
        if u["email"] == "pujari1@bseva.test" and row["role"] == "pujari":
            cur.execute(
                "UPDATE users SET role = 'head_pujari' WHERE id = %s AND role = 'pujari'",
                (row["id"],),
            )
        if u["email"] == "super@bseva.test" and row["role"] != "super_admin":
            cur.execute("UPDATE users SET role = 'super_admin' WHERE id = %s", (row["id"],))
        return False
    cur.execute(
        """
        INSERT INTO users (name, email, phone, password_hash, role, preferred_language, calendar_preference, phone_verified)
        VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
        """,
        (u["name"], u["email"], u["phone"], pw, u["role"], u["lang"], u["cal"]),
    )
    return True


def run() -> None:
    url = _database_url()
    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        pw = _hash_password(PASSWORD)
        inserted = 0
        for u in USERS:
            if _ensure_user(cur, pw, u):
                inserted += 1

        cur.execute("INSERT INTO wallets (user_id) SELECT id FROM users ON CONFLICT (user_id) DO NOTHING")

        # Customer profiles for any customer missing one
        cur.execute(
            """
            INSERT INTO customer_profiles (user_id, location_label, city, district, latitude, longitude, preferred_language, calendar_preference)
            SELECT u.id, 'Koramangala, Bengaluru', 'Bengaluru', 'Bengaluru Urban', 12.9352, 77.6245, u.preferred_language, u.calendar_preference
            FROM users u
            WHERE u.role = 'customer'
              AND NOT EXISTS (SELECT 1 FROM customer_profiles cp WHERE cp.user_id = u.id)
            """
        )

        # Pujari / head_pujari profiles
        cur.execute(
            """
            INSERT INTO pujari_profiles
              (user_id, requested_level, approved_level, verification_status, location_label, city, district,
               latitude, longitude, available, profile_complete, is_head_pujari)
            SELECT u.id,
              CASE WHEN u.email = 'pujari1@bseva.test' THEN 3 ELSE 2 END,
              CASE WHEN u.email = 'pujari1@bseva.test' THEN 3 ELSE 2 END,
              'approved',
              CASE WHEN u.email = 'pujari1@bseva.test' THEN 'Indiranagar, Bengaluru' ELSE 'HSR Layout, Bengaluru' END,
              'Bengaluru',
              'Bengaluru Urban',
              CASE WHEN u.email = 'pujari1@bseva.test' THEN 12.9784 ELSE 12.9121 END,
              CASE WHEN u.email = 'pujari1@bseva.test' THEN 77.6408 ELSE 77.6446 END,
              TRUE, TRUE,
              CASE WHEN u.email = 'pujari1@bseva.test' OR u.role = 'head_pujari' THEN TRUE ELSE FALSE END
            FROM users u
            WHERE u.role IN ('pujari', 'head_pujari')
              AND NOT EXISTS (SELECT 1 FROM pujari_profiles pp WHERE pp.user_id = u.id)
            """
        )
        # Ensure head flag on Sharma even if profile already existed
        cur.execute(
            """
            UPDATE pujari_profiles SET is_head_pujari = TRUE
            WHERE user_id = (SELECT id FROM users WHERE email = 'pujari1@bseva.test')
            """
        )
        cur.execute(
            """
            UPDATE users SET role = 'head_pujari'
            WHERE email = 'pujari1@bseva.test' AND role IN ('pujari', 'head_pujari')
            """
        )

        # Referral codes for pujaris / customers (best-effort)
        try:
            cur.execute(
                """
                UPDATE users SET referral_code = 'PUJARI0005-RC'
                WHERE email = 'pujari1@bseva.test' AND referral_code IS NULL
                """
            )
            cur.execute(
                """
                UPDATE users SET referral_code = 'PUJARI0006-RC'
                WHERE email = 'pujari2@bseva.test' AND referral_code IS NULL
                """
            )
            cur.execute(
                """
                UPDATE users SET referral_code = 'CUST0002-RC'
                WHERE email = 'customer1@bseva.test' AND referral_code IS NULL
                """
            )
            cur.execute(
                """
                UPDATE users SET referral_code = 'CUST0003-RC'
                WHERE email = 'customer2@bseva.test' AND referral_code IS NULL
                """
            )
            cur.execute(
                """
                UPDATE users SET referral_code = 'CUST0004-RC'
                WHERE email = 'customer3@bseva.test' AND referral_code IS NULL
                """
            )
        except Exception:
            pass

        # Services (only if empty)
        cur.execute("SELECT COUNT(*) AS n FROM services")
        if int(cur.fetchone()["n"] or 0) == 0:
            cur.execute(
                """
                INSERT INTO services (name, slug, description, required_level, standard_price_paise, premium_price_paise, duration_minutes, virtual_available)
                VALUES
                  ('Ganapathi Puja', 'ganapathi-puja', 'Household ganapathi puja', 2, 250000, 450000, 90, TRUE),
                  ('Satyanarayana Puja', 'satyanarayana-puja', 'Satyanarayana vratham', 2, 350000, 550000, 120, TRUE),
                  ('Griha Pravesham', 'griha-pravesham', 'House warming ceremony', 3, 750000, 1200000, 180, FALSE),
                  ('Marriage Ceremony', 'marriage-ceremony', 'Wedding rituals', 3, 2500000, 4000000, 240, FALSE),
                  ('Vehicle Puja', 'vehicle-puja', 'New vehicle puja', 1, 150000, 250000, 45, FALSE)
                """
            )

        # Wallet opening balances (only bump if zero)
        cur.execute(
            """
            UPDATE wallets SET balance_paise = 2000000
            WHERE balance_paise = 0
              AND user_id IN (SELECT id FROM users WHERE role = 'customer')
            """
        )
        cur.execute(
            """
            UPDATE wallets SET balance_paise = 500000
            WHERE balance_paise = 0
              AND user_id IN (SELECT id FROM users WHERE role IN ('pujari', 'head_pujari'))
            """
        )

        # Seed sample bookings only if none exist for demo numbers
        cur.execute("SELECT 1 FROM bookings WHERE booking_number = 'BSV-SEED-001'")
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO bookings (
                  booking_number, customer_id, pujari_id, service_id, package_type, mode,
                  booking_date, start_time, end_time, location_label, status, payment_status,
                  base_price_paise, peak_fee_paise, gst_percent, gst_amount_paise, total_paise, terms_accepted
                )
                SELECT
                  'BSV-SEED-001', c.id, p.id, s.id, 'standard', 'in_person',
                  CURRENT_DATE + 7, '09:00', '10:30', 'Koramangala, Bengaluru', 'confirmed', 'paid',
                  s.standard_price_paise, 0, 18,
                  ROUND(s.standard_price_paise * 0.18),
                  s.standard_price_paise + ROUND(s.standard_price_paise * 0.18),
                  TRUE
                FROM users c
                JOIN users p ON p.email = 'pujari1@bseva.test'
                JOIN services s ON s.slug = 'ganapathi-puja'
                WHERE c.email = 'customer1@bseva.test'
                """
            )
        cur.execute("SELECT 1 FROM bookings WHERE booking_number = 'BSV-SEED-002'")
        if not cur.fetchone():
            cur.execute(
                """
                INSERT INTO bookings (
                  booking_number, customer_id, pujari_id, service_id, package_type, mode,
                  booking_date, start_time, end_time, location_label, status, payment_status,
                  base_price_paise, peak_fee_paise, gst_percent, gst_amount_paise, total_paise, terms_accepted
                )
                SELECT
                  'BSV-SEED-002', c.id, p.id, s.id, 'premium', 'virtual',
                  CURRENT_DATE + 10, '11:00', '13:00', 'Virtual', 'confirmed', 'paid',
                  s.premium_price_paise, 0, 18,
                  ROUND(s.premium_price_paise * 0.18),
                  s.premium_price_paise + ROUND(s.premium_price_paise * 0.18),
                  TRUE
                FROM users c
                JOIN users p ON p.email = 'pujari2@bseva.test'
                JOIN services s ON s.slug = 'satyanarayana-puja'
                WHERE c.email = 'customer2@bseva.test'
                """
            )

        conn.commit()
        cur.execute("SELECT role, email, phone, name FROM users WHERE email LIKE '%@bseva.test' ORDER BY role, email")
        users = cur.fetchall()
        print("Seed complete (idempotent).")
        print(f"Inserted new users this run: {inserted}")
        print(f"Password for all test accounts: {PASSWORD}")
        print("")
        print(f"{'Role':14} {'Name':22} {'Email':24} Phone")
        print("-" * 78)
        for u in users:
            print(f"{u['role']:14} {u['name'][:22]:22} {u['email']:24} {u['phone']}")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    try:
        run()
    except Exception as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        sys.exit(1)
