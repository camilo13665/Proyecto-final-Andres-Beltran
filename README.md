# AegisVolt

Plataforma local de reservas y carga para flotas EV. El proyecto combina un frontend React, un gateway GraphQL, tres microservicios REST, DynamoDB mediante Floci, Terraform, Kubernetes kind y Prefect.

## Estado del entorno

- **Real local:** Docker Compose, React, GraphQL, REST, SAGA, DynamoDB/Floci, Kubernetes kind, Terraform local y Prefect.
- **Simulado:** AWS API Gateway real no está desplegado; se usa un gateway GraphQL local.
- **Simulado:** EKS no está desplegado; se usa kind.
- **No AWS real:** las credenciales son `test/test` y el endpoint predeterminado es `http://localhost:4566`.

## Arquitectura

```text
Frontend React/Vite
        |
        | GraphQL
        v
Gateway GraphQL
        |
        +--> Reservation REST :4001
        +--> Billing REST :4002
        +--> Dispatch REST :4003
                    |
                    v
              DynamoDB/Floci
```

## Requisitos

- Docker Desktop
- Node.js 20 o superior
- npm
- Terraform 1.9 o superior
- kind y kubectl, para Kubernetes local
- Python 3.12 o superior, para Prefect
- PowerShell 5.1 o superior

## Arranque rápido

Iniciar Docker Desktop y ejecutar:

```powershell
cd d:\aegisvolt-con-contexto\aegisvolt
npm run start:aegisvolt
```

El comando levanta Floci, aplica la infraestructura dev, siembra datos y flags, construye o inicia los contenedores y verifica los endpoints.

Detener Docker Compose:

```powershell
npm run stop:aegisvolt
```

## URLs principales

| Servicio | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Gateway health | http://localhost:4000/health |
| Gateway y enlaces | http://localhost:4000/ |
| GraphQL Explorer | http://localhost:4000/graphql |
| Reservation health | http://localhost:4001/health |
| Reservation API | http://localhost:4001/stations |
| Billing health | http://localhost:4002/health |
| Wallet demo | http://localhost:4002/wallets/fleet-001 |
| Dispatch health | http://localhost:4003/health |
| Floci health | http://localhost:4566/_localstack/health |

## Flujo de uso

1. Abrir http://localhost:5173.
2. Seleccionar una estación y un conector.
3. Indicar los kWh estimados.
4. Iniciar la reserva y carga.
5. Consultar el resultado en el historial de SAGAs.
6. Activar o desactivar una Feature Flag desde el panel.
7. Para una carga `COMPLETED`, pulsar `Detener carga` para liberar el conector.

## Demostración SAGA

```powershell
npm run demo
```

La demostración:

- Restablece datos y flags dev.
- Ejecuta una SAGA exitosa.
- Activa el fallo físico.
- Ejecuta una SAGA compensada con reembolso y liberación.
- Restablece las flags.

## GraphQL

Abrir http://localhost:4000/graphql y ejecutar:

```graphql
query {
  stations {
    id
    name
    city
    connectors {
      id
      status
      powerKw
    }
  }
}
```

Consulta de billetera:

```graphql
query {
  wallet(fleetId: "fleet-001") {
    fleetId
    balanceCents
  }
}
```

Detener una carga activa:

```graphql
mutation {
  stopCharge(sagaId: "SAGA_ID") {
    id
    status
    updatedAt
  }
}
```

## SAGA

Cada operación sigue estos pasos:

1. Reserva el conector.
2. Cobra el importe estimado.
3. Intenta activar el despacho físico.
4. Confirma el conector como `IN_USE` ante éxito.

Compensaciones:

- Fondos insuficientes: libera el conector.
- Fallo físico: reembolsa primero y libera después.
- Repetir refund o release no duplica efectos.

## Feature Flags

- `ENABLE_DYNAMIC_SURGE_PRICING`: aplica un multiplicador x1.5 entre 17:00 y 21:00.
- `ENABLE_FAST_CHARGE_BOOST`: controla conectores rápidos DC.
- `SIMULATE_CHARGER_HARDWARE_FAULT`: fuerza `CHARGER_FAULT` sin reiniciar servicios.

La caché predeterminada es de 3000 ms.

## Pruebas

```powershell
npm run build
npm test
npm run test:integration
npm run test:e2e
npm run demo
```

La suite incluye pruebas unitarias de gateway y servicios, integración GraphQL/REST y pruebas Playwright del frontend.

## Terraform

La infraestructura se encuentra en `infra/`:

- `bootstrap/`: bucket S3/Tfstate.
- `envs/`: workspaces dev/test/prod.
- `modules/dynamodb/`: tablas DynamoDB.
- `modules/network/`: VPC y subredes.
- `modules/observability/`: grupos CloudWatch.

Ejemplo dev:

```powershell
cd infra/envs
terraform init -reconfigure
terraform workspace select dev
terraform apply -auto-approve -var="enable_vpc_endpoints=false"
```

## Kubernetes kind

Crear el clúster local:

```powershell
.\scripts\setup-kind.ps1
```

Comprobar despliegue:

```powershell
kubectl -n aegisvolt-dev get pods
kubectl -n aegisvolt-dev get deployments
kubectl -n aegisvolt-dev get services
```

Promoción canary:

```powershell
.\scripts\canary.ps1 -Service gateway -Image aegisvolt-gateway:latest
```

El script mide `/health` y promueve si el porcentaje de error es menor o igual al 5%; de lo contrario revierte.

## Prefect

Crear el entorno Python:

```powershell
uv venv .venv --python 3.14
uv pip install --python .venv\Scripts\python.exe -r prefect\requirements.txt
```

Ejecutar flows:

```powershell
$env:AWS_ENDPOINT_URL="http://localhost:4566"
$env:AWS_REGION="us-east-1"
$env:AWS_ACCESS_KEY_ID="test"
$env:AWS_SECRET_ACCESS_KEY="test"

.venv\Scripts\python.exe prefect\flows\health_check.py
.venv\Scripts\python.exe prefect\flows\saga_audit.py
.venv\Scripts\python.exe prefect\flows\metrics_report.py
```

## Documentación

- [Arquitectura](docs/ARQUITECTURA.md)
- [Fase 4: Backend](docs/FASE4.md)
- [Fase 5: SAGA](docs/FASE5.md)
- [Fase 6: Feature Flags](docs/FASE6.md)
- [Fase 7: Frontend](docs/FASE7.md)
- [Fase 8: Kubernetes](docs/FASE8.md)
- [Fase 9: CI/CD](docs/FASE9.md)
- [Fase 10: Observabilidad](docs/FASE10.md)
- [Fase 11: Pruebas](docs/FASE11.md)

## Apagar todo

```powershell
npm run stop:aegisvolt
kind delete cluster --name aegisvolt
docker desktop stop
```
