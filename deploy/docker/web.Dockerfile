# syntax=docker/dockerfile:1.7
# B-Seva web image: the Vite SPA built once, served by Nginx with TLS and the /api reverse proxy.
# The build stage runs on the builder's native platform (output is static); the final stage is arm64.
FROM --platform=$BUILDPLATFORM node:20.19-bookworm-slim AS build
WORKDIR /src
RUN corepack enable
COPY bseva-export/package.json bseva-export/pnpm-lock.yaml bseva-export/
COPY bseva-export/patches bseva-export/patches
RUN cd bseva-export && pnpm install --frozen-lockfile
COPY packages packages
COPY bseva-export bseva-export
# packages/* import their dependencies (e.g. zod) through Node resolution from the repo root.
RUN ln -s /src/bseva-export/node_modules /src/node_modules

# Public, build-time values only (never secrets). Supplied per environment by CI.
ARG VITE_ADMIN_PATH=/bseva-ops-m8k4q
ARG VITE_GOOGLE_MAPS_API_KEY=
ARG VITE_FIREBASE_API_KEY=
ARG VITE_FIREBASE_AUTH_DOMAIN=
ARG VITE_FIREBASE_PROJECT_ID=
ARG VITE_FIREBASE_STORAGE_BUCKET=
ARG VITE_FIREBASE_MESSAGING_SENDER_ID=
ARG VITE_FIREBASE_APP_ID=
ARG VITE_FIREBASE_VAPID_KEY=
ARG VITE_ANALYTICS_ENDPOINT=
ARG VITE_ANALYTICS_WEBSITE_ID=
RUN cd bseva-export && NODE_ENV=production VITE_API_URL= \
    VITE_ADMIN_PATH="$VITE_ADMIN_PATH" VITE_GOOGLE_MAPS_API_KEY="$VITE_GOOGLE_MAPS_API_KEY" \
    VITE_FIREBASE_API_KEY="$VITE_FIREBASE_API_KEY" VITE_FIREBASE_AUTH_DOMAIN="$VITE_FIREBASE_AUTH_DOMAIN" \
    VITE_FIREBASE_PROJECT_ID="$VITE_FIREBASE_PROJECT_ID" VITE_FIREBASE_STORAGE_BUCKET="$VITE_FIREBASE_STORAGE_BUCKET" \
    VITE_FIREBASE_MESSAGING_SENDER_ID="$VITE_FIREBASE_MESSAGING_SENDER_ID" VITE_FIREBASE_APP_ID="$VITE_FIREBASE_APP_ID" \
    VITE_FIREBASE_VAPID_KEY="$VITE_FIREBASE_VAPID_KEY" VITE_ANALYTICS_ENDPOINT="$VITE_ANALYTICS_ENDPOINT" \
    VITE_ANALYTICS_WEBSITE_ID="$VITE_ANALYTICS_WEBSITE_ID" \
    pnpm run build:web

FROM nginx:1.27-alpine
COPY --from=build /src/bseva-export/dist/public /usr/share/nginx/html
COPY deploy/nginx/templates /etc/nginx/bseva-templates
COPY deploy/nginx/40-bseva-config.sh /docker-entrypoint.d/40-bseva-config.sh
ENV DOMAIN=qa.b-seva.com
EXPOSE 80 443
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1/nginx-health >/dev/null || exit 1
