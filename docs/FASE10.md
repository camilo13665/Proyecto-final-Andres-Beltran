# Fase 10 – Observabilidad

## Implementación

- Logs JSON de una línea en gateway y los tres microservicios.
- Campos: `timestamp`, `level`, `env`, `service`, `correlation_id`, `saga_id`, `step`, `message`.
- Publicación stdout y CloudWatch Logs (Floci) en:
  - `/aegisvolt/<env>/gateway`
  - `/aegisvolt/<env>/station-reservation`
  - `/aegisvolt/<env>/billing-wallet`
  - `/aegisvolt/<env>/energy-dispatch`
- Prefect flows:
  - `prefect/flows/health_check.py`
  - `prefect/flows/saga_audit.py`
  - `prefect/flows/metrics_report.py`

## Ejecutar Prefect

```powershell
cd d:\aegisvolt-con-contexto\aegisvolt
uv venv .venv --python 3.14
uv pip install --python .venv\Scripts\python.exe -r prefect\requirements.txt

$env:AWS_ENDPOINT_URL="http://localhost:4566"
$env:AWS_REGION="us-east-1"
$env:AWS_ACCESS_KEY_ID="test"
$env:AWS_SECRET_ACCESS_KEY="test"

.venv\Scripts\python.exe prefect\flows\health_check.py
.venv\Scripts\python.exe prefect\flows\saga_audit.py
.venv\Scripts\python.exe prefect\flows\metrics_report.py
```

Servidor Prefect local temporal: Prefect inicia el servidor en `http://127.0.0.1:8129` y lo detiene al terminar el flujo.

## Verificar CloudWatch Logs

```powershell
node -e "const {CloudWatchLogsClient,DescribeLogStreamsCommand}=require('@aws-sdk/client-cloudwatch-logs');const c=new CloudWatchLogsClient({region:'us-east-1',endpoint:'http://localhost:4566',credentials:{accessKeyId:'test',secretAccessKey:'test'}});(async()=>{for(const s of ['gateway','station-reservation','billing-wallet','energy-dispatch']){const r=await c.send(new DescribeLogStreamsCommand({logGroupName:'/aegisvolt/dev/'+s,limit:5}));console.log(s,(r.logStreams||[]).map(x=>x.logStreamName))}})()"
```

## Resultado ejecutado

- TypeScript compiló correctamente con los clientes CloudWatch Logs.
- Contenedores gateway, reservation, billing y dispatch reconstruidos con logging CloudWatch.
- Se encontraron log streams reales en los cuatro grupos `/aegisvolt/dev/<servicio>`.
- Prefect 3.9.4 instalado en `.venv`.
- `health_check`: 3 checks dev/test/prod completados como OK.
- `saga_audit`: completado contra DynamoDB dev/test/prod.
- `metrics_report`: completado contra DynamoDB dev/test/prod.

Nota: el servidor temporal de Prefect fue ejecutado localmente y no se dejó como daemon persistente.

Detener aquí hasta indicar la siguiente fase.
