#!/usr/bin/env bash
# Copy Firebase *client* configs from backend/secrets into the Customer/Pujari app.
# Never copies the Admin SDK service-account JSON.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/backend/secrets"
DEST="$ROOT/apps/mobile"
if [[ -f "$SRC/google-services (1).json" ]]; then
  cp "$SRC/google-services (1).json" "$DEST/google-services.json"
fi
if [[ -f "$SRC/GoogleService-Info (1).plist" ]]; then
  cp "$SRC/GoogleService-Info (1).plist" "$DEST/GoogleService-Info.plist"
fi
echo "Synced Firebase client files into apps/mobile (Admin SDK was not copied)."
