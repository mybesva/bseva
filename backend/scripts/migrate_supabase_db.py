#!/usr/bin/env python3
"""Migrate BSeva schema + data: old Supabase (Sydney) → new (Mumbai)."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import psycopg
from psycopg import sql
from psycopg.types.json import Jsonb

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "supabase" / "migrations"

OLD_DATABASE_URL = (
    "postgresql://postgres.upyumpuwjzzrkuovkxqe:Grind%2A%400015"
    "@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require"
)

COPY_ORDER = [
    "users",
    "services",
    "pricing_config",
    "pujari_roles",
    "legal_policies",
    "customer_profiles",
    "pujari_profiles",
    "pujari_documents",
    "pujari_angikara",
    "pujari_document_versions",
    "pujari_blocked_dates",
    "wallets",
    "bookings",
    "wallet_transactions",
    "payments",
    "cancellations",
    "otp_codes",
    "notifications",
    "audit_logs",
]

SKIP_TABLES: set[str] = set()  # e.g. {"pujari_roles"} if needed


def load_new_database_url() -> str:
    env_path = ROOT / ".env"
    for line in env_path.read_text().splitlines():
        s = line.strip()
        if s.startswith("DATABASE_URL=") and not s.startswith("#"):
            url = s.split("=", 1)[1].strip().strip('"').strip("'")
            return url.replace(":6543/", ":5432/")
    raise SystemExit("DATABASE_URL missing from .env")


def pg_bin(name: str) -> str:
    for candidate in (
        f"/opt/homebrew/opt/postgresql@17/bin/{name}",
        f"/usr/local/opt/postgresql@17/bin/{name}",
        name,
    ):
        try:
            subprocess.run([candidate, "--version"], check=True, capture_output=True)
            return candidate
        except (subprocess.CalledProcessError, FileNotFoundError):
            continue
    raise SystemExit(f"{name} not found. Install: brew install postgresql@17")


def run_psql(url: str, sql_text: str) -> None:
    subprocess.run(
        [pg_bin("psql"), url, "-v", "ON_ERROR_STOP=1", "-c", sql_text],
        check=True,
        capture_output=True,
        text=True,
    )


def apply_schema(new_url: str) -> None:
    print("Resetting NEW schema...")
    run_psql(
        new_url,
        "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; "
        "GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;",
    )
    psql = pg_bin("psql")
    for path in sorted(MIGRATIONS.glob("*.sql")):
        print(f"  applying {path.name}...")
        subprocess.run(
            [psql, new_url, "-v", "ON_ERROR_STOP=1", "-f", str(path)],
            check=True,
            capture_output=True,
            text=True,
        )
    sys.path.insert(0, str(ROOT / "backend"))
    from app.schema_migrate import ensure_schema  # noqa: E402

    print("  running ensure_schema()...")
    ensure_schema()


def normalize_cell(col: str, val):
    if val is None:
        return None
    if col in ("examples", "points", "snapshot") and isinstance(val, str):
        s = val.strip()
        if s.startswith("{") and not s.startswith("{"):
            pass
        if s.startswith("{") and ":" not in s.split("}", 1)[0]:
            # Postgres array literal {"a","b"} → JSON list
            inner = s.strip("{}")
            parts = [p.strip().strip('"') for p in inner.split(",") if p.strip()]
            return Jsonb(parts)
    if col in ("examples", "points", "snapshot") and isinstance(val, (list, dict)):
        return Jsonb(val)
    return val


def copy_table(src: psycopg.Connection, dst: psycopg.Connection, table: str) -> int:
    with src.cursor() as sc:
        sc.execute(sql.SQL("SELECT * FROM {}").format(sql.Identifier(table)))
        rows = sc.fetchall()
        if not rows:
            return 0
        cols = [d.name for d in sc.description]

    adapted = []
    for row in rows:
        item = []
        for col, val in zip(cols, row, strict=True):
            if table == "users" and col == "blocked_by" and val is not None:
                # defer self-FK; second pass not needed if replication role bypasses FK
                item.append(val)
            else:
                item.append(normalize_cell(col, val))
        adapted.append(tuple(item))

    placeholders = sql.SQL(", ").join(sql.Placeholder() * len(cols))
    col_list = sql.SQL(", ").join(map(sql.Identifier, cols))
    insert = sql.SQL("INSERT INTO {} ({}) VALUES ({})").format(
        sql.Identifier(table), col_list, placeholders
    )
    with dst.cursor() as dc:
        dc.executemany(insert, adapted)
    return len(adapted)


def copy_all_data(old_url: str, new_url: str) -> None:
    print("Copying data (Python, FK-safe order)...")
    with psycopg.connect(old_url) as old_conn, psycopg.connect(new_url) as new_conn:
        old_conn.execute("SET TRANSACTION READ ONLY")
        new_conn.execute("TRUNCATE users, services, pricing_config, customer_profiles, "
                         "pujari_profiles, pujari_documents, pujari_angikara, "
                         "pujari_document_versions, pujari_blocked_dates, wallets, bookings, "
                         "wallet_transactions, payments, cancellations, otp_codes, "
                         "notifications, audit_logs, pujari_roles, legal_policies CASCADE")

        try:
            new_conn.execute("SET session_replication_role = replica")
            use_replica = True
        except psycopg.Error:
            use_replica = False
            print("  note: session_replication_role unavailable; using ordered inserts")

        total = 0
        for table in COPY_ORDER:
            if table in SKIP_TABLES:
                print(f"  skip {table}")
                continue
            try:
                n = copy_table(old_conn, new_conn, table)
                new_conn.commit()
                if n:
                    print(f"  copied {table}: {n} rows")
                    total += n
            except Exception as exc:
                new_conn.rollback()
                print(f"  FAILED {table}: {exc}")
                if table in ("pujari_roles", "legal_policies"):
                    print(f"  keeping seeded {table} from ensure_schema()")
                    continue
                raise

        if use_replica:
            new_conn.execute("SET session_replication_role = DEFAULT")
            new_conn.commit()

        print(f"Copied {total} rows total.")


def counts(url: str) -> dict[str, int]:
    tables = ["users", "bookings", "services", "pujari_roles", "legal_policies", "wallets"]
    out: dict[str, int] = {}
    with psycopg.connect(url) as conn:
        for t in tables:
            try:
                out[t] = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            except Exception:
                out[t] = -1
    return out


def main() -> None:
    new_url = load_new_database_url()
    old_url = OLD_DATABASE_URL

    print("OLD counts:", counts(old_url))
    apply_schema(new_url)
    copy_all_data(old_url, new_url)
    print("NEW counts:", counts(new_url))
    print("Migration complete.")


if __name__ == "__main__":
    main()
