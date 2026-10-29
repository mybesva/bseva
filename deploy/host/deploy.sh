#!/bin/bash
# Health-gated deploy of one immutable image tag on this host (QA or Production, per ENV_NAME in /opt/bseva/.env). Run via SSM Run Command:
#   /opt/bseva/bin/deploy.sh sha-<git sha>      deploy that tag (migrations first; a failed migration stops the deploy)
#   /opt/bseva/bin/deploy.sh --rollback         redeploy the previous good tag
#   /opt/bseva/bin/deploy.sh --preflight sha-…  read-only: check the target database and print the migration plan
# On a failed health check the previous good tag is restored automatically and the script exits 1.
# Rollback restores the application only: migrations are forward-only and must stay compatible with the previous release.
set -euo pipefail
cd /opt/bseva
# shellcheck disable=SC1091
set -a; source /opt/bseva/.env; set +a   # ENV_NAME, REGISTRY, DOMAIN, AWS_REGION (no secrets)
STATE=/opt/bseva/state
COMPOSE=(docker compose --env-file /opt/bseva/.env -f /opt/bseva/compose/compose.yml)

log() { echo "{\"event\":\"$1\",\"tag\":\"${2:-}\",\"ts\":\"$(date -Is)\"}"; }

MODE=deploy
if [ "${1:-}" = "--preflight" ]; then
  MODE=preflight
  shift
fi

if [ "${1:-}" = "--rollback" ]; then
  TAG="$(cat "$STATE/previous_tag" 2>/dev/null || true)"
  [ -n "$TAG" ] || { echo "no previous tag recorded" >&2; exit 1; }
else
  TAG="${1:?usage: deploy.sh sha-<git sha> | --rollback}"
fi
[[ "$TAG" =~ ^sha-[0-9a-f]{7,40}$ ]] || { echo "invalid tag: $TAG" >&2; exit 1; }

CURRENT="$(cat "$STATE/current_tag" 2>/dev/null || true)"

pull() {
  # REGISTRY=local: images were built on this host (build-on-host.sh); only third-party images are pulled.
  if [ "$REGISTRY" = "local" ]; then
    "${COMPOSE[@]}" pull --quiet certbot
    return
  fi
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
  "${COMPOSE[@]}" pull --quiet "$@"
}

up_tag() {
  export IMAGE_TAG="$1"
  pull api worker web certbot
  "${COMPOSE[@]}" up -d --remove-orphans api worker web certbot
}

ready_url() {
  # After the certificate exists, port 80 only redirects; check through Nginx's TLS listener locally.
  if [ -f "/opt/bseva/letsencrypt/live/${DOMAIN}/fullchain.pem" ]; then
    echo "--resolve ${DOMAIN}:443:127.0.0.1 https://${DOMAIN}/api/ready"
  else
    echo "http://127.0.0.1/api/ready"
  fi
}

healthy() {
  local want="$1" url
  url="$(ready_url)"
  for _ in $(seq 1 30); do
    # shellcheck disable=SC2086  # url intentionally expands to curl arguments
    body="$(curl -fsS --max-time 5 $url 2>/dev/null || true)"
    if jq -e --arg v "$want" '.ok == true and .version == $v' >/dev/null 2>&1 <<<"$body"; then
      return 0
    fi
    sleep 5
  done
  return 1
}

migrate() {
  # The migrate container refuses any database other than this environment's RDS instance.
  local expected_env
  case "$ENV_NAME" in
    qa) expected_env=qa ;;
    prod) expected_env=production ;;
    *) echo "unknown ENV_NAME: $ENV_NAME" >&2; return 1 ;;
  esac
  "${COMPOSE[@]}" run --rm \
    -e REQUIRE_TARGET_GUARD=1 \
    -e EXPECTED_DB_HOST_PREFIX="bseva-${ENV_NAME}-db." \
    -e EXPECTED_ENVIRONMENT="$expected_env" \
    migrate "$@"
}

if [ "$MODE" = preflight ]; then
  # Nothing is written to the database and no container is replaced.
  /opt/bseva/bin/render-env.sh
  export IMAGE_TAG="$TAG"
  pull api
  migrate python -m app.db_bootstrap --check-target
  migrate python -m app.db_bootstrap --status
  log preflight_ok "$TAG"
  exit 0
fi

log deploy_start "$TAG"
/opt/bseva/bin/render-env.sh
export IMAGE_TAG="$TAG"
pull api
if ! migrate; then
  # Each SQL file and the ensure_schema transaction roll back on error; the running release is untouched.
  log migrate_failed "$TAG"
  exit 1
fi
up_tag "$TAG"

if healthy "$TAG"; then
  if [ -n "$CURRENT" ] && [ "$CURRENT" != "$TAG" ]; then echo "$CURRENT" > "$STATE/previous_tag"; fi
  echo "$TAG" > "$STATE/current_tag"
  docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true
  log deploy_ok "$TAG"
  exit 0
fi

log deploy_unhealthy "$TAG"
if [ -n "$CURRENT" ] && [ "$CURRENT" != "$TAG" ]; then
  # A release built on the host (build-on-host.sh) exists only as local/<prefix>-api:<tag>, never in ECR.
  if [ "$REGISTRY" != local ] && docker image inspect "local/${IMAGE_PREFIX:-bseva}-api:${CURRENT}" >/dev/null 2>&1 \
     && ! docker image inspect "${REGISTRY}/${IMAGE_PREFIX:-bseva}-api:${CURRENT}" >/dev/null 2>&1; then
    export REGISTRY=local
  fi
  up_tag "$CURRENT"
  if healthy "$CURRENT"; then log rollback_ok "$CURRENT"; else log rollback_unhealthy "$CURRENT"; fi
fi
exit 1
