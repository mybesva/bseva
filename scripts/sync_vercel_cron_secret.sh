#!/usr/bin/env bash
# Sync CRON_SECRET to Vercel (production / preview / development).
# Usage: ./scripts/sync_vercel_cron_secret.sh
set -euo pipefail
cd "$(dirname "$0")/.."

unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy \
  GIT_HTTP_PROXY GIT_HTTPS_PROXY SOCKS_PROXY SOCKS5_PROXY socks_proxy socks5_proxy || true

CRON_SECRET="${CRON_SECRET:-}"
if [[ -z "$CRON_SECRET" && -f .env ]]; then
  LINE="$(grep -E '^CRON_SECRET=' .env | tail -1 || true)"
  if [[ -n "$LINE" ]]; then
    CRON_SECRET="${LINE#CRON_SECRET=}"
    CRON_SECRET="${CRON_SECRET%\"}"
    CRON_SECRET="${CRON_SECRET#\"}"
  fi
fi

if [[ -z "${CRON_SECRET:-}" ]]; then
  CRON_SECRET="$(openssl rand -hex 24)"
  if grep -q '^CRON_SECRET=' .env 2>/dev/null; then
    sed -i.bak "s/^CRON_SECRET=.*/CRON_SECRET=${CRON_SECRET}/" .env
    rm -f .env.bak
  else
    printf '\n# Vercel Cron auth (Vercel sends Bearer automatically)\nCRON_SECRET=%s\n' "$CRON_SECRET" >> .env
  fi
  echo "Generated CRON_SECRET and saved to .env"
else
  echo "Using existing CRON_SECRET (len=${#CRON_SECRET})"
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Install Vercel CLI: npm i -g vercel" >&2
  exit 1
fi

add_env() {
  local env="$1"
  echo "→ Setting CRON_SECRET on Vercel ($env)"
  # --value/--yes avoid interactive prompts; --force overwrites if present
  # Preview: omit --git-branch so it applies to all Preview branches
  vercel env add CRON_SECRET "$env" \
    --value "$CRON_SECRET" \
    --yes \
    --force \
    --sensitive \
    >/dev/null
  echo "  ✓ $env"
}

add_env production
add_env preview
add_env development

echo "Done. Redeploy Production so cron jobs use the new secret."
echo "No manual cron calls needed — Vercel hits the endpoints on schedule."
