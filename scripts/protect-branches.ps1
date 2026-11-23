param([string]$Repo)
$ErrorActionPreference='Stop'
if(-not $Repo){$Repo=gh repo view --json nameWithOwner --jq '.nameWithOwner'}
foreach($branch in 'dev','test','prod'){
  $body=@{
    required_status_checks=@{strict=$true;contexts=@('lint-build','unit-tests','integration-tests','e2e-tests','terraform-plan')}
    enforce_admins=$true
    required_pull_request_reviews=@{required_approving_review_count=1;dismiss_stale_reviews=$true}
    restrictions=$null
    allow_force_pushes=$false
    allow_deletions=$false
  }|ConvertTo-Json -Depth 5 -Compress
  $body | gh api --method PUT "repos/$Repo/branches/$branch/protection" --input -
  Write-Host "Protected $branch in $Repo"
}
