$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Running Kinto E2E..." -ForegroundColor Cyan
Write-Host "Make sure both servers are already running:" -ForegroundColor Yellow
Write-Host "  npm run py:dev" -ForegroundColor Yellow
Write-Host "  npm run dev" -ForegroundColor Yellow
Write-Host ""

npm run e2e:full
