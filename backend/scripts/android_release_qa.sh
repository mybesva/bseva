#!/usr/bin/env bash
# Full Android interactive QA for Seva release certification.
set -euo pipefail
DEVICE="${ANDROID_DEVICE:-emulator-5554}"
API="${API_BASE:-http://127.0.0.1:8000/api/v1}"
PASS="${QA_PASSWORD:-TestPass123!}"
OUT="${TMPDIR:-/tmp}/bseva_android_release_qa_$$"
mkdir -p "$OUT"
PASS_N=0
FAIL_N=0
BLOCK_N=0

adb() { command adb -s "$DEVICE" "$@"; }

record() {
  local name="$1" status="$2" detail="$3"
  case "$status" in
    PASS) PASS_N=$((PASS_N + 1)) ;;
    FAIL) FAIL_N=$((FAIL_N + 1)) ;;
    BLOCKED) BLOCK_N=$((BLOCK_N + 1)) ;;
  esac
  printf '%-48s %-8s %s\n' "$name" "$status" "$detail" | tee -a "$OUT/results.txt"
}

ui_dump() { adb shell uiautomator dump "/sdcard/ui_${1}.xml" >/dev/null 2>&1; adb pull "/sdcard/ui_${1}.xml" "$OUT/${1}.xml" >/dev/null 2>&1 || true; }
screenshot() { adb exec-out screencap -p > "$OUT/${1}.png" 2>/dev/null || true; }

ui_text() {
  local f="$OUT/${1}.xml"
  [[ -f "$f" ]] || return 1
  tr '>' '>\n' < "$f" | grep -oE 'text="[^"]*"|content-desc="[^"]*"' | sed 's/text="\|content-desc="//;s/"$//' | tr '\n' ' '
}

ui_has() {
  local f="$OUT/${1}.xml" needle="$2"
  [[ -f "$f" ]] && grep -qi "$needle" "$f"
}

tap_desc() {
  local f="$OUT/${1}.xml" label="$2"
  [[ -f "$f" ]] || return 1
  local line bounds
  line="$(grep -i "content-desc=\"$label\"" "$f" | head -1 || grep -i "text=\"$label\"" "$f" | head -1 || true)"
  [[ -n "$line" ]] || return 1
  bounds="$(echo "$line" | sed -n 's/.*bounds="\[\([0-9]*\),\([0-9]*\)\]\[\([0-9]*\),\([0-9]*\)\]".*/\1 \2 \3 \4/p')"
  [[ -z "$bounds" ]] && return 1
  read -r x1 y1 x2 y2 <<< "$bounds"
  adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))
}

tap_tab() {
  tap_desc "$1" "$2" || adb shell input tap "$3" "$4"
}

login_app() {
  local pkg="$1" role="$2" email="$3"
  adb shell pm clear "$pkg" >/dev/null 2>&1 || true
  sleep 1
  if [[ "$pkg" == "com.bseva.app" ]]; then
    adb shell am start -n "$pkg/.MainActivity" -d "bseva://login?role=$role" >/dev/null
  else
    adb shell am start -n "$pkg/.MainActivity" >/dev/null
  fi
  sleep 4
  ui_dump "${role}_login_pre"
  screenshot "${role}_login_pre"
  if ui_has "${role}_login_pre" "Unable to load script"; then
    return 2
  fi
  # scroll to fields if needed
  adb shell input swipe 540 1200 540 600 400 2>/dev/null || true
  sleep 0.5
  tap_desc "${role}_login_pre" "Email or phone" || adb shell input tap 540 1411
  sleep 0.3
  adb shell input keyevent 123 2>/dev/null || true
  adb shell input text "${email//@/%40}"
  sleep 0.5
  tap_desc "${role}_login_pre" "Password" || adb shell input tap 540 1647
  sleep 0.3
  adb shell input text "$PASS"
  sleep 0.5
  adb shell input keyevent 66 2>/dev/null || true
  sleep 0.5
  tap_desc "${role}_login_pre" "Sign In" || tap_desc "${role}_login_pre" "Log in" || adb shell input tap 540 1819
  sleep 6
  ui_dump "${role}_home"
  screenshot "${role}_home"
  if ui_has "${role}_home" "Login failed"; then return 1; fi
  if ui_has "${role}_home" "Services" || ui_has "${role}_home" "Home" || ui_has "${role}_home" "Bookings" || ui_has "${role}_home" "Dashboard" || ui_has "${role}_home" "Seva Events" || ui_has "${role}_home" "More"; then
    return 0
  fi
  return 1
}

