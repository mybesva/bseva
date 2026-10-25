#!/bin/bash
# Build the QA images on the host from a source archive in the QA bucket (used before CI/CD is enabled).
#   /opt/bseva/bin/build-on-host.sh s3://<bucket>/deploy-artifacts/<sha>.tar.gz sha-<git sha>
# Produces local/<IMAGE_PREFIX>-api:<tag> and -web:<tag> (prefix bseva on QA, bseva-prod on Production); then run deploy.sh with REGISTRY=local.
set -euo pipefail
SRC="${1:?usage: build-on-host.sh s3://bucket/key.tar.gz sha-<git sha>}"
TAG="${2:?usage: build-on-host.sh s3://bucket/key.tar.gz sha-<git sha>}"
[[ "$TAG" =~ ^sha-[0-9a-f]{7,40}$ ]] || { echo "invalid tag: $TAG" >&2; exit 1; }
set -a; source /opt/bseva/.env; set +a
IMG="local/${IMAGE_PREFIX:-bseva}"
WORK="/opt/bseva/build/${TAG}"
rm -rf "$WORK" && install -d -m 0755 "$WORK"
aws s3 cp --only-show-errors --region "$AWS_REGION" "$SRC" "$WORK/src.tar.gz"
tar -xzf "$WORK/src.tar.gz" -C "$WORK" && rm -f "$WORK/src.tar.gz"
cd "$WORK"
DOCKER_BUILDKIT=1 docker build -q -f deploy/docker/api.Dockerfile --build-arg APP_VERSION="$TAG" -t "${IMG}-api:${TAG}" .
# Public, per-environment web build values (VITE_*: Maps browser key, Firebase web config) from /bseva/<env>/build/.
web_args=()
while IFS=$'\t' read -r name value; do
  [ -n "$name" ] || continue
  web_args+=(--build-arg "${name##*/}=${value}")
done < <(aws ssm get-parameters-by-path --region "$AWS_REGION" --path "/bseva/${ENV_NAME:-qa}/build/" \
           --query 'Parameters[].[Name,Value]' --output text)
echo "web build values: $(( ${#web_args[@]} / 2 )) from /bseva/${ENV_NAME:-qa}/build/"
DOCKER_BUILDKIT=1 docker build -q -f deploy/docker/web.Dockerfile "${web_args[@]}" -t "${IMG}-web:${TAG}" .
docker run --rm --add-host api:127.0.0.1 -e DOMAIN="$DOMAIN" "${IMG}-web:${TAG}" nginx -t
cd / && rm -rf "$WORK"
echo "built ${IMG}-api:${TAG} and ${IMG}-web:${TAG}"
