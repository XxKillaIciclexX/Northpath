# Ice Pack Companion v1.2 - restore a verified snapshot with automatic pre-restore safety copy.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][string]$Snapshot,
    [switch]$ConfirmRestore
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'IcePack-ConfigCommon.ps1')
$layout = Get-BackupLayout
$name = Get-SafeSnapshotName $Snapshot
$dir = Join-Path $layout.Root $name
if (-not (Test-Path -LiteralPath $dir -PathType Container)) { throw "Snapshot not found: $name" }
$manifestPath = Join-Path $dir 'manifest.json'
Assert-ConfigFile $manifestPath
$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.format -ne 'icepack-config-backup' -or $manifest.version -ne 1) { throw 'Unsupported snapshot format' }
$entries = @($manifest.entries)
if ($entries.Count -lt 1 -or $entries.Count -gt 2) { throw 'Invalid snapshot entry count' }
$targets = @()
$seen = @{}
foreach ($entry in $entries) {
    $key = [string]$entry.key
    if ($seen.ContainsKey($key)) { throw 'Duplicate snapshot entry' }
    $seen[$key] = $true
    $target = @($layout.Files | Where-Object { $_.Key -eq $key })
    if ($target.Count -ne 1 -or [string]$entry.filename -cne "$key.json") { throw "Unknown snapshot entry: $key" }
    $source = Join-Path $dir ([string]$entry.filename)
    Assert-ConfigFile $source
    $digest = Get-FileHashText $source
    if ($digest -cne [string]$entry.sha256) { throw "Snapshot integrity check failed: $key" }
    $targets += [pscustomobject]@{ key=$key; from=$source; to=$target[0].Path }
}
Assert-EngineStopped
Write-Host "Verified snapshot: $name" -ForegroundColor Cyan
foreach ($target in $targets) { Write-Host "  $($target.key) -> $($target.to)" }
if (-not $ConfirmRestore) {
    Write-Host 'DRY RUN ONLY. Nothing was restored.' -ForegroundColor Yellow
    Write-Host "To restore, stop the engine and run again with -ConfirmRestore."
    exit 0
}
# Always save a recovery snapshot of all currently available configs before overwriting.
Write-Host 'Creating safety backup of current configuration...'
& (Join-Path $PSScriptRoot 'Backup-IcePackConfiguration.ps1')
# Stage all replacements before writing any originals.
$staged = @()
try {
    foreach ($target in $targets) {
        $parent = Split-Path -Parent $target.to
        if (-not (Test-Path -LiteralPath $parent -PathType Container)) { throw "Destination directory missing: $parent" }
        $temp = Join-Path $parent ('.icepack-restore-'+[guid]::NewGuid().ToString('N')+'.tmp')
        Copy-Item -LiteralPath $target.from -Destination $temp -ErrorAction Stop
        Assert-ConfigFile $temp
        $staged += [pscustomobject]@{ temp=$temp; dest=$target.to; key=$target.key }
    }
    foreach ($entry in $staged) {
        Move-Item -LiteralPath $entry.temp -Destination $entry.dest -Force -ErrorAction Stop
        Write-Host "Restored: $($entry.key)" -ForegroundColor Green
    }
} finally {
    foreach ($entry in $staged) { if (Test-Path -LiteralPath $entry.temp) { Remove-Item -LiteralPath $entry.temp -Force } }
}
Write-Host 'Restore completed. Start the engine; Preview and Live modes must be enabled separately.'
