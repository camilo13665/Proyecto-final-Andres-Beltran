# Fase 5 – SAGA

## Implementación

- Orquestador: `gateway/src/saga/orchestrator.ts`.
- Mutación GraphQL: `reserveAndActivateCharge`.
- Estados: `STARTED`, `RESERVED`, `CHARGED`, `COMPLETED`, `COMPENSATING`, `COMPENSATED` y `FAILED`.
- Compensation física: reembolso primero y liberación después.
- Reintentos: 3 intentos con backoff para refund y release.
- Idempotencia real: refund y release existentes devuelven el resultado anterior sin duplicar efectos.

## Ejecutar

```powershell
cd d:\aegisvolt-con-contexto\aegisvolt
docker compose up -d
APP_ENV=dev AWS_ENDPOINT_URL=http://localhost:4566 npm run seed --workspace gateway
npm run build --workspace gateway
npm test --workspace gateway
docker compose up -d --build gateway dispatch reservation
```

PowerShell 7 requiere variables como `$env:APP_ENV="dev"` y `$env:AWS_ENDPOINT_URL="http://localhost:4566"`.

## Pruebas unitarias

```powershell
npm test --workspace gateway
```

Resultado esperado: 5 pruebas pasando, incluyendo éxito, fondos insuficientes, fallo físico y reintentos.

## Demostración GraphQL

### Éxito

```graphql
mutation {
  reserveAndActivateCharge(input: {
    fleetId: "fleet-001"
    stationId: "station-001"
    connectorId: "connector-001"
    estimatedKwh: 10
  }) {
    id status failureReason
  }
}
```

Resultado real esperado: `COMPLETED`, conector `IN_USE`, saldo reducido.

### Fondos insuficientes

Usar `estimatedKwh: 1000` y esperar `COMPENSATED`, conector `AVAILABLE` y compensación `RELEASE`.

### Fallo físico

Activar con:

```graphql
mutation {
  setFeatureFlag(name: "SIMULATE_CHARGER_HARDWARE_FAULT", enabled: true) { name enabled }
}
```

Ejecutar la reserva y activar carga. Resultado esperado: `COMPENSATED`, compensaciones `REFUND` y `RELEASE`, saldo restaurado y conector disponible.

Repetir refund y release devuelve `already_refunded: true` y `already_released: true` sin duplicar el efecto.

## Resultado ejecutado

- Compilación del gateway: correcta.
- Pruebas Jest: 5 pasando.
- Éxito real: `COMPLETED`.
- Fondos insuficientes reales: `COMPENSATED` y `RELEASE`.
- Fallo físico real: `COMPENSATED`, `REFUND` y `RELEASE`.
- Repetición de refund: `already_refunded: true`, sin saldo duplicado.
- Repetición de release: `already_released: true`.
- Entorno restaurado a la flag de fallo `false` y datos semilla.

Detener aquí hasta indicar la siguiente fase.
