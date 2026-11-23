$ErrorActionPreference='Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

Write-Host 'AegisVolt demo: seed + success + fault + restore'
$env:APP_ENV='dev'
$env:AWS_ENDPOINT_URL='http://localhost:4566'
$env:AWS_REGION='us-east-1'
$env:AWS_ACCESS_KEY_ID='test'
$env:AWS_SECRET_ACCESS_KEY='test'

npm run seed --workspace gateway

function GraphQL($query) {
  $body=@{query=$query}|ConvertTo-Json -Compress -Depth 10
  return Invoke-RestMethod -Uri 'http://localhost:4000/graphql' -Method Post -ContentType 'application/json' -Body $body
}

$success=@"
mutation {
  reserveAndActivateCharge(input:{fleetId:"fleet-001",stationId:"station-001",connectorId:"connector-001",estimatedKwh:10}) {
    id status failureReason compensations { step outcome at }
  }
}
"@
Write-Host '--- Successful SAGA ---'
$successResult=GraphQL $success
$successResult.data.reserveAndActivateCharge|ConvertTo-Json -Depth 8

npm run set-flags --workspace gateway
$enable=@"
mutation {
  setFeatureFlag(name:"SIMULATE_CHARGER_HARDWARE_FAULT",enabled:true) { name enabled }
}
"@
GraphQL $enable|Out-Null
Start-Sleep -Seconds 4

$fault=@"
mutation {
  reserveAndActivateCharge(input:{fleetId:"fleet-001",stationId:"station-001",connectorId:"connector-002",estimatedKwh:10}) {
    id status failureReason compensations { step outcome at }
  }
}
"@
Write-Host '--- Hardware fault SAGA ---'
$faultResult=GraphQL $fault
$faultResult.data.reserveAndActivateCharge|ConvertTo-Json -Depth 8

npm run set-flags --workspace gateway
Write-Host '--- Flags restored ---'
GraphQL '{ featureFlags { name enabled } }'|ConvertTo-Json -Depth 8