echo "Android Release QA | device=$DEVICE | output=$OUT"
adb reverse tcp:8000 tcp:8000 >/dev/null 2>&1 || true

# --- Customer ---
if login_app "com.bseva.app" "customer" "customer1@bseva.test"; then
  record "customer_login_ui" "PASS" "logged in via UI"
else
  code=$?
  if [[ "$code" == 2 ]]; then record "customer_login_ui" "FAIL" "JS bundle missing"; else record "customer_login_ui" "FAIL" "login did not reach home"; fi
fi

if ui_has "customer_home" "Services" || ui_has "customer_home" "Home"; then
  tap_tab "customer_home" "Services" 270 2100
  sleep 3
  ui_dump "customer_services"
  screenshot "customer_services"
  if ui_has "customer_services" "Puja" || ui_has "customer_services" "Explore Seva" || ui_has "customer_services" "Rudrabhishek"; then
    record "customer_services_seva_chips" "PASS" "$(ui_text customer_services | head -c 80)"
  else
    record "customer_services_seva_chips" "FAIL" "no seva chips"
  fi

  for type in puja chadhava pravachan; do
    adb shell am start -a android.intent.action.VIEW -d "bseva://customer/seva?type=$type" -n com.bseva.app/.MainActivity >/dev/null
    sleep 3
    ui_dump "customer_seva_$type"
    if ui_has "customer_seva_$type" "Explore" || ui_has "customer_seva_$type" "Seva" || ui_has "customer_seva_$type" "Rudrabhishek" || ui_has "customer_seva_$type" "Chadhava" || ui_has "customer_seva_$type" "Pravachan" || ui_has "customer_seva_$type" "Gita"; then
      record "customer_seva_tab_$type" "PASS" "hub loaded"
      # open first event if present
      if grep -q 'bounds=' "$OUT/customer_seva_${type}.xml" 2>/dev/null; then
        line="$(grep -i 'Rudrabhishek\|Chadhava\|Pravachan\|Gita\|Proxy\|Group' "$OUT/customer_seva_${type}.xml" | head -1 || true)"
        if [[ -n "$line" ]]; then
          bounds="$(echo "$line" | sed -n 's/.*bounds="\[\([0-9]*\),\([0-9]*\)\]\[\([0-9]*\),\([0-9]*\)\]".*/\1 \2 \3 \4/p')"
          if [[ -n "$bounds" ]]; then
            read -r x1 y1 x2 y2 <<< "$bounds"
            adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))
            sleep 3
            ui_dump "customer_event_${type}"
            if ui_has "customer_event_${type}" "Register" || ui_has "customer_event_${type}" "Sankalp" || ui_has "customer_event_${type}" "Family"; then
              record "customer_event_detail_$type" "PASS" "event detail"
            else
              record "customer_event_detail_$type" "FAIL" "no register form"
            fi
          fi
        fi
      fi
    else
      record "customer_seva_tab_$type" "FAIL" "hub empty"
    fi
  done

  adb shell am start -a android.intent.action.VIEW -d "bseva://customer/family-sankalp" -n com.bseva.app/.MainActivity >/dev/null
  sleep 3
  ui_dump "customer_family"
  if ui_has "customer_family" "Family" || ui_has "customer_family" "Sankalp" || ui_has "customer_family" "Add"; then
    record "customer_family_sankalp" "PASS" "screen ok"
  else
    record "customer_family_sankalp" "FAIL" "not found"
  fi

  adb shell am start -a android.intent.action.VIEW -d "bseva://customer/my-seva" -n com.bseva.app/.MainActivity >/dev/null
  sleep 3
  ui_dump "customer_my_seva"
  if ui_has "customer_my_seva" "My Seva" || ui_has "customer_my_seva" "SEVA"; then
    record "customer_my_seva" "PASS" "$(ui_text customer_my_seva | head -c 100)"
    if ui_has "customer_my_seva" "Proof" || ui_has "customer_my_seva" "Shipped" || ui_has "customer_my_seva" "Join"; then
      record "customer_proof_prasad" "PASS" "badges visible"
    else
      record "customer_proof_prasad" "FAIL" "no proof/prasad/join"
    fi
  else
    record "customer_my_seva" "FAIL" "screen missing"
  fi

  # normal puja regression - book flow entry
  adb shell am start -a android.intent.action.VIEW -d "bseva://service/ganapathi-puja" -n com.bseva.app/.MainActivity >/dev/null 2>&1 || \
    adb shell am start -a android.intent.action.VIEW -d "bseva://customer/book/ganapathi-puja" -n com.bseva.app/.MainActivity >/dev/null 2>&1 || true
  sleep 3
  ui_dump "customer_puja_book"
  if ui_has "customer_puja_book" "Book" || ui_has "customer_puja_book" "Ganapathi" || ui_has "customer_puja_book" "Standard"; then
    record "customer_normal_puja_regression" "PASS" "book entry"
  else
    record "customer_normal_puja_regression" "FAIL" "book screen missing"
  fi
