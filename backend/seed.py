"""Seed a small realistic dataset. Fake identities only.

Keeps existing demo customers/pujaris/admin if already present.
Adds Super Admin + Head Pujari elevation when missing.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

_DEV_DEFAULT_PASSWORD = "TestPass123!"

# Hosted (QA) seeds must use SEED_PASSWORD from the secret store; the default is for local dev only.
PASSWORD = (os.environ.get("SEED_PASSWORD") or "").strip() or _DEV_DEFAULT_PASSWORD

# Stable demo roster (do not change existing emails/phones)
USERS = [
    # Super Admin (new)
    {
        "name": "BSeva Super Admin",
        "email": "super@bseva.test",
        "phone": "9000000000",
        "role": "super_admin",
        "lang": "en",
        "cal": "solar",
    },
    # Normal Admin (existing)
    {
        "name": "BSeva Admin",
        "email": "admin@bseva.test",
        "phone": "9000000001",
        "role": "admin",
        "lang": "en",
        "cal": "solar",
    },
    # Customers (existing)
    {
        "name": "Ananya Customer",
        "email": "customer1@bseva.test",
        "phone": "9000000002",
        "role": "customer",
        "lang": "en",
        "cal": "solar",
    },
    {
        "name": "Rohan Customer",
        "email": "customer2@bseva.test",
        "phone": "9000000003",
        "role": "customer",
        "lang": "hi",
        "cal": "solar",
    },
    {
        "name": "Meera Customer",
        "email": "customer3@bseva.test",
        "phone": "9000000004",
        "role": "customer",
        "lang": "te",
        "cal": "solar",
    },
    # Pujaris (existing) — Sharma is also Head Pujari
    {
        "name": "Pandit Sharma",
        "email": "pujari1@bseva.test",
        "phone": "9000000005",
        "role": "head_pujari",
        "lang": "hi",
        "cal": "solar",
    },
    {
        "name": "Pandit Reddy",
        "email": "pujari2@bseva.test",
        "phone": "9000000006",
        "role": "pujari",
        "lang": "te",
        "cal": "solar",
    },
]


def _database_url() -> str:
    env_url = (os.environ.get("DATABASE_URL") or "").strip()
    if env_url:
        return env_url.replace("postgresql+psycopg://", "postgresql://", 1)
    for candidate in (Path(__file__).resolve().parents[1] / ".env", Path(__file__).resolve().parent / ".env"):
        if not candidate.exists():
            continue
        for line in candidate.read_text().splitlines():
            s = line.strip()
            if s.startswith("DATABASE_URL=") and not s.startswith("#"):
                return s.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DATABASE_URL missing from .env")


def _connect(url: str):
    """psycopg2 when installed (local dev), otherwise psycopg 3 (the API's driver)."""
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor

        conn = psycopg2.connect(url)
        conn.autocommit = False
        return conn, conn.cursor(cursor_factory=RealDictCursor)
    except ImportError:
        import psycopg
        from psycopg.rows import dict_row

        conn = psycopg.connect(url, autocommit=False)
        return conn, conn.cursor(row_factory=dict_row)


def _hash_password(plain: str) -> str:
    try:
        import bcrypt

        return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()
    except Exception:
        from passlib.context import CryptContext

        return CryptContext(schemes=["bcrypt"], deprecated="auto").hash(plain)


# Main's admin@bseva.test permission set (RBAC v2), so the demo Admin works without a Super Admin granting it.
ADMIN_SEED_PERMISSIONS = [
    "create_customers", "create_pujaris", "edit_customers", "manage_bookings", "manage_invoices", "manage_muhurtham",
    "manage_promotions", "manage_recommendations", "manage_reviews", "manage_samagri", "manage_services",
    "manage_seva_events", "manage_support", "manage_temples", "manage_virtual_puja", "view_bookings", "view_customers",
    "view_invoices", "view_muhurtham", "view_payments", "view_promotions", "view_pujaris", "view_recommendations",
    "view_reviews", "view_samagri", "view_services", "view_seva_events", "view_temples", "view_virtual_puja",
]


def _password_matches(plain: str, hashed: str | None) -> bool:
    try:
        import bcrypt

        return bool(hashed) and bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def _ensure_user(cur, pw: str, u: dict) -> bool:
    """Insert the demo user, or bring an existing one (matched by email) back to the roster. True if inserted."""
    cur.execute("SELECT id, role, password_hash FROM users WHERE email = %s", (u["email"],))
    row = cur.fetchone()
    if row:
        # Sync the roster fields; the password hash changes only when it no longer matches SEED_PASSWORD.
        cur.execute(
            """
            UPDATE users SET name = %s, phone = %s, role = %s, email_verified = TRUE, phone_verified = TRUE,
                   blocked = FALSE, updated_at = NOW()
            WHERE id = %s
            """,
            (u["name"], u["phone"], u["role"], row["id"]),
        )
        if not _password_matches(PASSWORD, row.get("password_hash")):
            cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (pw, row["id"]))
        return False
    cur.execute("SELECT 1 FROM users WHERE phone = %s", (u["phone"],))
    if cur.fetchone():
        raise SystemExit(f"Phone {u['phone']} belongs to another account; refusing to create {u['email']}")
    cur.execute(
        """
        INSERT INTO users (name, email, phone, password_hash, role, preferred_language, calendar_preference,
                           phone_verified, email_verified)
        VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE, TRUE)
        """,
        (u["name"], u["email"], u["phone"], pw, u["role"], u["lang"], u["cal"]),
    )
    return True


