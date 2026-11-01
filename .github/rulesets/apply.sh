#!/bin/bash
# Apply the GitHub side of docs/deployment/CI-CD.md. Run as a repository admin (gh auth switch -u <admin>).
#   .github/rulesets/apply.sh            show what exists, change nothing
#   .github/rulesets/apply.sh --apply    create/update the aws-production environment and the branch rulesets
# Idempotent: rulesets are matched by name and updated in place.
set -euo pipefail
REPO="${REPO:-mybesva/bseva}"
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "== environments"; gh api "repos/$REPO/environments" --jq '.environments[] | "\(.name)\tbypass=\(.can_admins_bypass)\trules=\([.protection_rules[].type] | join(","))"'
echo "== rulesets"; gh api "repos/$REPO/rulesets" --jq '.[] | "\(.id)\t\(.name)\t\(.enforcement)"'
[ "${1:-}" = "--apply" ] || { echo "(dry run; pass --apply to change settings)"; exit 0; }

gh api -X PUT "repos/$REPO/environments/aws-production" --input "$DIR/aws-production-environment.json" >/dev/null
if ! gh api "repos/$REPO/environments/aws-production/deployment-branch-policies" --jq '.branch_policies[].name' | grep -qx main; then
  gh api -X POST "repos/$REPO/environments/aws-production/deployment-branch-policies" -f name=main -f type=branch >/dev/null
fi
echo "aws-production: reviewers set, main only, admins cannot bypass"

for f in main develop staging; do
  name="$(jq -r .name "$DIR/$f.json")"
  id="$(gh api "repos/$REPO/rulesets" --jq ".[] | select(.name == \"$name\") | .id")"
  if [ -n "$id" ]; then
    gh api -X PUT "repos/$REPO/rulesets/$id" --input "$DIR/$f.json" >/dev/null && echo "updated: $name"
  else
    gh api -X POST "repos/$REPO/rulesets" --input "$DIR/$f.json" >/dev/null && echo "created: $name"
  fi
done
echo "== active rules on main"; gh api "repos/$REPO/rules/branches/main" --jq '.[].type'
