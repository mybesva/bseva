#!/usr/bin/env bash
# Builds the three Android apps for Google Play internal testing, pointed at QA.
#   scripts/build-play-internal.sh          signed .aab files for upload (needs ~/bseva-keys)
#   scripts/build-play-internal.sh test     arm64 test .apk files for an emulator
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HOME/bseva-play-builds"
MODE="${1:-bundle}"
export JAVA_HOME="${JAVA_HOME:-/Applications/Android Studio.app/Contents/jbr/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://qa.b-seva.com}"
export NODE_ENV=production
mkdir -p "$OUT"

build() { # name, app directory, keystore name, extra gradle flag
  local name="$1" dir="$ROOT/apps/$2" key="$3" flag="${4:-}"
  local gradle_flags=(--console=plain)
  [ -n "$flag" ] && gradle_flags+=("$flag")
  echo "==> $name"
  # app:createBundle...: the JS bundle embeds EXPO_PUBLIC_API_URL, so it must never come from a stale run.
  if [ "$MODE" = test ]; then
    (cd "$dir/android" && ./gradlew assembleRelease --rerun-tasks -x lint -PreactNativeArchitectures=arm64-v8a "${gradle_flags[@]}")
    cp "$dir/android/app/build/outputs/apk/release/app-release.apk" "$OUT/$name-test.apk"
  else
    if [ ! -f "$HOME/bseva-keys/$key.properties" ]; then
      echo "Missing ~/bseva-keys/$key.properties. Create the upload keys first." >&2
      exit 1
    fi
    (cd "$dir/android" && ./gradlew bundleRelease --rerun-tasks "${gradle_flags[@]}")
    cp "$dir/android/app/build/outputs/bundle/release/app-release.aab" "$OUT/$name.aab"
  fi
}

build b-seva mobile customer
build b-seva-pujari mobile pujari -PbsevaApp=pujari
build b-seva-admin admin-mobile admin

echo "Done: $OUT"
ls -lh "$OUT"
