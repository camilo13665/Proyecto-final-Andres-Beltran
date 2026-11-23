#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

for branch in dev test prod; do
  gh api --method PUT \
    "repos/$REPO/branches/$branch/protection" \
    --field required_status_checks='{"strict":true,"contexts":["lint-build","unit-tests","integration-tests","e2e-tests","terraform-plan"]}' \
    --field enforce_admins=true \
    --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
    --field restrictions=null \
    --field allow_force_pushes=false \
    --field allow_deletions=false
  echo "Protected $branch in $REPO"
done
