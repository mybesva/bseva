"""Database migrations for long-running deployments (AWS), using the repo's existing schema chain.

    python -m app.db_bootstrap            # apply pending migrations (safe to re-run)
    python -m app.db_bootstrap --status   # list applied / pending files and the ensure_schema state, change nothing
    python -m app.db_bootstrap --check-target  # verify the database is the one this deploy expects, change nothing
    python -m app.db_bootstrap --seed-demo  # synthetic QA data (refused in production)

Order on an empty database (same as backend/scripts/verify_local_db.sh, verified on PostgreSQL 17):
supabase/migrations 001–012 → ensure_schema() → remaining files in order → ensure_schema().
Applied files are recorded in `schema_migrations`. A database that already has the B-Seva schema but no
tracking table (e.g. a restored Supabase dump) is baselined: existing files are recorded, not re-run.
A Postgres advisory lock prevents two deploys migrating at once. Nothing is ever dropped.
ensure_schema() changes structure only and seeds only a new, empty database, so running it never alters existing
rows. Changes to existing data must be numbered files in supabase/migrations.

Deploy safety (deploy/host/deploy.sh sets these):
  EXPECTED_DB_HOST_PREFIX   the DATABASE_URL host must start with this (e.g. "bseva-prod-db.")
  EXPECTED_ENVIRONMENT      settings.environment must equal this (e.g. "production")
  REQUIRE_TARGET_GUARD=1    refuse to migrate unless both of the above are set
ensure_schema() runs in strict mode: any failed statement rolls its transaction back and the command exits 1
(except the first pass on an empty database, which runs before files 013+ exist; the final pass is strict).
It runs when files were applied, when its code changed (fingerprint of the schema modules), or with
RUN_ENSURE_SCHEMA=always. Each SQL file runs in its own transaction with a lock timeout.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit

import psycopg

from app.config import settings

ROOT = Path(__file__).resolve().parents[2]
APP_DIR = Path(__file__).resolve().parent
MIGRATIONS_DIR = Path(os.environ.get("MIGRATIONS_DIR") or ROOT / "supabase" / "migrations")
FOUNDATION_LAST = 12  # files up to 012 must run before ensure_schema() on an empty database
LOCK_ID = 727274001
FILE_LOCK_TIMEOUT = os.environ.get("MIGRATION_LOCK_TIMEOUT", "30s")
# Modules whose code ensure_schema() executes; a change to any of them re-runs it on the next deploy.
SCHEMA_MODULE_GLOBS = (
    "schema_migrate.py",
    "rbac_migrate.py",
    "phase*_migrate.py",
    "*_seed.py",
    "puja_catalog_import.py",
    "public_ids.py",
    "pujari_levels.py",
)


class TargetMismatch(RuntimeError):
    pass


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


def schema_fingerprint() -> str:
    paths = sorted({p for pattern in SCHEMA_MODULE_GLOBS for p in APP_DIR.glob(pattern)})
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.name.encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
    return digest.hexdigest()[:16]


def _target() -> dict:
    parts = urlsplit(_url())
    return {"host": parts.hostname or "", "database": (parts.path or "/").lstrip("/"),
            "environment": (settings.environment or "").strip().lower()}


def check_target(conn=None) -> dict:
    """Refuse to touch a database other than the one this deploy expects (host prefix + ENVIRONMENT)."""
    target = _target()
    want_host = os.environ.get("EXPECTED_DB_HOST_PREFIX", "").strip()
    want_env = os.environ.get("EXPECTED_ENVIRONMENT", "").strip().lower()
    if os.environ.get("REQUIRE_TARGET_GUARD") == "1" and not (want_host and want_env):
        raise TargetMismatch("REQUIRE_TARGET_GUARD=1 but EXPECTED_DB_HOST_PREFIX / EXPECTED_ENVIRONMENT are not set")
    if want_host and not target["host"].startswith(want_host):
        raise TargetMismatch(f"database host {target['host']!r} does not start with {want_host!r}")
    if want_env and target["environment"] != want_env:
        raise TargetMismatch(f"ENVIRONMENT is {target['environment']!r}, expected {want_env!r}")
    if conn is not None:
        target["server_database"] = conn.execute("SELECT current_database()").fetchone()[0]
        if target["database"] and target["server_database"] != target["database"]:
            raise TargetMismatch(f"connected to {target['server_database']!r}, URL names {target['database']!r}")
    target["guarded"] = bool(want_host and want_env)
    return target


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


def _meta_table(conn) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations_meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )


def _stored_fingerprint(conn) -> str | None:
    if not conn.execute("SELECT to_regclass('public.schema_migrations_meta') IS NOT NULL").fetchone()[0]:
        return None
    row = conn.execute("SELECT value FROM schema_migrations_meta WHERE key = 'ensure_schema'").fetchone()
    return row[0] if row else None


def _has_schema(conn) -> bool:
    return conn.execute("SELECT to_regclass('public.users') IS NOT NULL").fetchone()[0]


def _apply_file(conn, path: Path) -> None:
    started = time.monotonic()
    _log("migration_start", file=path.name)
    try:
        with conn.transaction():
            conn.execute(f"SET LOCAL lock_timeout = '{FILE_LOCK_TIMEOUT}'")
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute("INSERT INTO schema_migrations (filename) VALUES (%s)", (path.name,))
    except Exception as e:
        _log("migration_failed", file=path.name, error=str(e).split("\n")[0][:300], rolled_back=True)
        raise
    _log("migration_applied", file=path.name, ms=int((time.monotonic() - started) * 1000))


def _ensure_schema(conn, fingerprint: str, *, foundation: bool = False) -> None:
    """foundation=True is the first pass on an empty database, before files 013+ exist: statements that need
    those later tables are expected to fail there and are applied by the final, strict pass."""
    from app.schema_migrate import SchemaMigrationError, ensure_schema

    started = time.monotonic()
    if foundation:
        failed = ensure_schema(quiet=True)
        _log("ensure_schema_foundation", deferred=len(failed), ms=int((time.monotonic() - started) * 1000))
        return
    try:
        ensure_schema(quiet=True, strict=os.environ.get("MIGRATE_STRICT", "1") != "0")
    except SchemaMigrationError as e:
        _log("ensure_schema_failed", failed=[{"step": p, "error": err} for p, err in e.failed[:20]])
        raise
    _meta_table(conn)
    conn.execute(
        """
        INSERT INTO schema_migrations_meta (key, value) VALUES ('ensure_schema', %s)
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        """,
        (fingerprint,),
    )
    _log("ensure_schema_ok", fingerprint=fingerprint, ms=int((time.monotonic() - started) * 1000))


def migrate() -> int:
    with _connect() as conn:
        target = check_target(conn)
        _log("migrate_target", **target)
        conn.execute("SELECT pg_advisory_lock(%s)", (LOCK_ID,))
        try:
            for ext in ("pgcrypto", "citext"):
                conn.execute(f"CREATE EXTENSION IF NOT EXISTS {ext}")
            fresh = not _has_schema(conn)
            applied = _applied(conn)
            files = _files()
            fingerprint = schema_fingerprint()
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
            schema_changed = _stored_fingerprint(conn) != fingerprint
            _log("migrate_plan", fresh=fresh, pending=[p.name for p in pending], ensure_schema_changed=schema_changed)
            if fresh:
                for path in (p for p in pending if _number(p) <= FOUNDATION_LAST):
                    _apply_file(conn, path)
                _ensure_schema(conn, fingerprint, foundation=True)
                pending = [p for p in pending if _number(p) > FOUNDATION_LAST]
            for path in pending:
                _apply_file(conn, path)
            if fresh or pending or schema_changed or os.environ.get("RUN_ENSURE_SCHEMA", "").lower() == "always":
                _ensure_schema(conn, fingerprint)
            _log("migrate_done", fresh=fresh, applied_now=total_pending)
        finally:
            conn.execute("SELECT pg_advisory_unlock(%s)", (LOCK_ID,))
    return 0


def status() -> int:
    with _connect() as conn:
        target = check_target(conn)
        exists = conn.execute("SELECT to_regclass('public.schema_migrations') IS NOT NULL").fetchone()[0]
        rows = conn.execute("SELECT filename, mode FROM schema_migrations").fetchall() if exists else []
        stored = _stored_fingerprint(conn)
    applied = {r[0] for r in rows}
    files = [p.name for p in _files()]
    current = schema_fingerprint()
    _log(
        "status",
        target=target,
        applied=sorted(applied & set(files)),
        baselined=sorted(r[0] for r in rows if r[1] == "baseline"),
        pending=[f for f in files if f not in applied],
        ensure_schema={"stored": stored, "current": current, "will_run": stored != current},
    )
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
    parser.add_argument("--check-target", action="store_true")
    parser.add_argument("--seed-demo", action="store_true")
    args = parser.parse_args()
    try:
        if args.check_target:
            with _connect() as conn:
                _log("target_ok", **check_target(conn))
            return 0
        if args.status:
            return status()
        if args.seed_demo:
            return seed_demo()
        return migrate()
    except TargetMismatch as e:
        _log("target_refused", error=str(e))
        return 3
    except Exception as e:
        _log("migrate_failed", error=str(e).split("\n")[0][:500])
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
