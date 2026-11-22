$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$settings = Get-IcePackSettings
Set-Location -LiteralPath (Join-Path $settings.repoPath 'companion')
Write-Host 'Starting local dashboard at 127.0.0.1:5173.' -ForegroundColor Cyan
& npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
