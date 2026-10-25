#!/bin/bash
# Render runtime configuration from SSM Parameter Store (instance-role credentials; values never printed).
#   /bseva/qa/app/<NAME>    -> /opt/bseva/env/app.env      (NAME=value, mode 600)
#   /bseva/qa/files/<NAME>  -> /opt/bseva/secrets/<NAME>   (JSON credentials as files, mode 640)
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

fetch "/bseva/${ENV_NAME}/files/" | jq -c '.[]' | while read -r item; do
  name="$(jq -r '.[0] | split("/") | last' <<<"$item")"
  jq -r '.[1]' <<<"$item" > "/opt/bseva/secrets/${name}"
  chmod 640 "/opt/bseva/secrets/${name}"
  chgrp 10001 "/opt/bseva/secrets/${name}" 2>/dev/null || true
done
echo "render-env: ${count} app parameters rendered for ${ENV_NAME}"
