# Security headers. Re-included in every location that sets its own add_header,
# because Nginx drops inherited add_header directives when a location defines any.
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header X-Frame-Options "DENY" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
add_header Strict-Transport-Security "max-age=31536000" always;
