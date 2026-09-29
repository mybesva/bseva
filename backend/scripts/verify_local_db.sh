#!/usr/bin/env bash
# Verify fresh local Postgres bootstrap for Seva expansion.
#
# Canonical paths (both supported):
#   A) Full SQL chain: 001–020 on empty DB, then ensure_schema() for runtime DDL/seeds
#   B) Legacy split:   001–012 + ensure_schema() + 019–020 (still valid)
#
# Set MIGRATION_MODE=full|split (default: full).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB_NAME="${DB_NAME:-bseva_seva_qa}"
DB_URL="${DATABASE_URL:-postgresql://$(whoami)@localhost:5432/${DB_NAME}}"
MODE="${MIGRATION_MODE:-full}"

dropdb --if-exists "$DB_NAME" 2>/dev/null || true
createdb "$DB_NAME"

if [[ "$MODE" == "full" ]]; then
  echo "→ Applying supabase migrations 001–020 (full chain)..."
  for f in "$ROOT/supabase/migrations/"*.sql; do
    base="$(basename "$f")"
    echo "  $base"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
  done
else
  echo "→ Applying base supabase migrations 001–012..."
  for f in "$ROOT/supabase/migrations/"0*.sql; do
    base="$(basename "$f")"
    num="${base%%_*}"
    num=$((10#$num))
    if (( num > 12 )); then
      continue
    fi
    echo "  $base"
    psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$f" >/dev/null
  done
  echo "→ Running ensure_schema()..."
  (cd "$ROOT/backend" && DATABASE_URL="$DB_URL" python3 -c "from app.schema_migrate import ensure_schema; ensure_schema(quiet=True); print('ensure_schema ok')")
  echo "→ Applying migrations 019 and 020..."
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/019_customer_addresses.sql" >/dev/null
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/migrations/020_seva_expansion.sql" >/dev/null
fi

echo "→ Running ensure_schema() (runtime DDL + platform seeds)..."
(cd "$ROOT/backend" && DATABASE_URL="$DB_URL" python3 -c "from app.schema_migrate import ensure_schema; ensure_schema(quiet=True); print('ensure_schema ok')")

echo "→ Seeding users..."
(cd "$ROOT/backend" && DATABASE_URL="$DB_URL" python3 seed.py >/dev/null)

echo "→ Seeding seva demo..."
(cd "$ROOT/backend" && DATABASE_URL="$DB_URL" python3 -c "
from app.db import SessionLocal
from app.seva.demo_seed import seed_seva_demo
db = SessionLocal()
try:
    print(seed_seva_demo(db))
    db.commit()
finally:
    db.close()
")

echo "→ Verifying schema..."
psql "$DB_URL" -c "SELECT 'seva_events' AS tbl, COUNT(*) FROM seva_events UNION ALL SELECT 'customer_addresses', COUNT(*) FROM customer_addresses;"

echo "PASS: local DB migration verification complete"
