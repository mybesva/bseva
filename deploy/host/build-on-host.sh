#!/bin/bash
# Build the QA images on the host from a source archive in the QA bucket (used before CI/CD is enabled).
#   /opt/bseva/bin/build-on-host.sh s3://<bucket>/deploy-artifacts/<sha>.tar.gz sha-<git sha>
# Produces local/bseva-api:<tag> and local/bseva-web:<tag>; then run deploy.sh with REGISTRY=local.
set -euo pipefail
SRC="${1:?usage: build-on-host.sh s3://bucket/key.tar.gz sha-<git sha>}"
TAG="${2:?usage: build-on-host.sh s3://bucket/key.tar.gz sha-<git sha>}"
[[ "$TAG" =~ ^sha-[0-9a-f]{7,40}$ ]] || { echo "invalid tag: $TAG" >&2; exit 1; }
source /opt/bseva/.env
WORK="/opt/bseva/build/${TAG}"
rm -rf "$WORK" && install -d -m 0755 "$WORK"
aws s3 cp --only-show-errors --region "$AWS_REGION" "$SRC" "$WORK/src.tar.gz"
tar -xzf "$WORK/src.tar.gz" -C "$WORK" && rm -f "$WORK/src.tar.gz"
cd "$WORK"
DOCKER_BUILDKIT=1 docker build -q -f deploy/docker/api.Dockerfile --build-arg APP_VERSION="$TAG" -t "local/bseva-api:${TAG}" .
DOCKER_BUILDKIT=1 docker build -q -f deploy/docker/web.Dockerfile -t "local/bseva-web:${TAG}" .
docker run --rm --add-host api:127.0.0.1 -e DOMAIN="$DOMAIN" "local/bseva-web:${TAG}" nginx -t
cd / && rm -rf "$WORK"
echo "built local/bseva-api:${TAG} and local/bseva-web:${TAG}"
