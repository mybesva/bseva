#!/bin/sh
# Pick the Nginx site config at container start: HTTPS once the certificate exists, otherwise the
# HTTP-only bootstrap (so certbot can complete the ACME challenge). Then reload every 6 hours so
# renewed certificates are picked up without a restart.
set -eu
: "${DOMAIN:?DOMAIN must be set}"
cert="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
if [ -f "$cert" ]; then
  template=/etc/nginx/bseva-templates/https.conf.template
else
  template=/etc/nginx/bseva-templates/http.conf.template
fi
envsubst '${DOMAIN}' < "$template" > /etc/nginx/conf.d/default.conf
echo "bseva: using $(basename "$template") for ${DOMAIN}"
(while sleep 21600; do nginx -s reload 2>/dev/null || true; done) &
