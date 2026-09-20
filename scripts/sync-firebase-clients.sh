#!/usr/bin/env bash
# Copy Firebase *client* configs from backend/secrets into mobile apps.
# Same Firebase project (b-seva-61ab7) for all apps; each native package needs its own client file.
# Never copies the Admin SDK service-account JSON.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/backend/secrets"
MOBILE="$ROOT/apps/mobile"
ADMIN="$ROOT/apps/admin-mobile"

sync_one() {
  local from="$1" to="$2"
  if [[ -f "$from" ]]; then
    cp "$from" "$to"
    echo "  → $to"
    return 0
  fi
  return 1
}

echo "Customer/Pujari (com.bseva.app):"
sync_one "$SRC/google-services (1).json" "$MOBILE/google-services.json" || sync_one "$SRC/google-services.json" "$MOBILE/google-services.json" || echo "  (skip — no google-services client JSON in backend/secrets)"
sync_one "$SRC/GoogleService-Info (1).plist" "$MOBILE/GoogleService-Info.plist" || sync_one "$SRC/GoogleService-Info.plist" "$MOBILE/GoogleService-Info.plist" || echo "  (skip — no iOS plist in backend/secrets)"

echo "Admin (com.bseva.admin) — same Firebase project, separate app registration:"
if sync_one "$SRC/google-services-admin.json" "$ADMIN/google-services.json"; then
  :
elif sync_one "$SRC/google-services (admin).json" "$ADMIN/google-services.json"; then
  :
else
  echo "  (skip — add Android client: register com.bseva.admin in Firebase Console, save as backend/secrets/google-services-admin.json)"
fi
if sync_one "$SRC/GoogleService-Info-admin.plist" "$ADMIN/GoogleService-Info.plist"; then
  :
elif sync_one "$SRC/GoogleService-Info (admin).plist" "$ADMIN/GoogleService-Info.plist"; then
  :
else
  echo "  (skip — add iOS client: register com.bseva.admin, save as backend/secrets/GoogleService-Info-admin.plist)"
fi

echo "Done. Backend push still uses one Firebase Admin SDK (service account) for the whole project."
