# Fase 7 – Frontend

## Implementación

- Aplicación React + Vite en `frontend/`.
- Todas las consultas y mutaciones usan GraphQL en `VITE_GRAPHQL_URL`, por defecto `http://localhost:4000/graphql`.
- Entorno visible mediante `VITE_APP_ENV`, por defecto `dev`.
- Polling de estaciones, wallet, flags e historial cada 4 segundos.
- Formulario de reserva y activación de carga.
- Panel de Feature Flags con toggles sin redespliegue.
- Banner y color por ambiente dev/test/prod.
- Historial de SAGAs con estado y compensaciones.
- Contenedor Docker servido por nginx en el puerto 5173.

## Ejecutar

```powershell
cd d:\aegisvolt-con-contexto\aegisvolt
docker compose up -d
npm run build --workspace frontend
Start-Process http://localhost:5173
```

Variables:

```text
VITE_GRAPHQL_URL=http://localhost:4000/graphql
VITE_APP_ENV=dev
```

## Demostración

1. Abrir `http://localhost:5173`.
2. Verificar estaciones, conectores, billetera, flags e historial.
3. Seleccionar un conector disponible y ejecutar la carga.
4. Confirmar `COMPLETED` o el resultado de compensación correspondiente.
5. Activar `SIMULATE_CHARGER_HARDWARE_FAULT` desde el panel.
6. Ejecutar otra carga y confirmar `COMPENSATED` con `REFUND` y `RELEASE`.

## Resultado ejecutado

- Frontend compilado con `npm run build --workspace frontend`.
- Contenedor frontend creado y activo en el puerto 5173.
- GraphQL real mostrado en el navegador: estaciones, billetera, flags e historial.
- Carga exitosa desde la UI: `COMPLETED` y wallet reducida.
- Flag de fallo activada desde la UI sin reiniciar contenedores.
- Carga fallida desde la UI: `COMPENSATED`, con `REFUND` y `RELEASE` visibles.
- Flag restaurada a `false` y entorno dev dejado estable.

Detener aquí hasta indicar la siguiente fase.
