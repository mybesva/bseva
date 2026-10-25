#!/bin/bash
# One-time Let's Encrypt certificate for this host's domain (HTTP-01 webroot), then switch Nginx to HTTPS.
# Requires: DNS A record for $DOMAIN -> this host's Elastic IP, and the web container running on :80.
#   /opt/bseva/bin/issue-cert.sh <contact-email>
set -euo pipefail
set -a; source /opt/bseva/.env; set +a
EMAIL="${1:?usage: issue-cert.sh <contact-email>}"
if [ -f "/opt/bseva/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
  echo "certificate for ${DOMAIN} already present"; exit 0
fi
docker run --rm \
  -v /opt/bseva/letsencrypt:/etc/letsencrypt \
  -v /opt/bseva/certbot-www:/var/www/certbot \
  certbot/certbot:v3.3.0 certonly --webroot -w /var/www/certbot \
  -d "$DOMAIN" --email "$EMAIL" --agree-tos --no-eff-email --non-interactive
docker compose --env-file /opt/bseva/.env -f /opt/bseva/compose/compose.yml restart web
echo "certificate issued for ${DOMAIN}; nginx restarted with HTTPS"
