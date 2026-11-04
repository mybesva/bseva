#!/usr/bin/env bash
# Creates one Google Play upload key per app in ~/bseva-keys. Run it yourself; passwords are typed hidden.
# Back up ~/bseva-keys somewhere safe. Never commit it.
set -euo pipefail

KEYTOOL="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}/bin/keytool"
DIR="$HOME/bseva-keys"
mkdir -p "$DIR"
chmod 700 "$DIR"

for app in customer pujari admin; do
  store="$DIR/$app-upload.jks"
  props="$DIR/$app.properties"
  if [ -f "$store" ]; then
    echo "$app: key already exists, leaving it alone."
    continue
  fi
  while true; do
    read -r -s -p "$app: new key password (at least 6 characters): " first; echo
    read -r -s -p "$app: type it again: " second; echo
    [ "$first" = "$second" ] && [ "${#first}" -ge 6 ] && break
    echo "They did not match or it is too short. Try again."
  done
  BSEVA_KEY_PASSWORD="$first" "$KEYTOOL" -genkeypair -v \
    -keystore "$store" -storetype PKCS12 -alias upload \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass:env BSEVA_KEY_PASSWORD -keypass:env BSEVA_KEY_PASSWORD \
    -dname "CN=B-Seva $app, O=B-Seva, C=IN" >/dev/null 2>&1
  printf 'storeFile=%s\nstorePassword=%s\nkeyAlias=upload\nkeyPassword=%s\n' "$store" "$first" "$first" > "$props"
  chmod 600 "$store" "$props"
  echo "$app: upload key created."
done
echo "Done. Back up $DIR now; losing a key means asking Google to reset it."
