# Fase 8 – Docker y Kubernetes

## Implementación

- Kind clúster local: `aegisvolt`.
- Namespace base de Kustomize: `aegisvolt-dev`.
- Overlays: `k8s/overlays/dev`, `test` y `prod`.
- Stable + canary para reservation, billing, dispatch y gateway.
- Services comunes que enrutan stable y canary.
- Readiness y liveness probes en `/health`.
- HPA de 4 a 8 réplicas por servicio estable.
- ConfigMap derivado por ambiente.
- Script `scripts/setup-kind.ps1` para Windows y `scripts/setup-kind.sh` para Bash.
- Scripts canary Bash y PowerShell: `scripts/canary.sh` y `scripts/canary.ps1`.

## Crear y desplegar

```powershell
cd d:\aegisvolt-con-contexto\aegisvolt
.\scripts\setup-kind.ps1
kubectl config use-context kind-aegisvolt
kubectl -n aegisvolt-dev get pods
kubectl -n aegisvolt-dev get hpa
```

## Promoción canary

```powershell
.\scripts\canary.ps1 -Service gateway -Image aegisvolt-gateway:latest
```

Criterio: 20 muestras de `/health`; error rate menor o igual al 5% promueve el canary; si supera el 5%, revierte y elimina el canary.

## Port-forward para pruebas

```powershell
kubectl -n aegisvolt-dev port-forward service/gateway 4100:4000
Invoke-RestMethod http://127.0.0.1:4100/health
```

## Resultado ejecutado

- Kind 0.33.0 instalado y clúster `aegisvolt` creado con Kubernetes 1.37.
- Kustomize renderizó correctamente el overlay `dev`.
- Cuatro servicios y sus canaries quedaron activos en `aegisvolt-dev`.
- Cuatro stable Deployments quedaron con 4 réplicas y 4 canaries con 1 réplica.
- Gateway respondió `status=ok` mediante el Service y port-forward.
- HPA creado para gateway, reservation, billing y dispatch.
- Canary gateway de prueba obtuvo 0% de errores y fue promovido a stable.
- Tras reaplicar Kustomize, el canary gateway fue retirado manualmente dejando el stable al 100%.

Nota: los HPAs usan CPU pero Kind no incluye metrics-server por defecto; el estado `cpu: <unknown>/70%` requiere instalar metrics-server para activar mediciones reales. El gateway, los servicios y el canary sí están ejecutándose.

Detener aquí hasta indicar la siguiente fase.
