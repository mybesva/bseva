# Shared B-Seva locations (included by both the HTTP-bootstrap and HTTPS servers).
root /usr/share/nginx/html;
client_max_body_size 12m;
include /etc/nginx/bseva-templates/security.inc;

location = /nginx-health { access_log off; default_type text/plain; return 200 "ok\n"; }

# Scheduled jobs run inside the worker container; the HTTP cron endpoints are never public here.
location ^~ /api/v1/ops/cron/ { return 404; }

location ^~ /api/v1/auth/ {
    limit_req zone=bseva_auth burst=20 nodelay;
    include /etc/nginx/bseva-templates/proxy.inc;
}

location = /api/v1/support/contact {
    limit_req zone=bseva_contact burst=3 nodelay;
    include /etc/nginx/bseva-templates/proxy.inc;
}

location /api/ {
    limit_req zone=bseva_api burst=60 nodelay;
    include /etc/nginx/bseva-templates/proxy.inc;
}

location = /health { include /etc/nginx/bseva-templates/proxy.inc; }

# Fingerprinted build assets: cache for a year.
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, immutable" always;
    include /etc/nginx/bseva-templates/security.inc;
    try_files $uri =404;
}

# Push service worker and the SPA shell must always revalidate.
location = /firebase-messaging-sw.js {
    add_header Cache-Control "no-cache" always;
    include /etc/nginx/bseva-templates/security.inc;
    try_files $uri =404;
}
location = /index.html {
    add_header Cache-Control "no-cache" always;
    include /etc/nginx/bseva-templates/security.inc;
}

location / {
    try_files $uri $uri/ /index.html;
}