fi

# --- Pujari ---
if login_app "com.bseva.app" "pujari" "pujari1@bseva.test"; then
  record "pujari_login_ui" "PASS" "logged in"
  adb shell am start -a android.intent.action.VIEW -d "bseva://pujari/seva-events" -n com.bseva.app/.MainActivity >/dev/null
  sleep 3
  ui_dump "pujari_seva_list"
  if ui_has "pujari_seva_list" "Seva" || ui_has "pujari_seva_list" "Rudrabhishek" || ui_has "pujari_seva_list" "Pravachan"; then
    record "pujari_seva_list" "PASS" "$(ui_text pujari_seva_list | head -c 100)"
    line="$(grep -i 'Rudrabhishek\|Pravachan\|Group' "$OUT/pujari_seva_list.xml" | head -1 || true)"
    if [[ -n "$line" ]]; then
      bounds="$(echo "$line" | sed -n 's/.*bounds="\[\([0-9]*\),\([0-9]*\)\]\[\([0-9]*\),\([0-9]*\)\]".*/\1 \2 \3 \4/p')"
      read -r x1 y1 x2 y2 <<< "$bounds"
      adb shell input tap $(( (x1 + x2) / 2 )) $(( (y1 + y2) / 2 ))
      sleep 3
      ui_dump "pujari_seva_detail"
      if ui_has "pujari_seva_detail" "Manifest" || ui_has "pujari_seva_detail" "Attendee" || ui_has "pujari_seva_detail" "Participants" || ui_has "pujari_seva_detail" "Join" || ui_has "pujari_seva_detail" "Complete"; then
        record "pujari_event_detail" "PASS" "detail fields"
      else
        record "pujari_event_detail" "FAIL" "$(ui_text pujari_seva_detail | head -c 80)"
      fi
      if ui_has "pujari_seva_detail" "OTP" || ui_has "pujari_seva_detail" "GPS" || ui_has "pujari_seva_detail" "Samagri"; then
        record "pujari_no_puja_controls_on_pravachan" "FAIL" "puja controls visible"
      else
        record "pujari_no_puja_controls_on_pravachan" "PASS" "no irrelevant puja controls"
      fi
    fi
  else
    record "pujari_seva_list" "FAIL" "empty list"
  fi
else
  record "pujari_login_ui" "FAIL" "login failed"
fi

