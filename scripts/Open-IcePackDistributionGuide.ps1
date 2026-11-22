# v3.0 Alpha: quick access to the installed setup and update tools, no writes.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
Write-Host 'Ice Pack Companion v3.0 Alpha - Distribution Guide'
& (Join-Path $PSScriptRoot 'Get-IcePackDistributionStatus.ps1')
Write-Host ''
Write-Host 'Use the existing Control Center to start/stop Companion.'
Write-Host 'Use the existing Update Manager for validated code installs and rollback.'
Write-Host 'Use the Guided Installer for prerequisite and migration checks.'
Write-Host 'No Live mode, RCON, or migration steps have been performed.'
