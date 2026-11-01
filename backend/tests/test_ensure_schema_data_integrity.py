"""Deployments must never change existing data.

The database tests run the real deploy step (`python -m app.db_bootstrap`) in a subprocess against a throwaway
PostgreSQL server, and compare every row of every table, including its xmin, so a rewrite that stores the same
values is caught too. Set BSEVA_TEST_PG_URL to a loopback server, for example:

    BSEVA_TEST_PG_URL=postgresql://postgres@127.0.0.1:5432/postgres python -m pytest tests/test_ensure_schema_data_integrity.py

Without it those tests skip, unless REQUIRE_PG_TESTS=1 (CI), which turns the skip into a failure.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import uuid
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import pytest

BACKEND = Path(__file__).resolve().parents[1]
MIGRATIONS = BACKEND.parent / "supabase" / "migrations"
PG_URL = os.environ.get("BSEVA_TEST_PG_URL", "").strip()
# Bookkeeping that a deploy is meant to write; everything else must stay identical.
TRACKING_TABLES = {"schema_migrations", "schema_migrations_meta", "schema_seed_state"}

CUSTOMER_1 = "00000000-0000-0000-0000-00000000c001"
CUSTOMER_2 = "00000000-0000-0000-0000-00000000c002"
PUJARI_1 = "00000000-0000-0000-0000-00000000f001"
PUJARI_2 = "00000000-0000-0000-0000-00000000f002"
BOOKING_1 = "00000000-0000-0000-0000-00000000b001"
BOOKING_2 = "00000000-0000-0000-0000-00000000b002"
WALLET_1 = "00000000-0000-0000-0000-00000000a001"
TICKET_1 = "00000000-0000-0000-0000-00000000d001"
FEATURED = "ganapathi-puja"
DRAFT = "hanuman-puja"

# What a used database looks like: real names, admin edits, and values every removed statement used to rewrite.
EXISTING_DATA = f"""
INSERT INTO users (id, name, email, phone, password_hash, role) VALUES
  ('{CUSTOMER_1}', 'Venkat Reddy', 'venkat@example.test', '9876500001', 'x', 'customer'),
  ('{CUSTOMER_2}', 'REDDY Lakshmi', 'lakshmi@example.test', '9876500002', 'x', 'customer'),
  ('{PUJARI_1}', 'Srinivasa Reddy', 'srinivasa@example.test', '9876500003', 'x', 'pujari'),
  ('{PUJARI_2}', 'Hari Sharma', 'hari@example.test', '9876500004', 'x', 'pujari');

INSERT INTO customer_profiles (user_id, calendar_preference) VALUES ('{CUSTOMER_1}', 'north');

INSERT INTO pujari_profiles (user_id, requested_level, full_name, mobile_number) VALUES
  ('{PUJARI_1}', 1, 'Srinivasa Reddy', '+91 98765-00003'),
  ('{PUJARI_2}', 1, 'Hari Sharma', '91 98765 00004');

INSERT INTO wallets (id, user_id, balance_paise) VALUES ('{WALLET_1}', '{CUSTOMER_1}', 150000);
INSERT INTO wallet_transactions (wallet_id, amount_paise, type, description) VALUES
  ('{WALLET_1}', 100000, 'credit', 'Wallet load (demo)'),
  ('{WALLET_1}', 50000, 'credit', 'Demo payment received');

UPDATE services SET
  short_description = 'Admin copy', process_steps = '["Admin step"]'::jsonb, image_url = '/admin/ganapathi.jpg',
  image_path = '/admin/ganapathi.jpg', is_featured_home = FALSE, homepage_rank = NULL, display_order = 999,
  pujaris_required = 2, standard_pujaris_required = 2, standard_price_paise = 777700, main_puja_price_paise = NULL,
  online_nri_price_paise = 123400, virtual_domestic_price_paise = NULL, virtual_international_price_paise = NULL,
  name = 'Wedding Muhurta Special', search_aliases = '["admin alias"]'::jsonb
WHERE slug = '{FEATURED}';

UPDATE services SET standard_price_paise = NULL, main_puja_price_paise = NULL, basic_price_paise = NULL,
  premium_price_paise = NULL, pricing_status = 'awaiting_pricing' WHERE slug = '{DRAFT}';

