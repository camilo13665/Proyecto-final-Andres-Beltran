$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$kind = 'C:\Users\cbtub\AppData\Local\Microsoft\WinGet\Packages\Kubernetes.kind_Microsoft.Winget.Source_8wekyb3d8bbwe\kind.exe'

& $kind create cluster --name aegisvolt --config (Join-Path $root 'k8s\kind-config.yaml')
if ($LASTEXITCODE -ne 0) { throw 'kind failed to create the aegisvolt cluster' }

foreach ($image in @(
  'aegisvolt-reservation:latest',
  'aegisvolt-billing:latest',
  'aegisvolt-dispatch:latest',
  'aegisvolt-gateway:latest',
  'aegisvolt-frontend:latest'
)) {
  & $kind load docker-image --name aegisvolt $image
}

kubectl apply -k (Join-Path $root 'k8s\overlays\dev')
foreach ($deployment in @(
  'station-reservation-stable',
  'billing-wallet-stable',
  'energy-dispatch-stable',
  'gateway-stable'
)) {
  kubectl -n aegisvolt-dev rollout status "deployment/$deployment" --timeout=120s
}

Write-Host 'Kind cluster aegisvolt is ready in namespace aegisvolt-dev'
