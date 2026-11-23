Set-Location (Resolve-Path (Join-Path $PSScriptRoot '..'))
docker compose down
Write-Host 'AegisVolt detenido.' -ForegroundColor Green