UPDATE service_categories SET name = 'Admin Category', sort_order = 77, active = FALSE
WHERE id = (SELECT id FROM service_categories ORDER BY slug LIMIT 1);

DELETE FROM service_samagri WHERE id IN (
  SELECT ss.id FROM service_samagri ss JOIN services s ON s.id = ss.service_id WHERE s.slug = '{FEATURED}' LIMIT 1
);

INSERT INTO service_translations (service_id, language_code, short_description, full_description)
SELECT id, 'en', 'Admin en text', 'Admin en full' FROM services WHERE slug = '{FEATURED}'
ON CONFLICT (service_id, language_code) DO UPDATE SET short_description = EXCLUDED.short_description,
  full_description = EXCLUDED.full_description;

INSERT INTO service_translations (service_id, language_code, name, short_description, full_description)
SELECT id, 'hi', 'Admin hi name', 'Admin hi text', 'Admin hi full' FROM services WHERE slug = '{FEATURED}'
ON CONFLICT (service_id, language_code) DO UPDATE SET name = EXCLUDED.name,
  short_description = EXCLUDED.short_description, full_description = EXCLUDED.full_description;

UPDATE category_translations SET name = 'Admin translated'
WHERE (category_id, language_code) IN (SELECT category_id, language_code FROM category_translations LIMIT 1);

UPDATE samagri_item_translations SET item_name = 'Admin samagri name'
WHERE id IN (SELECT id FROM samagri_item_translations LIMIT 1);

UPDATE service_preparation_content SET preparation_notes = 'Admin notes'
WHERE id IN (SELECT id FROM service_preparation_content LIMIT 1);

UPDATE legal_policies SET points = '[{{"title": "Admin", "body": "Admin legal text"}}]'::jsonb, version = '2026-11'
WHERE slug IN ('cancellation_policy', 'booking_terms');

UPDATE platform_settings SET value = '24'::jsonb WHERE key = 'pujari_full_booking_details_before_hours';
UPDATE platform_settings SET value = '"BSeva"'::jsonb WHERE key = 'invoice_company_name';
UPDATE platform_settings SET value = '""'::jsonb WHERE key = 'invoice_company_address';
UPDATE platform_settings SET value = '"B-Seva"'::jsonb WHERE key = 'invoice_brand_name';
DELETE FROM platform_settings WHERE key = 'invoice_notes';

UPDATE pujari_roles SET title = 'Admin Role Title' WHERE level = 2;
DELETE FROM pujari_roles WHERE level = 6;
UPDATE reward_campaigns SET reward_paise = 12345 WHERE code = 'PUJARI_LOYALTY_10';
DELETE FROM reward_campaigns WHERE code = 'CUSTOMER_REF_100';

INSERT INTO bookings (
  id, booking_number, customer_id, pujari_id, service_id, package_type, mode, booking_date, start_time, end_time,
  base_price_paise, gst_percent, gst_amount_paise, total_paise, status, settlement_status, pujaris_required
)
SELECT '{BOOKING_1}', 'BSV-IT-1', '{CUSTOMER_1}', '{PUJARI_1}', id, 'standard', 'in_person', '2026-11-20', '10:00', '12:00',
  100000, 18, 18000, 118000, 'confirmed', 'not_applicable', 1
FROM services WHERE slug = '{FEATURED}';

INSERT INTO bookings (
  id, booking_number, customer_id, pujari_id, service_id, package_type, mode, booking_date, start_time, end_time,
  base_price_paise, gst_percent, gst_amount_paise, total_paise, status, settlement_status, pujaris_required
)
SELECT '{BOOKING_2}', 'BSV-IT-2', '{CUSTOMER_2}', '{PUJARI_2}', id, 'standard', 'in_person', '2026-10-20', '10:00', '12:00',
  100000, 18, 18000, 118000, 'completed', 'not_applicable', 1
FROM services WHERE slug = '{FEATURED}';

INSERT INTO otp_codes (phone, booking_id, code_hash, purpose, expires_at)
VALUES ('9876500001', '{BOOKING_1}', 'x', 'complete_puja', NOW() + INTERVAL '1 hour');