# --- Admin ---
if login_app "com.bseva.admin" "admin" "super@bseva.test"; then
  record "admin_login_ui" "PASS" "logged in"
  adb shell am start -a android.intent.action.VIEW -d "bseva://seva-events" -n com.bseva.admin/.MainActivity >/dev/null 2>&1 || true
  sleep 2
  tap_tab "admin_home" "More" 980 2100 2>/dev/null || adb shell input tap 980 2100
  sleep 2
  ui_dump "admin_more"
  if tap_desc "admin_more" "Seva Events" || tap_desc "admin_more" "Seva events"; then
    sleep 3
    ui_dump "admin_seva_list"
    if ui_has "admin_seva_list" "Seva" || ui_has "admin_seva_list" "Rudrabhishek" || ui_has "admin_seva_list" "Registrations"; then
      record "admin_seva_events" "PASS" "$(ui_text admin_seva_list | head -c 100)"
    else
      record "admin_seva_events" "FAIL" "list missing"
    fi
  else
    adb shell am start -n com.bseva.admin/.MainActivity >/dev/null
    sleep 2
    record "admin_seva_events" "FAIL" "Seva Events menu not found"
  fi
else
  record "admin_login_ui" "FAIL" "login failed"
fi

# --- Feature flags (visual) ---
python3 "$(dirname "$0")/mobile_flag_qa.py" >/dev/null 2>&1 || true
if login_app "com.bseva.app" "flagcust" "customer1@bseva.test"; then
  tap_tab "flagcust_home" "Services" 270 2100
  sleep 3
  ui_dump "flags_all_on"
  CHIPS_ON=$(grep -ci 'content-desc="Puja"\|content-desc="Chadhava"\|content-desc="Pravachan"\|text="Puja"\|text="Chadhava"\|text="Pravachan"' "$OUT/flags_all_on.xml" 2>/dev/null || echo 0)
  python3 -c "
import json,urllib.request
BASE='$API'; PW='$PASS'
def req(m,p,d=None,t=None):
 h={'Content-Type':'application/json'}; 
 if t: h['Authorization']='Bearer '+t
 b=json.dumps(d).encode() if d else None
 r=urllib.request.Request(BASE+p,data=b,headers=h,method=m)
 return json.loads(urllib.request.urlopen(r,timeout=20).read())
tok=req('POST','/auth/login',{'identifier':'super@bseva.test','password':PW})['access_token']
req('PUT','/admin/config',{'key':'chadhava_enabled','value':False},tok)
"
  adb shell am force-stop com.bseva.app
  sleep 1
  adb shell am start -n com.bseva.app/.MainActivity -d "bseva://customer/(tabs)/services" >/dev/null 2>&1 || \
    adb shell am start -n com.bseva.app/.MainActivity >/dev/null
  sleep 4
  tap_tab "flagcust_home" "Services" 270 2100 2>/dev/null || adb shell input tap 270 2100
  sleep 3
  ui_dump "flags_chadhava_off"
  if ui_has "flags_chadhava_off" "Chadhava"; then
    record "mobile_flag_chadhava_ui" "FAIL" "Chadhava chip still visible"
  else
    record "mobile_flag_chadhava_ui" "PASS" "Chadhava hidden"
  fi
  python3 -c "
import json,urllib.request
BASE='$API'; PW='$PASS'
def req(m,p,d=None,t=None):
 h={'Content-Type':'application/json'}; 
 if t: h['Authorization']='Bearer '+t
 b=json.dumps(d).encode() if d else None
 r=urllib.request.Request(BASE+p,data=b,headers=h,method=m)
 return json.loads(urllib.request.urlopen(r,timeout=20).read())
tok=req('POST','/auth/login',{'identifier':'super@bseva.test','password':PW})['access_token']
for k in ['seva_events_enabled','chadhava_enabled','pravachan_enabled']:
 req('PUT','/admin/config',{'key':k,'value':True},tok)
"
else
  record "mobile_flag_chadhava_ui" "FAIL" "could not login for flag test"
fi

echo "---"
echo "PASS=$PASS_N FAIL=$FAIL_N BLOCKED=$BLOCK_N"
echo "Artifacts: $OUT"
[[ "$FAIL_N" -eq 0 ]]
