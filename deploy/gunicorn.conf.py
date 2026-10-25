"""Gunicorn settings for the B-Seva API container (Uvicorn workers)."""
import os

bind = "0.0.0.0:8000"
worker_class = "uvicorn.workers.UvicornWorker"
workers = int(os.environ.get("GUNICORN_WORKERS", "2"))
timeout = int(os.environ.get("GUNICORN_TIMEOUT", "60"))
graceful_timeout = 30
keepalive = 5
# Bound slow memory growth: recycle each worker after ~1000 requests (staggered).
max_requests = 1000
max_requests_jitter = 100
# Only Nginx (same Docker network) talks to Gunicorn; trust its X-Forwarded-* headers.
forwarded_allow_ips = "*"
accesslog = "-"
errorlog = "-"
access_log_format = '{"event":"http","method":"%(m)s","path":"%(U)s","status":%(s)s,"ms":%(M)s,"request_id":"%({x-request-id}i)s"}'