INSERT INTO support_tickets (id, ticket_number, user_id, user_role, category, subject, description, priority, reporter_type)
VALUES ('{TICKET_1}', 'TKT-IT-1', '{CUSTOMER_1}', 'customer', 'booking', 'Subject', 'Description', 'normal', NULL);
UPDATE support_tickets SET last_activity_at = NULL WHERE id = '{TICKET_1}';
"""


def _server_url(database: str) -> str:
    parts = urlsplit(PG_URL.replace("postgresql+psycopg://", "postgresql://", 1))
    return urlunsplit((parts.scheme, parts.netloc, f"/{database}", "", ""))


def _admin():
    import psycopg

    return psycopg.connect(_server_url("postgres"), autocommit=True, connect_timeout=10)


def _db(name: str):
    import psycopg

    return psycopg.connect(_server_url(name), autocommit=True, connect_timeout=10)


def _environment(database: str, **extra: str) -> dict[str, str]:
    url = _server_url(database).replace("postgresql://", "postgresql+psycopg://", 1)
    return {
        "PATH": os.environ.get("PATH", ""),
        "HOME": os.environ.get("HOME", ""),
        "PYTHONDONTWRITEBYTECODE": "1",
        "ENVIRONMENT": "development",
        "DATABASE_URL": url,  # beats backend/.env, so these runs can only reach the test server
        **extra,
    }


def _deploy(database: str, **extra: str) -> str:
    """One deploy's migration step, exactly as deploy/host/deploy.sh runs it."""
    done = subprocess.run(
        [sys.executable, "-m", "app.db_bootstrap"],
        cwd=BACKEND, env=_environment(database, **extra), capture_output=True, text=True, timeout=240,
    )
    assert done.returncode == 0, done.stdout + done.stderr
    return done.stdout


def _python(database: str, code: str, **extra: str) -> str:
    done = subprocess.run(
        [sys.executable, "-c", code],
        cwd=BACKEND, env=_environment(database, **extra), capture_output=True, text=True, timeout=240,
    )
    assert done.returncode == 0, done.stdout + done.stderr
    return done.stdout


def _snapshot(database: str) -> dict[str, list[tuple[str, str]]]:
    with _db(database) as conn:
        tables = [r[0] for r in conn.execute(
            "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1"
        ).fetchall()]
        return {
            table: conn.execute(f'SELECT t.xmin::text, to_jsonb(t)::text FROM "{table}" t ORDER BY 2, 1').fetchall()
            for table in tables if table not in TRACKING_TABLES
        }


def _differences(before: dict, after: dict) -> dict[str, str]:
    changed = {}
    for table in sorted(set(before) | set(after)):
        old, new = before.get(table, []), after.get(table, [])
        if old != new:
            changed[table] = f"{len(set(old) - set(new))} row(s) changed or removed, {len(set(new) - set(old))} changed or added"
    return changed


def _one(database: str, sql: str, *params):
    with _db(database) as conn:
        row = conn.execute(sql, params).fetchone()
    return row[0] if row else None


def _forget_seed_state(database: str) -> None:
    """A database as it was before seed tracking existed."""
    with _db(database) as conn:
        conn.execute("DROP TABLE IF EXISTS schema_seed_state")


@pytest.fixture(scope="session")
def pg_server():
    if not PG_URL:
        if os.environ.get("REQUIRE_PG_TESTS") == "1":
            pytest.fail("REQUIRE_PG_TESTS=1 but BSEVA_TEST_PG_URL is not set")
        pytest.skip("BSEVA_TEST_PG_URL is not set")
    host = urlsplit(PG_URL).hostname
    assert host in ("127.0.0.1", "localhost", "::1"), f"refusing a non-loopback test server: {host}"
    pytest.importorskip("psycopg")
    return PG_URL


@pytest.fixture(scope="session")
def templates(pg_server):
    """Fresh database built by a real deploy, and the same database after real use."""
    suffix = uuid.uuid4().hex[:10]
    fresh, used = f"bseva_it_fresh_{suffix}", f"bseva_it_used_{suffix}"
    try:
        with _admin() as conn:
            conn.execute(f'CREATE DATABASE "{fresh}"')
        _deploy(fresh)
        with _admin() as conn:
            conn.execute(f'CREATE DATABASE "{used}" TEMPLATE "{fresh}"')
        with _db(used) as conn:
            conn.execute(EXISTING_DATA)
        yield {"fresh": fresh, "used": used}
    finally:
        with _admin() as conn:
            conn.execute(f'DROP DATABASE IF EXISTS "{fresh}" WITH (FORCE)')
            conn.execute(f'DROP DATABASE IF EXISTS "{used}" WITH (FORCE)')


