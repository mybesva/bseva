"""Database migrations for long-running deployments (AWS), using the repo's existing schema chain.

    python -m app.db_bootstrap            # apply pending migrations (safe to re-run)
    python -m app.db_bootstrap --status   # list applied / pending files, change nothing
    python -m app.db_bootstrap --seed-demo  # synthetic QA data (refused in production)

Order on an empty database (same as backend/scripts/verify_local_db.sh, verified on PostgreSQL 17):
supabase/migrations 001–012 → ensure_schema() → remaining files in order → ensure_schema().
Applied files are recorded in `schema_migrations`. A database that already has the B-Seva schema but no
tracking table (e.g. a restored Supabase dump) is baselined: existing files are recorded, not re-run.
A Postgres advisory lock prevents two deploys migrating at once. Nothing is ever dropped.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import psycopg

from app.config import settings

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = Path(os.environ.get("MIGRATIONS_DIR") or ROOT / "supabase" / "migrations")
FOUNDATION_LAST = 12  # files up to 012 must run before ensure_schema() on an empty database
LOCK_ID = 727274001


def _log(event: str, **fields) -> None:
    print(json.dumps({"event": event, **fields}, default=str), flush=True)


def _url() -> str:
    return settings.database_url.replace("postgresql+psycopg://", "postgresql://", 1)


def _connect():
    kwargs = {"autocommit": True, "connect_timeout": 15}
    if os.environ.get("DB_SSLMODE"):
        kwargs["sslmode"] = os.environ["DB_SSLMODE"]
    if os.environ.get("DB_SSLROOTCERT"):
        kwargs["sslrootcert"] = os.environ["DB_SSLROOTCERT"]
    return psycopg.connect(_url(), **kwargs)


def _files() -> list[Path]:
    return sorted(p for p in MIGRATIONS_DIR.glob("*.sql") if p.name[:3].isdigit())


def _number(path: Path) -> int:
    return int(path.name[:3])


def _applied(conn) -> set[str]:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          mode TEXT NOT NULL DEFAULT 'applied'
        )
        """
    )
    return {r[0] for r in conn.execute("SELECT filename FROM schema_migrations").fetchall()}


def _has_schema(conn) -> bool:
    return conn.execute("SELECT to_regclass('public.users') IS NOT NULL").fetchone()[0]


def _apply_file(conn, path: Path) -> None:
    started = time.monotonic()
    with conn.transaction():
        conn.execute(path.read_text(encoding="utf-8"))
        conn.execute("INSERT INTO schema_migrations (filename) VALUES (%s)", (path.name,))
    _log("migration_applied", file=path.name, ms=int((time.monotonic() - started) * 1000))


def _ensure_schema() -> None:
    from app.schema_migrate import ensure_schema

    started = time.monotonic()
    ensure_schema(quiet=True)
    _log("ensure_schema_ok", ms=int((time.monotonic() - started) * 1000))


def migrate() -> int:
    with _connect() as conn:
        conn.execute("SELECT pg_advisory_lock(%s)", (LOCK_ID,))
        try:
            for ext in ("pgcrypto", "citext"):
                conn.execute(f"CREATE EXTENSION IF NOT EXISTS {ext}")
            fresh = not _has_schema(conn)
            applied = _applied(conn)
            files = _files()
            if not fresh and not applied:
                # Existing schema without tracking: record what is already there, run nothing destructive.
                for path in files:
                    conn.execute(
                        "INSERT INTO schema_migrations (filename, mode) VALUES (%s, 'baseline') ON CONFLICT DO NOTHING",
                        (path.name,),
                    )
                _log("baseline_recorded", files=len(files))
                applied = {p.name for p in files}
            pending = [p for p in files if p.name not in applied]
            total_pending = len(pending)
            if fresh:
                for path in (p for p in pending if _number(p) <= FOUNDATION_LAST):
                    _apply_file(conn, path)
                _ensure_schema()
                pending = [p for p in pending if _number(p) > FOUNDATION_LAST]
            for path in pending:
                _apply_file(conn, path)
            if fresh or pending or os.environ.get("RUN_ENSURE_SCHEMA", "").lower() == "always":
                _ensure_schema()
            _log("migrate_done", fresh=fresh, applied_now=total_pending)
        finally:
            conn.execute("SELECT pg_advisory_unlock(%s)", (LOCK_ID,))
    return 0


def status() -> int:
    with _connect() as conn:
        exists = conn.execute("SELECT to_regclass('public.schema_migrations') IS NOT NULL").fetchone()[0]
        applied = {r[0] for r in conn.execute("SELECT filename FROM schema_migrations").fetchall()} if exists else set()
    files = [p.name for p in _files()]
    _log("status", applied=sorted(applied & set(files)), pending=[f for f in files if f not in applied])
    return 0


def seed_demo() -> int:
    if (settings.environment or "").strip().lower() == "production":
        _log("seed_refused", reason="production")
        return 2
    backend = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(backend))
    import seed  # backend/seed.py — synthetic @bseva.test identities only

    seed.run()
    from app.db import SessionLocal
    from app.seva.demo_seed import seed_seva_demo

    db = SessionLocal()
    try:
        out = seed_seva_demo(db)
        db.commit()
    finally:
        db.close()
    _log("seed_done", seva=out)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="B-Seva database migrations")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--seed-demo", action="store_true")
    args = parser.parse_args()
    if args.status:
        return status()
    if args.seed_demo:
        return seed_demo()
    return migrate()


if __name__ == "__main__":
    raise SystemExit(main())
