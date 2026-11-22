# Ice Pack Companion v1.3 - snapshot changed configuration before a cold engine start.
# Existing v1.2 backups and manual restore workflow stay authoritative.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'IcePack-ConfigCommon.ps1')

$layout = Get-BackupLayout
$available = @($layout.Files | Where-Object { Test-Path -LiteralPath $_.Path -PathType Leaf })
if ($available.Count -eq 0) { throw 'No configuration files found. Startup snapshot cannot be created.' }
# Reject corrupted JSON before starting the engine.
foreach ($entry in $available) { Assert-ConfigFile $entry.Path }

$signatureLines = @($available | Sort-Object Key | ForEach-Object { "{0}:{1}" -f $_.Key, (Get-FileHashText $_.Path) })
$signature = $signatureLines -join "`n"
$marker = Join-Path (Split-Path -Parent (Get-IcePackConfigPath)) 'last-auto-backup.json'
$alreadyProtected = $false
if (Test-Path -LiteralPath $marker -PathType Leaf) {
    try {
        $last = Get-Content -LiteralPath $marker -Raw -Encoding UTF8 | ConvertFrom-Json
        $snapshotDir = Join-Path $layout.Root ([string]$last.snapshot)
        # A missing backup forces a fresh snapshot, even when hashes match.
        if ($last.signature -ceq $signature -and (Test-Path -LiteralPath (Join-Path $snapshotDir 'manifest.json') -PathType Leaf)) {
            $alreadyProtected = $true
        }
    } catch { Write-Warning 'Last-backup marker unreadable; creating a fresh snapshot.' }
}
if ($alreadyProtected) {
    Write-Host 'Auto-backup: configuration unchanged since the last protected startup; skipping duplicate snapshot.' -ForegroundColor Cyan
    return
}

Write-Host 'Auto-backup: configuration changed or not yet protected; creating snapshot...' -ForegroundColor Cyan
# Call the tested v1.2 backup implementation in this process. If it fails, startup fails closed.
& (Join-Path $PSScriptRoot 'Backup-IcePackConfiguration.ps1')
# Locate the new snapshot, and verify it covers exactly the current known configuration hashes.
$matching = @(
    Get-ChildItem -LiteralPath $layout.Root -Directory |
    Where-Object { $_.Name -match '^\d{8}-\d{6}-[0-9a-f]{8}$' } |
    Sort-Object CreationTimeUtc -Descending
)
$snapshotName = $null
foreach ($directory in $matching) {
    $manifestPath = Join-Path $directory.FullName 'manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { continue }
    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $entries = @($manifest.entries)
        if ($manifest.format -ne 'icepack-config-backup' -or $manifest.version -ne 1 -or $entries.Count -ne $available.Count) { continue }
        $ok = $true
        foreach ($entry in $available) {
            $found = @($entries | Where-Object { $_.key -eq $entry.Key })
            if ($found.Count -ne 1 -or ([string]$found[0].sha256) -cne (Get-FileHashText $entry.Path)) { $ok = $false; break }
            $copyPath = Join-Path $directory.FullName ("$($entry.Key).json")
            if (-not (Test-Path -LiteralPath $copyPath -PathType Leaf) -or (Get-FileHashText $copyPath) -cne (Get-FileHashText $entry.Path)) { $ok = $false; break }
        }
        if ($ok) { $snapshotName = $directory.Name; break }
    } catch { continue }
}
if (-not $snapshotName) { throw 'Backup command returned, but no matching verified snapshot was found. Engine startup aborted.' }
$markerData = [ordered]@{ version=1; signature=$signature; snapshot=$snapshotName; verifiedUtc=(Get-Date).ToUniversalTime().ToString('o') }
$markerParent = Split-Path -Parent $marker
New-Item -ItemType Directory -Path $markerParent -Force | Out-Null
$markerTmp = "$marker.tmp.$([guid]::NewGuid().ToString('N'))"
try {
    $markerData | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $markerTmp -Encoding UTF8
    Move-Item -LiteralPath $markerTmp -Destination $marker -Force
} finally { if (Test-Path -LiteralPath $markerTmp) { Remove-Item -LiteralPath $markerTmp -Force } }
Write-Host "Auto-backup verified: $snapshotName" -ForegroundColor Green
