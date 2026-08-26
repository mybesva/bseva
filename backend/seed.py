"""Seed a small realistic dataset. Fake identities only."""
from __future__ import annotations

import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

PASSWORD = "TestPass123!"


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


def run() -> None:
    url = _database_url()
    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT 1 FROM users WHERE email = 'admin@bseva.test'")
        if cur.fetchone():
            print("Seed already applied")
            return

        pw = _hash_password(PASSWORD)
        cur.execute(
            """
            INSERT INTO users (name, email, phone, password_hash, role, preferred_language, calendar_preference, phone_verified)
            VALUES
              ('BSeva Admin', 'admin@bseva.test', '9000000001', %s, 'admin', 'en', 'north', TRUE),
              ('Ananya Customer', 'customer1@bseva.test', '9000000002', %s, 'customer', 'en', 'north', TRUE),
              ('Rohan Customer', 'customer2@bseva.test', '9000000003', %s, 'customer', 'hi', 'north', TRUE),
              ('Meera Customer', 'customer3@bseva.test', '9000000004', %s, 'customer', 'te', 'south', TRUE),
              ('Pandit Sharma', 'pujari1@bseva.test', '9000000005', %s, 'pujari', 'hi', 'north', TRUE),
              ('Pandit Reddy', 'pujari2@bseva.test', '9000000006', %s, 'pujari', 'te', 'south', TRUE)
            """,
            (pw, pw, pw, pw, pw, pw),
        )
        cur.execute("INSERT INTO wallets (user_id) SELECT id FROM users ON CONFLICT (user_id) DO NOTHING")
        cur.execute(
            """
            INSERT INTO customer_profiles (user_id, location_label, city, latitude, longitude, preferred_language, calendar_preference)
            SELECT id, 'Koramangala, Bengaluru', 'Bengaluru', 12.9352, 77.6245, preferred_language, calendar_preference
            FROM users WHERE role = 'customer'
            """
        )
        cur.execute(
            """
            INSERT INTO pujari_profiles
              (user_id, requested_level, approved_level, verification_status, location_label, city,
               latitude, longitude, available, profile_complete)
            SELECT id,
              CASE WHEN email = 'pujari1@bseva.test' THEN 3 ELSE 2 END,
              CASE WHEN email = 'pujari1@bseva.test' THEN 3 ELSE 2 END,
              'approved',
              CASE WHEN email = 'pujari1@bseva.test' THEN 'Indiranagar, Bengaluru' ELSE 'HSR Layout, Bengaluru' END,
              'Bengaluru',
              CASE WHEN email = 'pujari1@bseva.test' THEN 12.9784 ELSE 12.9121 END,
              CASE WHEN email = 'pujari1@bseva.test' THEN 77.6408 ELSE 77.6446 END,
              TRUE, TRUE
            FROM users WHERE role = 'pujari'
            """
        )
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
        cur.execute(
            """
            UPDATE wallets SET balance_paise = 2000000
            WHERE user_id IN (SELECT id FROM users WHERE role = 'customer')
            """
        )
        cur.execute(
            """
            UPDATE wallets SET balance_paise = 500000
            WHERE user_id IN (SELECT id FROM users WHERE role = 'pujari')
            """
        )
        cur.execute(
            """
            INSERT INTO wallet_transactions (wallet_id, amount_paise, type, description)
            SELECT w.id, 2000000, 'credit', 'Opening wallet load'
            FROM wallets w JOIN users u ON u.id = w.user_id WHERE u.role = 'customer'
            """
        )
        cur.execute(
            """
            INSERT INTO wallet_transactions (wallet_id, amount_paise, type, description)
            SELECT w.id, 500000, 'credit', 'Demo earnings opening'
            FROM wallets w JOIN users u ON u.id = w.user_id WHERE u.role = 'pujari'
            """
        )
        cur.execute(
            """
            INSERT INTO bookings (
              booking_number, customer_id, pujari_id, service_id, package_type, mode,
              booking_date, start_time, end_time, location_label, status,
              base_price_paise, peak_fee_paise, gst_percent, gst_amount_paise, total_paise, terms_accepted
            )
            SELECT
              'BSV-SEED-001', c.id, p.id, s.id, 'standard', 'in_person',
              CURRENT_DATE + 7, '09:00', '10:30', 'Koramangala, Bengaluru', 'confirmed',
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
        cur.execute(
            """
            INSERT INTO bookings (
              booking_number, customer_id, pujari_id, service_id, package_type, mode,
              booking_date, start_time, end_time, location_label, status,
              base_price_paise, peak_fee_paise, gst_percent, gst_amount_paise, total_paise, terms_accepted
            )
            SELECT
              'BSV-SEED-002', c.id, p.id, s.id, 'premium', 'virtual',
              CURRENT_DATE + 10, '11:00', '13:00', 'Virtual', 'confirmed',
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
        cur.execute("SELECT role, email FROM users ORDER BY role, email")
        users = cur.fetchall()
        cur.execute("SELECT COUNT(*) AS n FROM services")
        services = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM bookings")
        bookings = cur.fetchone()["n"]
        cur.execute("SELECT COUNT(*) AS n FROM wallet_transactions")
        txs = cur.fetchone()["n"]
        print("Seed complete.")
        print(f"Users: {len(users)} | Services: {services} | Bookings: {bookings} | Wallet txs: {txs}")
        for u in users:
            print(f"  {u['role']:9} {u['email']}")
        print(f"Password for all test accounts: {PASSWORD}")
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
