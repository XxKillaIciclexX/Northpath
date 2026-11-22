$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$settings = Get-IcePackSettings
Set-Location -LiteralPath $settings.enginePath
Write-Host 'Starting ARK engine with private .env (not displayed).' -ForegroundColor Cyan
& node --env-file=.env server.mjs
