# Fase 4 – Microservicios y GraphQL

## Estado

Implementada la estructura backend de la fase 4:

- `station-reservation-service` en el puerto 4001
- `billing-wallet-service` en el puerto 4002
- `energy-dispatch-service` en el puerto 4003
- Gateway Apollo/GraphQL en el puerto 4000
- Script de datos semilla en `gateway/scripts/seed.ts`
- Dockerfiles multi-stage y servicios añadidos a `docker-compose.yml`

La mutación `reserveAndActivateCharge` queda definida en el esquema y se implementará en la Fase 5. No es una simulación del backend: la fase 4 usa REST real y DynamoDB/Floci.

## Ejecutar

```powershell
cd d:\aegisvolt-con-contexto\aegisvolt
docker compose up -d
npm install
APP_ENV=dev npm run seed --workspace gateway
npm run dev --workspace gateway
npm run dev --workspace @aegisvolt/station-reservation-service
npm run dev --workspace @aegisvolt/billing-wallet-service
npm run dev --workspace @aegisvolt/energy-dispatch-service
```

Floci debe estar disponible en `http://localhost:4566` y las tablas deben haber sido creadas con Terraform para el workspace `dev`.

## Consultar

```text
POST http://localhost:4000/graphql

{
  stations {
    id
    name
    city
    connectors { id type powerKw status }
  }
}
```

```text
{
  wallet(fleetId: "fleet-001") {
    fleetId
    balanceCents
  }
}
```

## Validar

```powershell
npm run build
npm test
docker compose config --quiet
```

Resultado esperado:

- Todos los paquetes TypeScript compilan.
- Las pruebas Jest pasan.
- Docker Compose devuelve una configuración válida.
- Con Floci y las tablas de Terraform, `stations` y `wallet` leen datos reales creados por el seed.

## Resultado ejecutado

- Docker Desktop activo y motor Linux disponible.
- `docker compose build`: correcto; las cuatro imágenes se construyeron.
- `docker compose up -d`: correcto; Floci y los cuatro servicios están activos.
- Terraform instalado; bootstrap creó `aegisvolt-tfstate` con versionado habilitado.
- Workspace `dev` aplicado con `enable_vpc_endpoints=false`; creadas las cinco tablas DynamoDB dev.
- Seed ejecutado con 3 estaciones, 12 conectores, wallet de 50.000 centavos y 3 flags.
- `npm run build`: correcto.
- `npm test`: correcto, 7 pruebas en total.
- `docker compose ps`: los cinco contenedores están activos.
- GraphQL `stations`: devuelve las tres estaciones y sus conectores reales.
- GraphQL `wallet`: devuelve `fleet-001` con 50.000 centavos.
- GraphQL `featureFlags`: devuelve las tres flags con sus valores dev.

La mutación `reserveAndActivateCharge` no se implementa hasta la Fase 5, conforme al plan de trabajo.

Detener aquí hasta indicar la siguiente fase.
