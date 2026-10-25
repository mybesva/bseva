# syntax=docker/dockerfile:1.7
# B-Seva API + worker image (FastAPI). Built for linux/arm64 (EC2 t4g / Graviton).
# Build from the repository root:  docker buildx build -f deploy/docker/api.Dockerfile --platform linux/arm64 .
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# WeasyPrint runtime (Pango/HarfBuzz) + Noto fonts for the Indian-language scripts used in documents.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz0b libfontconfig1 fonts-noto-core curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Amazon RDS CA bundle for sslmode=verify-full.
RUN mkdir -p /etc/ssl/rds \
 && curl -fsSL https://truststore.pki.rds.amazonaws.com/ap-south-1/ap-south-1-bundle.pem -o /etc/ssl/rds/rds-ca.pem

WORKDIR /srv
COPY backend/requirements.txt deploy/requirements-server.txt /tmp/req/
RUN pip install -r /tmp/req/requirements-server.txt

COPY deploy/gunicorn.conf.py /srv/deploy/gunicorn.conf.py
COPY supabase/migrations /srv/supabase/migrations
# Catalog images are served by the API (/images and /api/v1/services/{slug}/image fallbacks).
COPY bseva-export/client/public/images /srv/bseva-export/client/public/images
COPY backend /srv/backend

RUN useradd --system --uid 10001 --home /srv bseva \
 && mkdir -p /srv/backend/app/data/documents \
 && chown -R bseva /srv/backend/app/data

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

USER bseva
WORKDIR /srv/backend
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1

CMD ["gunicorn", "-c", "/srv/deploy/gunicorn.conf.py", "app.main:app"]
