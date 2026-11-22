# v0.9: one command starts missing services without enabling live gift processing.
[CmdletBinding()]
param([switch]$CheckOnly, [switch]$OpenDashboard)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$settings = Get-IcePackSettings
Assert-IcePackFiles $settings
Write-Host 'Ice Pack Companion v1.3 - protected local launcher' -ForegroundColor Cyan
Write-Host 'No Live activation; existing listeners are never killed.'
$services = @(
    @{Name='ARK Engine';Port=3210;Script='Run-Engine.ps1'},
    @{Name='Local Bridge';Port=3212;Script='Run-Bridge.ps1'},
    @{Name='Northpath Dashboard';Port=5173;Script='Run-Dashboard.ps1'}
)
foreach ($svc in $services) {
    $port = [int]$svc.Port
    if (Test-IcePackPort $port) {
        Write-Host "[$port] $($svc.Name): listener already present; skipping." -ForegroundColor Yellow
        continue
    }
    if ($CheckOnly) {
        Write-Host "[$port] $($svc.Name): would start." -ForegroundColor Yellow
        continue
    }
    if ($port -eq 3210) {
        # Before a cold engine start, protect current settings and Kit rules.
        # Never back up in -CheckOnly mode, and never enable Live.
        $autoBackup = Join-Path $PSScriptRoot 'AutoBackup-IcePackConfiguration.ps1'
        if (-not (Test-Path -LiteralPath $autoBackup -PathType Leaf)) { throw "Missing protection script: $autoBackup" }
        & $autoBackup
    }
    $runner = Join-Path $PSScriptRoot $svc.Script
    if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw "Missing runner: $runner" }
    # Child terminals remain visible, particularly to show the bridge pairing token.
    $arg = @('-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-File',('"' + $runner + '"'))
    Start-Process -FilePath 'powershell.exe' -ArgumentList $arg -WorkingDirectory $settings.repoPath | Out-Null
    Write-Host "[$port] $($svc.Name): terminal opened." -ForegroundColor Green
    Start-Sleep -Milliseconds 900
}
if ($CheckOnly) { Write-Host 'Check-only: no services started.' -ForegroundColor Cyan; return }
if ($OpenDashboard) {
    Start-Sleep -Seconds 2
    Start-Process 'http://127.0.0.1:5173/'
}
Write-Host 'Dashboard: http://127.0.0.1:5173/' -ForegroundColor Cyan
Write-Host 'Enter the NEW pairing token shown in the bridge terminal. Never share it.'
Write-Host 'Run scripts\Test-IcePackCompanion.ps1 for service checks.'
