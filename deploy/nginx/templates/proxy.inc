proxy_pass http://api:8000;
proxy_http_version 1.1;
proxy_set_header Host $host;
# The API's rate limiter trusts X-Real-IP; Nginx overwrites any client-supplied values.
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $remote_addr;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Request-ID $request_id;
proxy_set_header Connection "";
proxy_connect_timeout 5s;
proxy_read_timeout 60s;
proxy_next_upstream error timeout;
proxy_next_upstream_tries 2;