@pytest.fixture
def clone(templates):
    made: list[str] = []

    def make(kind: str) -> str:
        name = f"bseva_it_{uuid.uuid4().hex[:12]}"
        with _admin() as conn:
            conn.execute(f'CREATE DATABASE "{name}" TEMPLATE "{templates[kind]}"')
        made.append(name)
        return name

    yield make
    with _admin() as conn:
        for name in made:
            conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


# --- Whole-database guarantees -------------------------------------------------------------------------------


@pytest.mark.parametrize("seed_state", ["tracked", "from_before_tracking"])
def test_repeated_deployments_leave_every_row_untouched(clone, seed_state):
    database = clone("used")
    if seed_state == "from_before_tracking":
        _forget_seed_state(database)
    before = _snapshot(database)
    for _ in range(3):
        _deploy(database, RUN_ENSURE_SCHEMA="always")
    assert _differences(before, _snapshot(database)) == {}


def test_deployment_with_a_pending_migration_changes_only_what_that_migration_says(clone, tmp_path):
    database = clone("used")
    before = _snapshot(database)
    folder = tmp_path / "migrations"
    shutil.copytree(MIGRATIONS, folder)
    (folder / "999_versioned_change.sql").write_text(
        f"UPDATE users SET name = 'Versioned Name' WHERE id = '{PUJARI_2}';\n", encoding="utf-8"
    )
    _deploy(database, MIGRATIONS_DIR=str(folder))
    assert _differences(before, _snapshot(database)) == {"users": "1 row(s) changed or removed, 1 changed or added"}
    assert _one(database, "SELECT name FROM users WHERE id = %s", PUJARI_2) == "Versioned Name"
    assert _one(database, "SELECT 1 FROM schema_migrations WHERE filename = '999_versioned_change.sql'") == 1


def test_database_without_migration_tracking_is_baselined_and_untouched(clone):
    database = clone("used")
    _forget_seed_state(database)
    with _db(database) as conn:
        conn.execute("DROP TABLE schema_migrations")
    before = _snapshot(database)
    _deploy(database)
    assert _differences(before, _snapshot(database)) == {}


def test_existing_catalogue_with_no_accounts_yet_is_not_reseeded(clone):
    """A new environment after its catalogue import, before anyone has signed up."""
    database = clone("used")
    _forget_seed_state(database)
    with _db(database) as conn:
        conn.execute(
            "TRUNCATE users, bookings, wallets, wallet_transactions, support_tickets, otp_codes, "
            "customer_profiles, pujari_profiles CASCADE"
        )
    before = _snapshot(database)
    _deploy(database, RUN_ENSURE_SCHEMA="always")
    assert _differences(before, _snapshot(database)) == {}


def test_all_schema_statements_succeed_on_a_used_database(clone):
    """Including a stored `complete_puja` OTP, which an out-of-date constraint used to reject."""
    database = clone("used")
    out = _python(
        database,
        "import json; from app.schema_migrate import ensure_schema; print(json.dumps(ensure_schema(quiet=True)))",
    )
    assert json.loads(out.strip().splitlines()[-1]) == []


# --- Each overwrite named in the audit -----------------------------------------------------------------------


