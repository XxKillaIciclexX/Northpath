$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$settings = Get-IcePackSettings
$env:ICEPACK_KIT_DIR = $settings.kitDir
Set-Location -LiteralPath (Join-Path $settings.repoPath 'companion')
Write-Host 'Starting bridge locally. Pairing token below is SECRET.' -ForegroundColor Cyan
& node .\agent-bridge\bridge.mjs
