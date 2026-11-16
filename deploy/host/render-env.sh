#!/bin/bash
# Render runtime configuration from SSM Parameter Store (instance-role credentials; values never printed).
#   /bseva/<env>/app/<NAME>    -> /opt/bseva/env/app.env      (NAME=value, mode 600)
#   /bseva/<env>/files/<NAME>  -> /opt/bseva/secrets/<NAME>   (credential files, mode 600, owned by the API user)
set -euo pipefail
ENV_NAME="${ENV_NAME:-qa}"
REGION="${AWS_REGION:-ap-south-1}"
OUT=/opt/bseva/env/app.env
TMP="$(mktemp /opt/bseva/env/.app.env.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

fetch() {
  aws ssm get-parameters-by-path --region "$REGION" --path "$1" --recursive --with-decryption \
    --query 'Parameters[].[Name,Value]' --output json
}

fetch "/bseva/${ENV_NAME}/app/" | jq -r '.[] | "\(.[0] | split("/") | last)=\(.[1])"' > "$TMP"
count="$(wc -l < "$TMP" | tr -d ' ')"
if [ "$count" -lt 5 ]; then
  echo "render-env: only ${count} parameters under /bseva/${ENV_NAME}/app/ — refusing to deploy" >&2
  exit 1
fi
chmod 600 "$TMP" && mv "$TMP" "$OUT"
trap - EXIT

# The API container runs as uid 10001 (deploy/docker/api.Dockerfile) and reads these through the
# read-only mount /run/bseva-secrets, so the folder and files belong to that uid; nobody else can read them.
APP_UID=10001
install -d -m 0700 -o "$APP_UID" -g "$APP_UID" /opt/bseva/secrets
fetch "/bseva/${ENV_NAME}/files/" | jq -c '.[]' | while read -r item; do
  name="$(jq -r '.[0] | split("/") | last' <<<"$item")"
  jq -r '.[1]' <<<"$item" > "/opt/bseva/secrets/${name}"
  chmod 600 "/opt/bseva/secrets/${name}"
  chown "$APP_UID:$APP_UID" "/opt/bseva/secrets/${name}"
done
echo "render-env: ${count} app parameters rendered for ${ENV_NAME}"
