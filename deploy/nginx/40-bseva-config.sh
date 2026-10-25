#!/bin/sh
# Pick the Nginx site config at container start: HTTPS once the certificate exists, otherwise the
# HTTP-only bootstrap (so certbot can complete the ACME challenge). Then reload every 6 hours so
# renewed certificates are picked up without a restart.
#   DOMAIN         canonical host (e.g. b-seva.com)
#   EXTRA_DOMAINS  optional space-separated hosts that 301 to DOMAIN (e.g. "www.b-seva.com app.b-seva.com");
#                  each gets an HTTPS redirect only once the certificate for DOMAIN also covers it.
set -eu
: "${DOMAIN:?DOMAIN must be set}"
EXTRA_DOMAINS="${EXTRA_DOMAINS:-}"
cert="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
renewal="/etc/letsencrypt/renewal/${DOMAIN}.conf"
if [ -f "$cert" ]; then
  template=/etc/nginx/bseva-templates/https.conf.template
else
  template=/etc/nginx/bseva-templates/http.conf.template
fi
envsubst '${DOMAIN}' < "$template" > /etc/nginx/conf.d/default.conf
covered=""
if [ -f "$cert" ] && [ -f "$renewal" ]; then
  for host in $EXTRA_DOMAINS; do
    if grep -q "^${host} = " "$renewal"; then covered="$covered $host"; fi
  done
fi
if [ -n "$covered" ]; then
  cat >> /etc/nginx/conf.d/default.conf <<CONF

# Alternate names: permanent redirect to the canonical host over HTTPS.
server {
    listen 443 ssl;
    http2 on;
    server_name${covered};
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    include /etc/nginx/bseva-templates/security.inc;
    return 301 https://${DOMAIN}\$request_uri;
}
CONF
fi
echo "bseva: using $(basename "$template") for ${DOMAIN}${covered:+; redirecting${covered}}"
(while sleep 21600; do nginx -s reload 2>/dev/null || true; done) &
