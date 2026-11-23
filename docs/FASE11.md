# Fase 11 – Pruebas y validación

## Plan

El plan completo se encuentra en `docs/PLAN_PRUEBAS.md`.

## Pruebas disponibles

```powershell
npm test
npm run test:integration
npm run test:e2e
npm run demo
```

## Integración

Las pruebas usan DynamoDB/Floci y los servicios reales mediante GraphQL y REST:

- Consulta GraphQL de estaciones.
- Consulta GraphQL de billetera.
- Health de reservation.
- Health de billing.
- Health de dispatch.

## E2E Playwright

Las pruebas abren el frontend real en `http://localhost:5173` y verifican:

- Carga de estaciones y dashboard.
- Visibilidad de billetera, flags e historial.
- Activación/desactivación de la flag de hardware desde la UI.

## Demo

`npm run demo` ejecuta en PowerShell:

1. Seed de datos dev.
2. SAGA exitosa.
3. Activación de `SIMULATE_CHARGER_HARDWARE_FAULT`.
4. Espera del TTL para que el servicio despacho lea la nueva flag.
5. SAGA compensada con refund y release.
6. Restauración de las flags dev.

## Resultado ejecutado

- Compilación completa: correcta.
- Pruebas unitarias: 13 pasando.
- Integración: 5 pasando.
- Playwright: 2 pasando con Chromium instalado.
- Demo real: éxito `COMPLETED` seguido de fallo físico `COMPENSATED` con `REFUND` y `RELEASE`.
- Flags restauradas al final de la demo.

## Resultado pendiente

- Verificación completa de aislamiento test/prod, CI/CD remoto, Redistribución S3 y runbook de recuperación de estado requieren los repositorios y credenciales externos correspondientes.

Detener aquí hasta indicar la siguiente fase.