def run() -> None:
    environment = (os.environ.get("ENVIRONMENT") or "development").strip().lower()
    if environment == "production":
        raise SystemExit("Refusing to seed demo data into production")
    if environment != "development" and not (os.environ.get("SEED_PASSWORD") or "").strip():
        raise SystemExit("Set SEED_PASSWORD (from the environment's secret store) to seed a hosted environment")
    url = _database_url()
    conn, cur = _connect(url)
    try:
        pw = _hash_password(PASSWORD)
        inserted = 0
        for u in USERS:
            if _ensure_user(cur, pw, u):
                inserted += 1

        cur.execute("INSERT INTO wallets (user_id) SELECT id FROM users ON CONFLICT (user_id) DO NOTHING")

        cur.execute(
            """
            INSERT INTO admin_permissions (user_id, permission)
            SELECT u.id, p FROM users u, unnest(%s::text[]) AS p
            WHERE u.email = 'admin@bseva.test' AND u.role = 'admin'
            ON CONFLICT (user_id, permission) DO NOTHING
            """,
            (ADMIN_SEED_PERMISSIONS,),
        )

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

        # Human-readable CUST-/PUJ- public IDs
        try:
            from app.public_ids import backfill_missing_public_ids
            from app.db import SessionLocal

            s = SessionLocal()
            try:
                backfill_missing_public_ids(s)
                s.commit()
            finally:
                s.close()
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
        # Ensure death / death-anniversary / astrology service rows (idempotent by slug)
        for name, slug, desc, cat, lvl, std, prm, muh in [
            ("Antyeshti (Death Rituals)", "antyeshti", "Death-related funeral and last rites support", "death", 3, 500000, 800000, False),
            ("Shraddha / Death Anniversary", "shraddha-death-anniversary", "Annual death anniversary rituals", "death_anniversary", 2, 350000, 550000, False),
            ("Astrology Consultation", "astrology-consultation", "General astrology consultation", "astrology", 2, 50000, 100000, False),
            ("Horoscope / Kundali Consultation", "kundali-consultation", "Kundali and horoscope reading", "astrology", 2, 75000, 150000, False),
            ("Muhurtham Consultation", "muhurta-consultation", "Standalone Muhurtham guidance", "astrology", 2, 30000, 50000, True),
        ]:
            cur.execute("SELECT 1 FROM services WHERE slug = %s", (slug,))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO services (
                      name, slug, description, category, required_level,
                      standard_price_paise, premium_price_paise, main_puja_price_paise,
                      duration_minutes, virtual_available, active,
                      muhurta_consultation_enabled, requires_muhurta
                    ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,60,TRUE,TRUE,%s,%s)
                    """,
                    (name, slug, desc, cat, lvl, std, prm, std, muh, muh),
                )
        # Enable muhurta on marriage / griha pravesh if columns exist
        try:
            cur.execute(
                """
                UPDATE services SET muhurta_consultation_enabled = TRUE, requires_muhurta = TRUE
                WHERE slug IN ('marriage-ceremony', 'griha-pravesham')
                """
            )
        except Exception:
            pass
        # Sample monthly recommendations
        try:
            cur.execute("SELECT COUNT(*) AS n FROM service_recommendations")
            if int(cur.fetchone()["n"] or 0) == 0:
                cur.execute(
                    """
                    INSERT INTO service_recommendations (service_id, title, description, month_number, recurrence_hint, sort_order)
                    SELECT id, 'Office Puja — Monthly', 'Recommended office wellbeing puja', EXTRACT(MONTH FROM CURRENT_DATE)::int, 'monthly', 1
                    FROM services WHERE slug = 'ganapathi-puja' LIMIT 1
                    """
                )
                cur.execute(
                    """
                    INSERT INTO service_recommendations (service_id, title, description, recurrence_hint, sort_order)
                    SELECT id, 'Shop Puja', 'Everyday / recurring shop puja recommendation', 'everyday', 2
                    FROM services WHERE slug = 'satyanarayana-puja' LIMIT 1
                    """
                )
        except Exception:
            pass

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
                  COALESCE(s.standard_price_paise, s.standard_price_paise, s.main_puja_price_paise, 0), 0, 18,
                  ROUND(COALESCE(s.standard_price_paise, s.standard_price_paise, s.main_puja_price_paise, 0) * 0.18),
                  COALESCE(s.standard_price_paise, s.standard_price_paise, s.main_puja_price_paise, 0) + ROUND(COALESCE(s.standard_price_paise, s.standard_price_paise, s.main_puja_price_paise, 0) * 0.18),
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
                  COALESCE(s.premium_price_paise, s.standard_price_paise, s.main_puja_price_paise, 0), 0, 18,
                  ROUND(COALESCE(s.premium_price_paise, s.standard_price_paise, s.main_puja_price_paise, 0) * 0.18),
                  COALESCE(s.premium_price_paise, s.standard_price_paise, s.main_puja_price_paise, 0) + ROUND(COALESCE(s.premium_price_paise, s.standard_price_paise, s.main_puja_price_paise, 0) * 0.18),
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
        print("Password for all test accounts: SEED_PASSWORD (not printed)")
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
        # Apply schema + Phase-1 catalog seed (idempotent; never overwrites live prices)
        sys.path.insert(0, str(Path(__file__).resolve().parent))
        from app.schema_migrate import ensure_schema

        ensure_schema()
        run()
    except Exception as exc:
        print(f"Seed failed: {exc}", file=sys.stderr)
        sys.exit(1)
