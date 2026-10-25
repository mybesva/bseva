#!/bin/bash
# Let's Encrypt certificate (HTTP-01 webroot) for DOMAIN plus every name in EXTRA_DOMAINS, then restart Nginx so
# it serves HTTPS (and the HTTPS redirects for the extra names). Re-run after adding names: the certificate is expanded.
# Requires: DNS A records for every name -> this host's Elastic IP, and the web container running on :80.
#   /opt/bseva/bin/issue-cert.sh <contact-email>
set -euo pipefail
set -a; source /opt/bseva/.env; set +a
EMAIL="${1:?usage: issue-cert.sh <contact-email>}"
NAMES=("$DOMAIN")
for host in ${EXTRA_DOMAINS:-}; do NAMES+=("$host"); done
renewal="/opt/bseva/letsencrypt/renewal/${DOMAIN}.conf"
missing=0
for host in "${NAMES[@]}"; do grep -q "^${host} = " "$renewal" 2>/dev/null || missing=1; done
if [ -f "/opt/bseva/letsencrypt/live/${DOMAIN}/fullchain.pem" ] && [ "$missing" = 0 ]; then
  echo "certificate for ${NAMES[*]} already present"; exit 0
fi
args=()
for host in "${NAMES[@]}"; do args+=(-d "$host"); done
docker run --rm \
  -v /opt/bseva/letsencrypt:/etc/letsencrypt \
  -v /opt/bseva/certbot-www:/var/www/certbot \
  certbot/certbot:v3.3.0 certonly --webroot -w /var/www/certbot --cert-name "$DOMAIN" --expand \
  "${args[@]}" --email "$EMAIL" --agree-tos --no-eff-email --non-interactive
docker compose --env-file /opt/bseva/.env -f /opt/bseva/compose/compose.yml restart web
echo "certificate issued for ${NAMES[*]}; nginx restarted with HTTPS"
