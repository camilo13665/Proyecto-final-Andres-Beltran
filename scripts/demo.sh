#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "$0")/.." && pwd)"

export APP_ENV=dev
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=test
export AWS_SECRET_ACCESS_KEY=test

npm run seed --workspace gateway

graphql() {
  local query="$1"
  curl -sS -H 'Content-Type: application/json' --data "{\"query\":$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$query")}" http://localhost:4000/graphql
}

printf '%s\n' '--- Successful SAGA ---'
graphql 'mutation { reserveAndActivateCharge(input:{fleetId:"fleet-001",stationId:"station-001",connectorId:"connector-001",estimatedKwh:10}) { id status failureReason compensations { step outcome at } } }'

npm run set-flags --workspace gateway
graphql 'mutation { setFeatureFlag(name:"SIMULATE_CHARGER_HARDWARE_FAULT",enabled:true) { name enabled } }'

printf '%s\n' '--- Hardware fault SAGA ---'
graphql 'mutation { reserveAndActivateCharge(input:{fleetId:"fleet-001",stationId:"station-001",connectorId:"connector-002",estimatedKwh:10}) { id status failureReason compensations { step outcome at } } }'

npm run set-flags --workspace gateway
printf '%s\n' '--- Flags restored ---'
graphql '{ featureFlags { name enabled } }'
