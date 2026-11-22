# Ice Pack Companion v2.8 — dry-run by default, optional non-secret report export.
[CmdletBinding()]
param([switch]$SaveReport)
$ErrorActionPreference='Stop'
$source = Join-Path $PSScriptRoot 'Get-IcePackMigrationReadiness.ps1'
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'Migration readiness script missing' }
$raw = & $source -AsJson
$report = ($raw | Out-String) | ConvertFrom-Json
if ($report.Schema -ne 1) { throw 'Unsupported readiness report' }
Write-Host 'Ice Pack Companion v2.8 - Installation migration plan'
Write-Host 'Existing installation will remain in place. No files or services will be changed.'
Write-Host 'Installer should preserve: engine credentials, saved targeting, Kits, recovery snapshots and pairing state.'
Write-Host 'Installer should migrate: the saved installation paths only after explicit confirmation.'
Write-Host 'Installer must require services stopped for code installation, and use the existing update rollback system.'
Write-Host "Ready for installer planning: $($report.ReadyForInstallerPlanning)"
if (-not $SaveReport) { Write-Host 'DRY RUN: report not saved. Add -SaveReport to export a non-secret inventory.';return }
$directory = Join-Path $env:LOCALAPPDATA 'IcePackCompanion\migration-reports'
if (-not (Test-Path -LiteralPath $directory -PathType Container)) { [void](New-Item -ItemType Directory -Path $directory -Force) }
if ((Get-Item -LiteralPath $directory -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked report directory refused' }
$filename = 'readiness-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8) + '.json'
$destination=Join-Path $directory $filename
# Report contains paths and component names, but no contents of protected config files.
[IO.File]::WriteAllText($destination,($report | ConvertTo-Json -Depth 7),(New-Object Text.UTF8Encoding($false)))
Write-Host "Non-secret migration inventory saved: $destination"
