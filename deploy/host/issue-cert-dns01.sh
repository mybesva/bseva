#!/bin/bash
# Pre-issue the certificate for a domain that does not point at this host yet (DNS-01, manual TXT records), so the
# DNS cutover has no certificate warnings. The live site keeps running on DOMAIN from /opt/bseva/.env meanwhile.
#   /opt/bseva/bin/issue-cert-dns01.sh <contact-email> <cert-name> <name> [<name> ...]
#   e.g. issue-cert-dns01.sh mybseva@gmail.com b-seva.com b-seva.com www.b-seva.com app.b-seva.com
# While it runs, /opt/bseva/state/acme-dns01.txt lists the TXT records to add at the DNS provider (names Let's Encrypt
# already trusts from an earlier certificate need none); it waits (up to
# 12 h) until public DNS shows all of them, then validates. Remove the TXT records afterwards.
# Renewal: once DNS points here, run issue-cert.sh with DOMAIN=<cert-name>; it switches the certificate to HTTP-01.
set -euo pipefail
EMAIL="${1:?usage: issue-cert-dns01.sh <email> <cert-name> <name>...}"; CERT="${2:?cert name}"; shift 2
[ "$#" -ge 1 ] || { echo "at least one name required" >&2; exit 1; }
PENDING=/opt/bseva/state/acme-dns01.txt
install -d -m 0755 /opt/bseva/state /opt/bseva/acme-hooks
: > "$PENDING"
cat > /opt/bseva/acme-hooks/auth.py <<'PY'
import json, os, sys, time, urllib.request
pending = "/hooks-state/acme-dns01.txt"
name, value = f"_acme-challenge.{os.environ['CERTBOT_DOMAIN']}", os.environ["CERTBOT_VALIDATION"]
with open(pending, "a") as f:
    f.write(f"{name} TXT {value}\n")
entries = [l.split() for l in open(pending) if l.strip()]
if int(os.environ.get("CERTBOT_REMAINING_CHALLENGES", "0")) > 0:
    sys.exit(0)  # certbot calls this hook once per pending challenge before validating; only the last call waits
def visible(n, v):
    for url in (f"https://dns.google/resolve?name={n}&type=TXT", f"https://cloudflare-dns.com/dns-query?name={n}&type=TXT"):
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/dns-json"})
            answers = json.load(urllib.request.urlopen(req, timeout=10)).get("Answer", [])
            if not any(v in a.get("data", "") for a in answers):
                return False
        except Exception:
            return False
    return True
deadline = time.time() + 12 * 3600
while time.time() < deadline:
    if all(visible(n, v) for n, _t, v in entries):
        time.sleep(60)  # let the remaining authoritative/secondary caches catch up
        sys.exit(0)
    time.sleep(30)
sys.exit("TXT records not visible within 12 hours")
PY
args=(); for n in "$@"; do args+=(-d "$n"); done
docker run --rm \
  -v /opt/bseva/letsencrypt:/etc/letsencrypt -v /opt/bseva/acme-hooks:/hooks:ro -v /opt/bseva/state:/hooks-state \
  certbot/certbot:v3.3.0 certonly --manual --preferred-challenges dns --manual-auth-hook "python3 /hooks/auth.py" \
  --cert-name "$CERT" "${args[@]}" --email "$EMAIL" --agree-tos --no-eff-email --non-interactive
install -d -m 0755 /opt/bseva/letsencrypt/bseva-names
printf '%s\n' "$@" > "/opt/bseva/letsencrypt/bseva-names/${CERT}"
echo "certificate '${CERT}' issued for: $*"
