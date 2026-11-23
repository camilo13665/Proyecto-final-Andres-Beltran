param(
  [ValidateSet('gateway','reservation','billing','dispatch')][string]$Service='gateway',
  [string]$Image='aegisvolt-gateway:latest',
  [int]$Samples=20,
  [int]$ErrorThreshold=5,
  [string]$Namespace='aegisvolt-dev'
)
$ErrorActionPreference='Stop'
$map=@{
  gateway=@{Deployment='gateway-canary';Stable='gateway-stable';Container='gateway';Port=4000}
  reservation=@{Deployment='station-reservation-canary';Stable='station-reservation-stable';Container='station-reservation';Port=4001}
  billing=@{Deployment='billing-wallet-canary';Stable='billing-wallet-stable';Container='billing-wallet';Port=4002}
  dispatch=@{Deployment='energy-dispatch-canary';Stable='energy-dispatch-stable';Container='energy-dispatch';Port=4003}
}
$item=$map[$Service]
if($Service -ne 'gateway'){$Image="aegisvolt-$($Service):latest"}
if($Service -eq 'reservation'){$Image='aegisvolt-reservation:latest'}
if($Service -eq 'billing'){$Image='aegisvolt-billing:latest'}
if($Service -eq 'dispatch'){$Image='aegisvolt-dispatch:latest'}

kubectl -n $Namespace set image "deployment/$($item.Deployment)" "$($item.Container)=$Image"
kubectl -n $Namespace scale "deployment/$($item.Deployment)" --replicas=1
kubectl -n $Namespace scale "deployment/$($item.Stable)" --replicas=4
kubectl -n $Namespace rollout status "deployment/$($item.Deployment)" --timeout=120s

$localPort=4101
$pf=Start-Process kubectl -ArgumentList "-n $Namespace port-forward deployment/$($item.Deployment) ${localPort}:$($item.Port)" -PassThru -WindowStyle Hidden
try {
  Start-Sleep -Seconds 2
  $failures=0
  for($i=0;$i -lt $Samples;$i++){
    try{$response=Invoke-WebRequest -Uri "http://127.0.0.1:$localPort/health" -TimeoutSec 3 -UseBasicParsing;if($response.StatusCode -ne 200){$failures++}}catch{$failures++}
    Start-Sleep -Milliseconds 250
  }
  $errorRate=[math]::Floor($failures*100/$Samples)
  Write-Host "Canary $Service`: error rate $errorRate% (threshold $ErrorThreshold%)"
  if($errorRate -le $ErrorThreshold){
    kubectl -n $Namespace set image "deployment/$($item.Stable)" "$($item.Container)=$Image"
    kubectl -n $Namespace scale "deployment/$($item.Stable)" --replicas=5
    kubectl -n $Namespace scale "deployment/$($item.Deployment)" --replicas=0
    Write-Host "PROMOTED: $Service 100% stable"
  }else{
    kubectl -n $Namespace rollout undo "deployment/$($item.Deployment)"
    kubectl -n $Namespace scale "deployment/$($item.Deployment)" --replicas=0
    Write-Host "ROLLED BACK: $Service canary removed"
    exit 1
  }
}finally{if($pf -and !$pf.HasExited){Stop-Process -Id $pf.Id -Force}}
