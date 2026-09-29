#!/usr/bin/env bash
# Interactive Android QA via adb UI automation against emulator + dev API.
set -euo pipefail
DEVICE="${ANDROID_DEVICE:-emulator-5554}"
API="${API_BASE:-http://127.0.0.1:8000/api/v1}"
PASS="${QA_PASSWORD:-TestPass123!}"
OUT="${TMPDIR:-/tmp}/bseva_android_qa_$$"
mkdir -p "$OUT"
PASS_COUNT=0
FAIL_COUNT=0
BLOCKED_COUNT=0

adb() { command adb -s "$DEVICE" "$@"; }

record() {
  local name="$1" status="$2" detail="$3"
  case "$status" in
    PASS) PASS_COUNT=$((PASS_COUNT + 1)) ;;
    FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
    BLOCKED) BLOCKED_COUNT=$((BLOCKED_COUNT + 1)) ;;
  esac
  printf '%-42s %-8s %s\n' "$name" "$status" "$detail" | tee -a "$OUT/results.txt"
}

screenshot() {
  adb exec-out screencap -p > "$OUT/$1.png" 2>/dev/null || true
}

ui_dump() {
  adb shell uiautomator dump /sdcard/uidump.xml >/dev/null 2>&1 || true
  adb pull /sdcard/uidump.xml "$OUT/$1.xml" >/dev/null 2>&1 || true
}

ui_has() {
  local file="$OUT/$1.xml" needle="$2"
  [[ -f "$file" ]] && grep -q "$needle" "$file"
}

tap_text() {
  local file="$OUT/$1.xml" label="$2"
  if [[ ! -f "$file" ]]; then return 1; fi
  local line
  line="$(grep -i "$label" "$file" | head -1 || true)"
  if [[ -z "$line" ]]; then return 1; fi
  local bounds
  bounds="$(echo "$line" | sed -n 's/.*bounds="\[\([0-9]*\),\([0-9]*\)\]\[\([0-9]*\),\([0-9]*\)\]".*/\1 \2 \3 \4/p')"
  [[ -z "$bounds" ]] && return 1
  read -r x1 y1 x2 y2 <<< "$bounds"
  adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))
}

login_app() {
  local pkg="$1" role="$2" email="$3"
  adb shell pm clear "$pkg" >/dev/null 2>&1 || true
  sleep 1
  adb shell am start -n "$pkg/.MainActivity" -d "bseva://login?role=$role" >/dev/null
  sleep 3
  ui_dump "${role}_login"
  screenshot "${role}_login"
  # Tap first editable field (identifier)
  if ui_has "${role}_login" 'password="true"'; then
    tap_text "${role}_login" 'password="true"' || adb shell input tap 540 900
    sleep 0.5
    adb shell input keyevent 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 67 2>/dev/null || true
    adb shell input text "${email//@/%40}"
    adb shell input keyevent 61
    adb shell input text "$PASS"
    tap_text "${role}_login" "Sign in" || tap_text "${role}_login" "Log in" || tap_text "${role}_login" "Login" || adb shell input tap 540 1200
    sleep 4
    ui_dump "${role}_home"
    screenshot "${role}_home"
    if ui_has "${role}_home" "Services" || ui_has "${role}_home" "Seva" || ui_has "${role}_home" "Bookings" || ui_has "${role}_home" "More"; then
      return 0
    fi
  fi
  return 1
}

echo "Android QA device=$DEVICE api=$API"
echo "Output: $OUT"

# --- Customer ---
if login_app "com.bseva.app" "customer" "customer1@bseva.test"; then
  record "customer_login" "PASS" "logged in"
  adb shell am start -a android.intent.action.VIEW -d "bseva://customer/seva?type=puja" >/dev/null
  sleep 3
  ui_dump "customer_seva_puja"
  screenshot "customer_seva_puja"
  if ui_has "customer_seva_puja" "Explore" || ui_has "customer_seva_puja" "Seva" || ui_has "customer_seva_puja" "Rudrabhishek"; then
    record "customer_browse_seva" "PASS" "seva hub visible"
  else
    record "customer_browse_seva" "FAIL" "seva hub not detected"
  fi
  adb shell am start -a android.intent.action.VIEW -d "bseva://customer/my-seva" >/dev/null
  sleep 3
  ui_dump "customer_my_seva"
  if ui_has "customer_my_seva" "My Seva" || ui_has "customer_my_seva" "Registration"; then
    record "customer_my_seva" "PASS" "my seva screen"
  else
    record "customer_my_seva" "FAIL" "my seva not detected"
  fi
  adb shell am start -a android.intent.action.VIEW -d "bseva://customer/family-sankalp" >/dev/null
  sleep 2
  ui_dump "customer_family"
  if ui_has "customer_family" "Family" || ui_has "customer_family" "Sankalp"; then
    record "customer_family_sankalp" "PASS" "family sankalp screen"
  else
    record "customer_family_sankalp" "FAIL" "family sankalp not detected"
  fi
else
  record "customer_login" "FAIL" "login UI did not reach home"
fi

# --- Pujari ---
if login_app "com.bseva.app" "pujari" "pujari1@bseva.test"; then
  record "pujari_login" "PASS" "logged in"
  adb shell am start -a android.intent.action.VIEW -d "bseva://pujari/seva-events" >/dev/null
  sleep 3
  ui_dump "pujari_seva_list"
  screenshot "pujari_seva_list"
  if ui_has "pujari_seva_list" "Seva" || ui_has "pujari_seva_list" "Rudrabhishek" || ui_has "pujari_seva_list" "Pravachan"; then
    record "pujari_assigned_events" "PASS" "assigned list visible"
  else
    record "pujari_assigned_events" "FAIL" "assigned list not detected"
  fi
else
  record "pujari_login" "FAIL" "login UI did not reach home"
fi

# --- Admin ---
if login_app "com.bseva.admin" "admin" "super@bseva.test"; then
  record "admin_login" "PASS" "logged in"
  adb shell am start -a android.intent.action.VIEW -d "bseva://seva-events" >/dev/null 2>&1 || \
    adb shell am start -a android.intent.action.VIEW -d "bseva://(app)/seva-events" >/dev/null 2>&1 || true
  sleep 3
  ui_dump "admin_seva"
  screenshot "admin_seva"
  if ui_has "admin_seva" "Seva" || ui_has "admin_seva" "Events" || ui_has "admin_seva" "Registrations"; then
    record "admin_seva_events" "PASS" "admin seva screen"
  else
    record "admin_seva_events" "FAIL" "admin seva not detected — open More → Seva Events manually if route differs"
  fi
else
  record "admin_login" "FAIL" "admin login did not reach home"
fi

echo "---"
echo "PASS=$PASS_COUNT FAIL=$FAIL_COUNT BLOCKED=$BLOCKED_COUNT"
echo "Artifacts: $OUT"
[[ "$FAIL_COUNT" -eq 0 ]]
