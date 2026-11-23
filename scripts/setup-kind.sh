#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CLUSTER_NAME="${AEGISVOLT_KIND_CLUSTER:-aegisvolt}"

kind create cluster --name "$CLUSTER_NAME" --config "$ROOT_DIR/k8s/kind-config.yaml"

for image in \
  aegisvolt-reservation:latest \
  aegisvolt-billing:latest \
  aegisvolt-dispatch:latest \
  aegisvolt-gateway:latest \
  aegisvolt-frontend:latest
do
  kind load docker-image --name "$CLUSTER_NAME" "$image"
done

kubectl apply -k "$ROOT_DIR/k8s/overlays/dev"
kubectl -n aegisvolt-dev rollout status deployment/station-reservation-stable --timeout=120s
kubectl -n aegisvolt-dev rollout status deployment/billing-wallet-stable --timeout=120s
kubectl -n aegisvolt-dev rollout status deployment/energy-dispatch-stable --timeout=120s
kubectl -n aegisvolt-dev rollout status deployment/gateway-stable --timeout=120s

echo "Kind cluster '$CLUSTER_NAME' is ready in namespace aegisvolt-dev"
