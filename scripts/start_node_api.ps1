param([string] = '.env')
Push-Location $PSScriptRoot\..\nodejs
if (Test-Path ) { Copy-Item  .env -Force }
Write-Host 'Starting API on http://localhost:3000'
npm run dev
