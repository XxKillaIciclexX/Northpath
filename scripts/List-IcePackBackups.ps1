# Ice Pack Companion v1.2 - list snapshots without reading credentials.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'IcePack-ConfigCommon.ps1')
$layout = Get-BackupLayout
if (-not (Test-Path -LiteralPath $layout.Root -PathType Container)) {
    Write-Host 'No snapshots yet. Run Backup-IcePackConfiguration.ps1.'
    exit 0
}
Get-ChildItem -LiteralPath $layout.Root -Directory |
    Where-Object { $_.Name -match '^\d{8}-\d{6}-[0-9a-f]{8}$' } |
    Sort-Object Name -Descending |
    ForEach-Object { [pscustomobject]@{ Snapshot=$_.Name; Created=$_.CreationTime; Path=$_.FullName } } |
    Format-Table -AutoSize