@pytest.fixture(scope="module")
def deployed(templates):
    """The used database after two more deployments."""
    name = f"bseva_it_deployed_{uuid.uuid4().hex[:10]}"
    with _admin() as conn:
        conn.execute(f'CREATE DATABASE "{name}" TEMPLATE "{templates["used"]}"')
    _forget_seed_state(name)
    _deploy(name, RUN_ENSURE_SCHEMA="always")
    _deploy(name, RUN_ENSURE_SCHEMA="always")
    yield name
    with _admin() as conn:
        conn.execute(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


AUDITED_OVERWRITES = [
    ("customer surname Reddy", f"SELECT name FROM users WHERE id = '{CUSTOMER_1}'", "Venkat Reddy"),
    ("customer name in capitals", f"SELECT name FROM users WHERE id = '{CUSTOMER_2}'", "REDDY Lakshmi"),
    ("pujari surname Reddy", f"SELECT name FROM users WHERE id = '{PUJARI_1}'", "Srinivasa Reddy"),
    ("verified pujari full name", f"SELECT full_name FROM pujari_profiles WHERE user_id = '{PUJARI_1}'", "Srinivasa Reddy"),
    ("pujari mobile as entered", f"SELECT mobile_number FROM pujari_profiles WHERE user_id = '{PUJARI_1}'", "+91 98765-00003"),
    ("pujari mobile with country code", f"SELECT mobile_number FROM pujari_profiles WHERE user_id = '{PUJARI_2}'", "91 98765 00004"),
    ("customer calendar value", f"SELECT calendar_preference FROM customer_profiles WHERE user_id = '{CUSTOMER_1}'", "north"),
    ("public id not assigned by a deploy", f"SELECT public_id IS NULL FROM users WHERE id = '{CUSTOMER_2}'", True),
    ("booking settlement status", f"SELECT settlement_status FROM bookings WHERE id = '{BOOKING_1}'", "not_applicable"),
    ("completed booking settlement status", f"SELECT settlement_status FROM bookings WHERE id = '{BOOKING_2}'", "not_applicable"),
    ("booked pujari count", f"SELECT pujaris_required FROM bookings WHERE id = '{BOOKING_1}'", 1),
    ("wallet ledger text", f"SELECT count(*) FROM wallet_transactions WHERE wallet_id = '{WALLET_1}' AND description = 'Wallet load (demo)'", 1),
    ("wallet ledger second text", f"SELECT count(*) FROM wallet_transactions WHERE wallet_id = '{WALLET_1}' AND description = 'Demo payment received'", 1),
    ("ticket priority", f"SELECT priority FROM support_tickets WHERE id = '{TICKET_1}'", "normal"),
    ("ticket reporter", f"SELECT reporter_type IS NULL FROM support_tickets WHERE id = '{TICKET_1}'", True),
    ("ticket activity", f"SELECT last_activity_at IS NULL FROM support_tickets WHERE id = '{TICKET_1}'", True),
    ("service name", f"SELECT name FROM services WHERE slug = '{FEATURED}'", "Wedding Muhurta Special"),
    ("service image", f"SELECT image_url FROM services WHERE slug = '{FEATURED}'", "/admin/ganapathi.jpg"),
    ("service copy", f"SELECT short_description FROM services WHERE slug = '{FEATURED}'", "Admin copy"),
    ("service process steps", f"SELECT process_steps::text FROM services WHERE slug = '{FEATURED}'", '["Admin step"]'),
    ("service aliases", f"SELECT search_aliases::text FROM services WHERE slug = '{FEATURED}'", '["admin alias"]'),
    ("home page merchandising", f"SELECT is_featured_home FROM services WHERE slug = '{FEATURED}'", False),
    ("display order", f"SELECT display_order FROM services WHERE slug = '{FEATURED}'", 999),
    ("cleared main price", f"SELECT main_puja_price_paise IS NULL FROM services WHERE slug = '{FEATURED}'", True),
    ("cleared virtual price", f"SELECT virtual_domestic_price_paise IS NULL FROM services WHERE slug = '{FEATURED}'", True),
    ("draft has no invented price", f"SELECT standard_price_paise IS NULL FROM services WHERE slug = '{DRAFT}'", True),
    ("deactivated category", "SELECT active FROM service_categories WHERE name = 'Admin Category'", False),
    ("category order", "SELECT sort_order FROM service_categories WHERE name = 'Admin Category'", 77),
    ("english translation", f"SELECT st.short_description FROM service_translations st JOIN services s ON s.id = st.service_id WHERE s.slug = '{FEATURED}' AND st.language_code = 'en'", "Admin en text"),
    ("hindi translation", f"SELECT st.name FROM service_translations st JOIN services s ON s.id = st.service_id WHERE s.slug = '{FEATURED}' AND st.language_code = 'hi'", "Admin hi name"),
    ("category translation", "SELECT count(*) FROM category_translations WHERE name = 'Admin translated'", 1),
    ("samagri translation", "SELECT count(*) FROM samagri_item_translations WHERE item_name = 'Admin samagri name'", 1),
    ("preparation notes", "SELECT count(*) FROM service_preparation_content WHERE preparation_notes = 'Admin notes'", 1),
    ("cancellation policy text", "SELECT points->0->>'body' FROM legal_policies WHERE slug = 'cancellation_policy'", "Admin legal text"),
    ("cancellation policy version", "SELECT version FROM legal_policies WHERE slug = 'cancellation_policy'", "2026-11"),
    ("booking terms text", "SELECT points->0->>'body' FROM legal_policies WHERE slug = 'booking_terms'", "Admin legal text"),
    ("24 hour setting", "SELECT value::text FROM platform_settings WHERE key = 'pujari_full_booking_details_before_hours'", "24"),
    ("invoice company", "SELECT value #>> '{}' FROM platform_settings WHERE key = 'invoice_company_name'", "BSeva"),
    ("empty invoice address", "SELECT value #>> '{}' FROM platform_settings WHERE key = 'invoice_company_address'", ""),
    ("invoice brand", "SELECT value #>> '{}' FROM platform_settings WHERE key = 'invoice_brand_name'", "B-Seva"),
    ("removed setting", "SELECT count(*) FROM platform_settings WHERE key = 'invoice_notes'", 0),
    ("pujari role title", "SELECT title FROM pujari_roles WHERE level = 2", "Admin Role Title"),
    ("removed pujari role", "SELECT count(*) FROM pujari_roles WHERE level = 6", 0),
    ("campaign amount", "SELECT reward_paise FROM reward_campaigns WHERE code = 'PUJARI_LOYALTY_10'", 12345),
    ("removed campaign", "SELECT count(*) FROM reward_campaigns WHERE code = 'CUSTOMER_REF_100'", 0),
]


@pytest.mark.parametrize("what, sql, expected", AUDITED_OVERWRITES, ids=[case[0] for case in AUDITED_OVERWRITES])
def test_overwrite_from_the_audit_no_longer_happens(deployed, what, sql, expected):
    assert _one(deployed, sql) == expected, what


# --- New databases still get their reference data ------------------------------------------------------------


def test_fresh_database_gets_reference_data_once(templates):
    database = templates["fresh"]
    assert _one(database, "SELECT count(*) FROM services") > 50
    assert _one(database, "SELECT count(*) FROM service_categories") > 10
    assert _one(database, "SELECT count(*) FROM service_category_map") > 50
    assert _one(database, "SELECT count(*) FROM legal_policies") == 5
    assert _one(database, "SELECT count(*) FROM pujari_roles") == 6
    assert _one(database, "SELECT count(*) FROM reward_campaigns") == 3
    assert _one(database, "SELECT count(*) FROM samagri_items") > 50
    assert _one(database, "SELECT count(*) FROM service_translations") > 50
    assert _one(database, "SELECT count(*) FROM services WHERE is_featured_home") >= 10
    assert _one(database, "SELECT value::text FROM platform_settings WHERE key = 'pujari_full_booking_details_before_hours'") == "20"
    assert _one(database, "SELECT version FROM legal_policies WHERE slug = 'cancellation_policy'") == "2026-09"
    # Created by the import, then enriched by the second seed pass.
    assert _one(database, "SELECT image_url FROM services WHERE slug = 'satyanarayana-puja'") == "/images/services/satyanarayana-puja.jpg"
    assert _one(database, "SELECT count(*) FROM services WHERE standard_price_paise = 500000 AND pricing_status = 'awaiting_pricing'") == 0


def test_fresh_database_is_unchanged_by_later_deployments(clone):
    database = clone("fresh")
    before = _snapshot(database)
    for _ in range(2):
        assert "ensure_schema_ok" in _deploy(database, RUN_ENSURE_SCHEMA="always")
    assert _differences(before, _snapshot(database)) == {}


def test_seed_that_failed_on_a_new_database_is_retried(clone):
    database = clone("fresh")
    with _db(database) as conn:
        conn.execute("DELETE FROM schema_seed_state WHERE key = 'reward_campaigns'")
        conn.execute("DELETE FROM reward_campaigns")
    _deploy(database, RUN_ENSURE_SCHEMA="always")
    assert _one(database, "SELECT count(*) FROM reward_campaigns") == 3


def test_unfinished_seed_never_runs_once_the_database_has_users(clone):
    database = clone("used")
    with _db(database) as conn:
        conn.execute("DELETE FROM schema_seed_state WHERE key = 'reward_campaigns'")
        conn.execute("DELETE FROM reward_campaigns")
    _deploy(database, RUN_ENSURE_SCHEMA="always")
    assert _one(database, "SELECT count(*) FROM reward_campaigns") == 0


def test_demo_seed_can_run_repeatedly_and_assigns_public_ids(clone):
    database = clone("fresh")
    for _ in range(2):
        done = subprocess.run(
            [sys.executable, "seed.py"],
            cwd=BACKEND, env=_environment(database), capture_output=True, text=True, timeout=60,
        )
        assert done.returncode == 0, done.stdout + done.stderr
    assert _one(database, "SELECT count(*) FROM users WHERE role IN ('customer', 'pujari') AND public_id IS NULL") == 0
    assert _one(database, "SELECT name FROM users WHERE email = 'pujari2@bseva.test'") == "Pandit"


def test_import_without_source_documents_changes_nothing(clone, tmp_path):
    """docs/ is not in the API image, so this is what the import saw on AWS."""
    database = clone("fresh")
    before = _snapshot(database)
    code = (
        "from pathlib import Path\n"
        "from app.db import engine\n"
        "import app.puja_catalog_import as pci\n"
        f"pci.SRC_DIR = Path({str(tmp_path)!r})\n"
        "with engine.begin() as conn:\n"
        "    print(pci.ensure_puja_catalog_import(conn))\n"
    )
    assert "skipped" in _python(database, code)
    assert _differences(before, _snapshot(database)) == {}


# --- Static guards: these run everywhere, with no database -----------------------------------------------------


def _schema_statement_lists() -> dict[str, list[str]]:
    from app import schema_migrate as sm
    from app.phase2_migrate import _PHASE2_STMTS
    from app.phase3_migrate import _PHASE3_STMTS
    from app.phase4_catalog_migrate import _PHASE4_STMTS
    from app.phase5_samagri_migrate import _PHASE5_STMTS
    from app.phase6_puja_master_migrate import _PHASE6_STMTS
    from app.phase7_booking_offers_migrate import _PHASE7_STMTS

    return {
        "_STMTS": sm._STMTS,
        "_FOUNDATION_STMTS": sm._FOUNDATION_STMTS,
        "_SECURITY_STMTS": sm._SECURITY_STMTS,
        "_SPECIALIZED_ROLE_SCHEMA_STMTS": sm._SPECIALIZED_ROLE_SCHEMA_STMTS,
        "phase2": _PHASE2_STMTS,
        "phase3": _PHASE3_STMTS,
        "phase4": _PHASE4_STMTS,
        "phase5": _PHASE5_STMTS,
        "phase6": _PHASE6_STMTS,
        "phase7": _PHASE7_STMTS,
    }


DATA_CHANGE = re.compile(r"(?<!ON )(?<!FOR )(?<!DO )\bUPDATE\s+\w+|\bDELETE\s+FROM\b|\bINSERT\s+INTO\b|\bTRUNCATE\b|\bMERGE\s+INTO\b", re.I)


def test_schema_statements_contain_no_data_changes():
    offenders = [
        f"{name}: {' '.join(stmt.split())[:100]}"
        for name, stmts in _schema_statement_lists().items()
        for stmt in stmts
        if DATA_CHANGE.search(stmt)
    ]
    assert offenders == [], "data changes belong in a numbered file under supabase/migrations"


def test_data_change_detector_recognises_what_it_guards():
    assert DATA_CHANGE.search("UPDATE users SET name = 'x'")
    assert DATA_CHANGE.search("DO $$ BEGIN delete from bookings; END $$")
    assert DATA_CHANGE.search("insert into services (id) values (1)")
    assert not DATA_CHANGE.search("user_id UUID REFERENCES users(id) ON DELETE CASCADE")
    assert not DATA_CHANGE.search("INSERT_ONLY_COLUMN TEXT, ON UPDATE CASCADE")


def test_no_personal_name_appears_in_migration_code():
    source = (BACKEND / "app" / "schema_migrate.py").read_text(encoding="utf-8")
    assert "Reddy" not in source
    assert "@bseva.test" not in source
