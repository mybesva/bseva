#!/bin/bash
# Health-gated deploy of one immutable image tag on the QA host. Run via SSM Run Command:
#   /opt/bseva/bin/deploy.sh sha-<git sha>      deploy that tag (migrations first)
#   /opt/bseva/bin/deploy.sh --rollback         redeploy the previous good tag
# On a failed health check the previous good tag is restored automatically and the script exits 1.
set -euo pipefail
cd /opt/bseva
# shellcheck disable=SC1091
source /opt/bseva/.env   # REGISTRY, DOMAIN, AWS_REGION (no secrets)
STATE=/opt/bseva/state
COMPOSE=(docker compose --env-file /opt/bseva/.env -f /opt/bseva/compose/compose.qa.yml)

log() { echo "{\"event\":\"$1\",\"tag\":\"${2:-}\",\"ts\":\"$(date -Is)\"}"; }

if [ "${1:-}" = "--rollback" ]; then
  TAG="$(cat "$STATE/previous_tag" 2>/dev/null || true)"
  [ -n "$TAG" ] || { echo "no previous tag recorded" >&2; exit 1; }
else
  TAG="${1:?usage: deploy.sh sha-<git sha> | --rollback}"
fi
[[ "$TAG" =~ ^sha-[0-9a-f]{7,40}$ ]] || { echo "invalid tag: $TAG" >&2; exit 1; }

CURRENT="$(cat "$STATE/current_tag" 2>/dev/null || true)"

up_tag() {
  export IMAGE_TAG="$1"
  aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
  "${COMPOSE[@]}" pull --quiet api worker web certbot
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

log deploy_start "$TAG"
/opt/bseva/bin/render-env.sh
export IMAGE_TAG="$TAG"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
"${COMPOSE[@]}" pull --quiet api
"${COMPOSE[@]}" run --rm migrate
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
  up_tag "$CURRENT"
  if healthy "$CURRENT"; then log rollback_ok "$CURRENT"; else log rollback_unhealthy "$CURRENT"; fi
fi
exit 1
