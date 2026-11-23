param([switch]$SkipBuild, [switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))

$env:AWS_ACCESS_KEY_ID = 'test'
$env:AWS_SECRET_ACCESS_KEY = 'test'
$env:AWS_REGION = 'us-east-1'
$env:AWS_ENDPOINT_URL = 'http://localhost:4566'
$env:APP_ENV = 'dev'

Write-Host '1/5 - Verificando Docker...' -ForegroundColor Cyan
docker info *> $null
if ($LASTEXITCODE -ne 0) { throw 'Docker Desktop no esta activo.' }

Write-Host '2/5 - Levantando Floci y aplicaciones...' -ForegroundColor Cyan
if ($SkipBuild) {
  docker compose up -d
} else {
  docker compose up -d --build
}
if ($LASTEXITCODE -ne 0) { throw 'Docker Compose fallo al levantar el proyecto.' }

Write-Host '3/5 - Esperando Floci...' -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-RestMethod -Uri 'http://localhost:4566/_localstack/health' -TimeoutSec 2 *> $null
    $ready = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $ready) { throw 'Floci no respondio en http://localhost:4566.' }

$terraform = (Get-Command terraform.exe -ErrorAction SilentlyContinue).Source
if (-not $terraform) {
  $fallback = 'C:\Users\cbtub\AppData\Local\Microsoft\WinGet\Packages\Hashicorp.Terraform_Microsoft.Winget.Source_8wekyb3d8bbwe\terraform.exe'
  if (Test-Path $fallback) { $terraform = $fallback }
}
if (-not $terraform) { throw 'Terraform no esta disponible en PATH.' }

Write-Host '4/5 - Aplicando infraestructura dev...' -ForegroundColor Cyan
Push-Location 'infra/bootstrap'
& $terraform init -input=false
& $terraform apply -auto-approve -input=false
Pop-Location

Push-Location 'infra/envs'
& $terraform init -reconfigure -input=false
& $terraform workspace select dev
if ($LASTEXITCODE -ne 0) {
  & $terraform workspace new dev
}
& $terraform apply -auto-approve -input=false -var='enable_vpc_endpoints=false'
Pop-Location

Write-Host '5/5 - Sembrando datos y verificando endpoints...' -ForegroundColor Cyan
npm run seed --workspace gateway
npm run set-flags --workspace gateway

$health = @(
  'http://localhost:4000/health',
  'http://localhost:4001/health',
  'http://localhost:4002/health',
  'http://localhost:4003/health',
  'http://localhost:5173/'
)
foreach ($url in $health) {
  for ($i = 0; $i -lt 30; $i++) {
    try {
      Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing *> $null
      break
    } catch {
      Start-Sleep -Seconds 1
    }
  }
}

Write-Host ''
Write-Host 'AegisVolt listo:' -ForegroundColor Green
Write-Host '  Frontend:  http://localhost:5173'
Write-Host '  GraphQL:   http://localhost:4000/graphql'
Write-Host '  Floci:     http://localhost:4566'

if (-not $NoBrowser) {
  Start-Process 'http://localhost:5173'
}
