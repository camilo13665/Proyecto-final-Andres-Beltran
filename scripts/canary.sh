#!/usr/bin/env bash
set -euo pipefail

NAMESPACE="${NAMESPACE:-aegisvolt-dev}"
SERVICE="${1:-gateway}"
IMAGE="${2:-aegisvolt-gateway:latest}"
SAMPLES="${SAMPLES:-20}"
ERROR_THRESHOLD="${ERROR_THRESHOLD:-5}"

case "$SERVICE" in
  gateway) DEPLOYMENT="gateway-canary"; STABLE="gateway-stable"; CONTAINER="gateway"; PORT="4000"; HEALTH="/health";;
  reservation) DEPLOYMENT="station-reservation-canary"; STABLE="station-reservation-stable"; CONTAINER="station-reservation"; PORT="4001"; HEALTH="/health";;
  billing) DEPLOYMENT="billing-wallet-canary"; STABLE="billing-wallet-stable"; CONTAINER="billing-wallet"; PORT="4002"; HEALTH="/health";;
  dispatch) DEPLOYMENT="energy-dispatch-canary"; STABLE="energy-dispatch-stable"; CONTAINER="energy-dispatch"; PORT="4003"; HEALTH="/health";;
  *) echo "Unknown service: $SERVICE" >&2; exit 1;;
esac

kubectl -n "$NAMESPACE" set image "deployment/$DEPLOYMENT" "$CONTAINER=$IMAGE"
kubectl -n "$NAMESPACE" scale "deployment/$DEPLOYMENT" --replicas=1
kubectl -n "$NAMESPACE" scale "deployment/$STABLE" --replicas=4
kubectl -n "$NAMESPACE" rollout status "deployment/$DEPLOYMENT" --timeout=120s

LOCAL_PORT="${LOCAL_PORT:-4100}"
kubectl -n "$NAMESPACE" port-forward "deployment/$DEPLOYMENT" "$LOCAL_PORT:$PORT" >/tmp/aegisvolt-canary.log 2>&1 &
PF_PID=$!
trap 'kill "$PF_PID" >/dev/null 2>&1 || true' EXIT
sleep 2

failures=0
for ((i=1; i<=SAMPLES; i++)); do
  status="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$LOCAL_PORT$HEALTH" || echo 000)"
  if [[ "$status" != "200" ]]; then failures=$((failures+1)); fi
  sleep 0.25
done

error_rate=$((failures*100/SAMPLES))
echo "Canary $SERVICE: error rate ${error_rate}% (threshold ${ERROR_THRESHOLD}%)"

if (( error_rate <= ERROR_THRESHOLD )); then
  kubectl -n "$NAMESPACE" set image "deployment/$STABLE" "$CONTAINER=$IMAGE"
  kubectl -n "$NAMESPACE" scale "deployment/$STABLE" --replicas=5
  kubectl -n "$NAMESPACE" scale "deployment/$DEPLOYMENT" --replicas=0
  echo "PROMOTED: $SERVICE 100% stable"
else
  kubectl -n "$NAMESPACE" rollout undo "deployment/$DEPLOYMENT"
  kubectl -n "$NAMESPACE" scale "deployment/$DEPLOYMENT" --replicas=0
  echo "ROLLED BACK: $SERVICE canary removed"
  exit 1
fi
