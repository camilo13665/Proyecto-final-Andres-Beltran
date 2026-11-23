# Arquitectura AegisVolt (diseño acordado)

## Entorno local (decisión: SIN AWS real)
| Pieza | Implementación | Etiqueta |
|---|---|---|
| S3 (tfstate versionado), DynamoDB, CloudWatch Logs | Floci (http://localhost:4566), creados con Terraform (`infra/`) | Real sobre emulador |
| VPC, subredes, VPCE | Terraform; desplegado solo si Floci lo soporta (`enable_vpc_endpoints`) | Declarado / a verificar |
| API Gateway | Servicio "edge" local delante del GraphQL (NO es API Gateway real) | Simulado |
| EKS | kind (Kubernetes real); un namespace por ambiente: aegisvolt-dev/test/prod | K8s real, EKS simulado |
| Microservicios, GraphQL, SAGA, flags, frontend | Código real | Real |

## Componentes
- frontend (React+Vite) -> edge -> gateway (GraphQL + orquestador SAGA) -> 3 microservicios REST -> DynamoDB.
- GraphQL SOLO en el gateway. Los microservicios exponen REST. Los servicios no se llaman entre sí; solo el orquestador coordina.
- Propagación: el gateway genera `correlation_id` (UUID) y lo envía en la cabecera `x-correlation-id` a cada servicio. El `saga_id` identifica la transacción.
- Cada servicio lee su flag de la tabla flags (caché `FLAG_CACHE_TTL_MS`, por defecto 3000 ms) => cambiar una flag NO requiere redespliegue.
  - ENABLE_DYNAMIC_SURGE_PRICING -> billing (multiplica la tarifa x1.5 en horas pico, p. ej. 17:00-21:00 hora local simulada).
  - ENABLE_FAST_CHARGE_BOOST -> reservation (permite reservar conectores de ultra-carga con prioridad).
  - SIMULATE_CHARGER_HARDWARE_FAULT -> dispatch (la activación falla siempre con CHARGER_FAULT).
- "Tiempo real" del frontend = polling GraphQL cada 3-5 s.

## Variables de entorno comunes
APP_ENV (dev|test|prod), AWS_ENDPOINT_URL, AWS_REGION=us-east-1, AWS_ACCESS_KEY_ID=test, AWS_SECRET_ACCESS_KEY=test,
SERVICE_NAME, PORT, FLAG_CACHE_TTL_MS, LOG_GROUP (=/aegisvolt/<APP_ENV>/<service>). El gateway además: RESERVATION_URL, BILLING_URL, DISPATCH_URL.

## Tablas DynamoDB (todas con pk String + sk String, billing PAY_PER_REQUEST; ya creadas por Terraform)
| Tabla | Items |
|---|---|
| reservations-<env> | `pk=STATION#<id> sk=META` (name, city, connectors count) · `pk=STATION#<id> sk=CONNECTOR#<id>` (status AVAILABLE/RESERVED/IN_USE, type, power_kw, saga_id, fleet_id, lock_expires_at, updated_at) · `pk=SAGA#<saga_id> sk=RESERVATION` (station_id, connector_id, status RESERVED/CONFIRMED/RELEASED) |
| billing-<env> | `pk=FLEET#<id> sk=WALLET` (balance_cents) · `pk=SAGA#<saga_id> sk=CHARGE` (amount_cents, surge_applied) · `pk=SAGA#<saga_id> sk=REFUND` (amount_cents) |
| dispatch-<env> | `pk=SAGA#<saga_id> sk=SESSION` (session_id, status ACTIVE/FAILED/STOPPED, error) · `pk=SESSION#<id> sk=TS#<iso>` (kwh, power_kw) |
| sagas-<env> | `pk=SAGA#<saga_id> sk=META` (status, fleet_id, station_id, connector_id, correlation_id, created_at, updated_at, failure_reason, compensations[]) · `pk=SAGA#<saga_id> sk=EVENT#<iso>#<n>` (step, outcome) |
| flags-<env> | `pk=<FLAG_NAME> sk=CURRENT` (enabled bool, updated_at, updated_by) |
El historial y Prefect usan Scan filtrando `sk = META` (suficiente para la escala del proyecto).
Datos semilla (script `scripts/seed`): 3 estaciones x 4 conectores, billetera de flota `fleet-001` con 50_000 centavos, flags por defecto
(dev: surge=true, boost=true, fault=false · test: surge=true, boost=false, fault=false · prod: surge=false, boost=false, fault=false).

## Contratos REST (todos aceptan/propagan `x-correlation-id`; JSON; errores `{ "error": CODE, "message": "..." }`)
### station-reservation-service (:4001)
- GET /health -> 200 {status:"ok", service, env}
- GET /stations -> estaciones con sus conectores y estado
- GET /stations/:stationId/connectors
- POST /reservations {saga_id, station_id, connector_id, fleet_id} -> 201 {reservation_id, status:"RESERVED"}; mismo saga_id repetido -> 200 con el mismo resultado; conector ocupado por OTRA saga -> 409 CONNECTOR_UNAVAILABLE. Fija lock_expires_at = ahora + 5 min.
- POST /reservations/:saga_id/confirm -> conector IN_USE (cuando la carga está activa)
- POST /reservations/:saga_id/release -> conector AVAILABLE; IDEMPOTENTE (si ya está liberada responde 200 con `already_released:true`)
### billing-wallet-service (:4002)
- GET /health · GET /wallets/:fleetId -> {fleet_id, balance_cents}
- POST /wallets/:fleetId/topup {amount_cents} (soporte para pruebas)
- POST /charges {saga_id, fleet_id, estimated_kwh} -> 201 {amount_cents, surge_applied, balance_cents}; saldo insuficiente -> 402 INSUFFICIENT_FUNDS; saga_id repetido -> 200 mismo resultado sin volver a cobrar. Tarifa base 300 centavos/kWh (x1.5 si surge).
- POST /charges/:saga_id/refund -> reembolsa UNA vez (item REFUND con condición `attribute_not_exists`); repetido -> 200 {already_refunded:true}
- GET /ledger/:fleetId
### energy-dispatch-service (:4003)
- GET /health
- POST /sessions {saga_id, station_id, connector_id, fleet_id} -> 201 {session_id, status:"ACTIVE"}; con flag de fallo -> 502 CHARGER_FAULT (y registra la sesión FAILED); saga_id repetido -> mismo resultado
- GET /sessions/:sessionId · GET /sessions/:sessionId/telemetry
- POST /sessions/:sessionId/telemetry {kwh, power_kw} (también un simulador interno genera lecturas mientras la sesión está ACTIVE)

## Esquema GraphQL (gateway, POST /graphql en :4000)
```graphql
enum SagaStatus { STARTED RESERVED CHARGED COMPLETED COMPENSATING COMPENSATED FAILED }
type Connector { id: ID! stationId: ID! type: String! powerKw: Float! status: String! }
type Station { id: ID! name: String! city: String! connectors: [Connector!]! }
type Wallet { fleetId: ID! balanceCents: Int! }
type TelemetryPoint { timestamp: String! kwh: Float! powerKw: Float! }
type Compensation { step: String! outcome: String! at: String! }
type Saga { id: ID! status: SagaStatus! fleetId: ID! stationId: ID! connectorId: ID! correlationId: ID! failureReason: String createdAt: String! updatedAt: String! compensations: [Compensation!]! }
type FeatureFlag { name: String! enabled: Boolean! updatedAt: String }
type Environment { name: String! flags: [FeatureFlag!]! }
input ReserveAndActivateInput { fleetId: ID! stationId: ID! connectorId: ID! estimatedKwh: Float! }
type Query {
  environment: Environment!
  stations: [Station!]!
  station(id: ID!): Station
  wallet(fleetId: ID!): Wallet!
  telemetry(sessionId: ID!): [TelemetryPoint!]!
  sagas(fleetId: ID, limit: Int = 50): [Saga!]!
  saga(id: ID!): Saga
  featureFlags: [FeatureFlag!]!
}
type Mutation {
  reserveAndActivateCharge(input: ReserveAndActivateInput!): Saga!
  setFeatureFlag(name: String!, enabled: Boolean!): FeatureFlag!
  topUpWallet(fleetId: ID!, amountCents: Int!): Wallet!
}
```

## SAGA por ORQUESTACIÓN (en el gateway, módulo `gateway/src/saga/`)
```
crear saga (STARTED, correlation_id)
1. reservation POST /reservations           -> RESERVED      (falla: saga FAILED, sin compensar)
2. billing     POST /charges                -> CHARGED       (falla: compensar -> release; saga COMPENSATED)
3. dispatch    POST /sessions               -> COMPLETED     (falla: COMPENSATING -> refund -> release; saga COMPENSATED)
   éxito: reservation POST /confirm
```
- Orden de compensación del paso 3: PRIMERO refund (billing), DESPUÉS release (reservation); registrar cada compensación como evento y en `compensations[]`.
- Reintentos de compensación: 3 intentos con backoff; si siguen fallando -> saga FAILED (Prefect la reporta).
- Idempotencia: la clave es `saga_id` (+ operación). Cada servicio usa escrituras condicionales de DynamoDB
  (`attribute_not_exists(pk)` / `ConditionExpression`) y, ante un duplicado, devuelve el resultado ya guardado sin repetir el efecto.
  Billing actualiza saldo + registro de libro con `TransactWriteItems` para que sea atómico.
- Huérfana (para Prefect): saga en STARTED/RESERVED/CHARGED/COMPENSATING cuyo updated_at supera 5 minutos.

## Observabilidad
- Formato de log (una línea JSON por evento): {"timestamp","level","env","service","correlation_id","saga_id","step","message", ...}.
- Salida a stdout (para kubectl logs) Y a CloudWatch Logs (Floci) en el grupo /aegisvolt/<env>/<service> (ya creados por Terraform:
  gateway, station-reservation, billing-wallet, energy-dispatch), un log stream por pod/proceso.
- Prefect (`prefect/flows/`): flujos health_check (3 ambientes), saga_audit (huérfanas y compensadas), metrics_report. Se ejecutan contra Floci y los gateways de cada ambiente.

## Kubernetes y Canary
- kind; namespaces aegisvolt-dev/test/prod; por servicio: Deployment `<svc>-stable`, Deployment `<svc>-canary`, un Service común,
  readiness/liveness en /health, HPA donde aplique. Canary por proporción de réplicas (p. ej. 4 stable + 1 canary = 20%).
- Promoción: verificar health y tasa de errores (logs/CloudWatch) < umbral (p. ej. 5%) durante N minutos; si pasa -> escalar canary a 100% y retirar stable; si no -> rollback (`kubectl rollout undo` / escalar canary a 0).

## CI/CD y Git (GitHub)
- Ramas: dev, test, prod protegidas (script `scripts/protect-branches.sh` con `gh api`). Verificar que el plan del repositorio soporte protección de ramas.
- `.github/workflows/pr-checks.yml`: jobs lint-build, unit-tests, integration-tests (Floci como service container), e2e-tests, terraform-plan (workspace = rama destino `github.base_ref`).
- `.github/workflows/deploy.yml` (on push a dev/test/prod): `terraform workspace select ${{ github.ref_name }}` + `terraform apply -auto-approve` + despliegue Canary.
- Los jobs de despliegue usan un runner self-hosted en la máquina del estudiante para actuar sobre el Floci/kind persistentes (los runners de GitHub no ven localhost). Los checks de PR pueden usar runners de GitHub con Floci efímero.

## Estructura del repositorio
```
aegisvolt/
├── .github/ (copilot-instructions.md, workflows/)
├── docs/ (REQUISITOS.md, ARQUITECTURA.md, PLAN_FASES.md, DECISIONES.md, PLAN_PRUEBAS.md, GUIA_SUSTENTACION.md)
├── infra/ (bootstrap/, envs/, modules/{network,dynamodb,observability})   <- YA EXISTE (Fase 3)
├── services/ (station-reservation-service/, billing-wallet-service/, energy-dispatch-service/)  cada uno: src/, test/, Dockerfile, package.json
├── gateway/ (src/{schema,resolvers,saga,flags}, test/, Dockerfile)
├── frontend/ (React + Vite)
├── k8s/ (base/, overlays/{dev,test,prod})
├── prefect/ (flows/, requirements.txt)
├── scripts/ (seed, protect-branches.sh, demo)
├── tests/ (integration/, e2e/)
├── docker-compose.yml   <- Floci (YA EXISTE)
└── README.md
```
