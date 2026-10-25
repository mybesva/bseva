#!/bin/bash
# EC2 user-data for a B-Seva host (QA or Production) (Amazon Linux 2023, arm64). Idempotent; safe to re-run.
# Installs Docker + the Compose plugin, adds 2 GB swap, creates /opt/bseva and the deploy tooling.
set -euo pipefail
exec > >(tee -a /var/log/bseva-bootstrap.log) 2>&1

COMPOSE_VERSION="v2.29.7"
ARCH="aarch64"

dnf -y update --security || true
dnf -y install docker jq
systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  mkdir -p /usr/local/lib/docker/cli-plugins
  base="https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}"
  curl -fsSL "${base}/docker-compose-linux-${ARCH}" -o /tmp/docker-compose
  curl -fsSL "${base}/docker-compose-linux-${ARCH}.sha256" -o /tmp/docker-compose.sha256
  (cd /tmp && sed 's#\*.*#*docker-compose#' docker-compose.sha256 | sha256sum -c -)
  install -m 0755 /tmp/docker-compose /usr/local/lib/docker/cli-plugins/docker-compose
fi

if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

install -d -m 0755 /opt/bseva /opt/bseva/bin /opt/bseva/compose /opt/bseva/certbot-www /opt/bseva/letsencrypt
install -d -m 0700 /opt/bseva/env /opt/bseva/secrets /opt/bseva/state
echo "bootstrap complete $(date -Is)"
