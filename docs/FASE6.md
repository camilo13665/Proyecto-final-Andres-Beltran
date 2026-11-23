# Fase 6 – Feature Flags

## Implementación

- Cliente cacheado con TTL: `gateway/src/flags/flag-client.ts`.
- Clientes independientes copiados por los tres microservicios: `src/flags.ts`.
- Caché configurada con `FLAG_CACHE_TTL_MS`, por defecto 3000 ms.
- `setFeatureFlag` escribe en DynamoDB e invalida la caché del gateway.
- `SIMULATE_CHARGER_HARDWARE_FAULT` afecta a despacho sin reiniciar contenedores.
- `ENABLE_DYNAMIC_SURGE_PRICING` aplica 1.5x entre las 17:00 y las 21:00 en el servicio billing.
- `ENABLE_FAST_CHARGE_BOOST` controla la reserva de conectores de 150 kW.
- Script por ambiente: `gateway/scripts/set-flags.ts`.

## Ejecutar

```powershell
cd d:\aegisvolt-con-contexto\aegisvolt
docker compose up -d
npm run build
npm test
$env:APP_ENV="dev"
$env:AWS_ENDPOINT_URL="http://localhost:4566"
$env:AWS_REGION="us-east-1"
$env:AWS_ACCESS_KEY_ID="test"
$env:AWS_SECRET_ACCESS_KEY="test"
npm run set-flags --workspace gateway
docker compose up -d --build gateway reservation billing dispatch
```

## Activar el fallo sin reiniciar

```graphql
mutation {
  setFeatureFlag(name: "SIMULATE_CHARGER_HARDWARE_FAULT", enabled: true) {
    name enabled
  }
}
```

La siguiente mutación `reserveAndActivateCharge` debe quedar `COMPENSATED` con `REFUND` y `RELEASE`.

## Consultar flags

```graphql
query { featureFlags { name enabled updatedAt } }
```

## Resultado ejecutado

- Compilación completa: correcta.
- Pruebas: 13 pasando en todos los paquetes.
- Contenedores gateway, reservation, billing y dispatch reconstruidos y activos.
- Script de defaults aplicado: dev usa surge=true, boost=true, fault=false.
- Mutación `setFeatureFlag` activó el fallo físico sin reiniciar los servicios.
- La siguiente carga quedó `COMPENSATED` con `REFUND` y `RELEASE`.
- Entorno dev restaurado a sus valores por defecto y GraphQL muestra las tres flags.

Detener aquí hasta indicar la siguiente fase.
