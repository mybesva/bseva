#!/usr/bin/env bash
# Push local SUPABASE_SERVICE_ROLE_KEY to Vercel (production + preview + development).
# Run from repo root in your own terminal (needs vercel login + network).
set -euo pipefail
cd "$(dirname "$0")/.."

KEY="$(python3 - <<'PY'
from pathlib import Path
key = ""
for line in Path(".env").read_text().splitlines():
    s = line.strip()
    if s.startswith("SUPABASE_SERVICE_ROLE_KEY=") and not s.startswith("#"):
        key = s.split("=", 1)[1].strip().strip('"').strip("'")
if not key.startswith("eyJ"):
    raise SystemExit("Local SUPABASE_SERVICE_ROLE_KEY missing or not a JWT (must start with eyJ)")
print(key)
PY
)"

echo "Updating Vercel env SUPABASE_SERVICE_ROLE_KEY (len=${#KEY}, eyJ JWT)…"

for ENV in production preview development; do
  vercel env rm SUPABASE_SERVICE_ROLE_KEY "$ENV" -y >/dev/null 2>&1 || true
  printf '%s' "$KEY" | vercel env add SUPABASE_SERVICE_ROLE_KEY "$ENV" >/dev/null
  echo "  ✓ $ENV"
done

echo "Done. Redeploy production so the new key is picked up:"
echo "  vercel --prod"
