# Version-aware local update with preflight, SHA-256 verification, rollback snapshot, and dry-run default.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$PackagePath,[switch]$Apply)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-UpdateCommon.ps1')
$repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$package=(Resolve-Path -LiteralPath $PackagePath).ProviderPath
if ($repo -eq $package -or $package.StartsWith($repo+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Extract the update OUTSIDE the Northpath repository.' }
$manifest=Read-IcePackManifest $package $repo
Write-Host "Ice Pack Companion local update v$($manifest.version)"
foreach ($item in $manifest.files) {
    $action=if(Test-Path -LiteralPath $item.destination -PathType Leaf){'REPLACE'}else{'ADD'}
    Write-Host "  $action $($item.path) (verified SHA-256)"
}
if (-not $Apply) { Write-Host 'DRY RUN ONLY. No files changed. Rerun with -Apply after stopping Companion.';exit 0 }
$lock=Enter-IcePackUpdateLock
try {
    Assert-IcePackServicesStopped
    $manifest=Read-IcePackManifest $package $repo # revalidate under lock
    $stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
    $id="$stamp-$([guid]::NewGuid().ToString('N').Substring(0,8))"
    $dir=Join-Path $script:IcePackUpdateRoot $id
    $backup=Join-Path $dir 'previous'
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    $records=@()
    foreach ($item in $manifest.files) {
        $exists=Test-Path -LiteralPath $item.destination -PathType Leaf
        $oldHash=$null
        if ($exists) {
            $oldHash=(Get-FileHash -LiteralPath $item.destination -Algorithm SHA256).Hash.ToLowerInvariant()
            $oldPath=Join-Path $backup ($item.path.Replace('/',[IO.Path]::DirectorySeparatorChar))
            New-Item -ItemType Directory -Path (Split-Path -Parent $oldPath) -Force | Out-Null
            Copy-Item -LiteralPath $item.destination -Destination $oldPath -ErrorAction Stop
            if ((Get-FileHash -LiteralPath $oldPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $oldHash) { throw "Backup verification failed for $($item.path)" }
        }
        $records+= [pscustomobject]@{path=$item.path;existed=$exists;oldHash=$oldHash;newHash=$item.sha256}
    }
    $metadata=[pscustomobject]@{schema=1;id=$id;version=$manifest.version;state='prepared';files=$records}
    $metaPath=Join-Path $dir 'record.json'
    [IO.File]::WriteAllText($metaPath,($metadata|ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
    $metadata.state='applying'
    [IO.File]::WriteAllText($metaPath,($metadata|ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
    try {
        foreach ($item in $manifest.files) {
            New-Item -ItemType Directory -Path (Split-Path -Parent $item.destination) -Force | Out-Null
            Assert-IcePackPlainPath $repo $item.path
            Copy-Item -LiteralPath $item.source -Destination $item.destination -Force
            if ((Get-FileHash -LiteralPath $item.destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256) { throw "Post-copy verification failed: $($item.path)" }
        }
        $metadata.state='installed'
        [IO.File]::WriteAllText($metaPath,($metadata|ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
        Write-Host "Installed v$($manifest.version). Rollback ID: $id"
    } catch {
        $original=$_.Exception.Message
        $reverted=$true
        foreach ($r in $records) {
            $dest=Join-Path $repo ($r.path.Replace('/',[IO.Path]::DirectorySeparatorChar))
            try {
                if($r.existed){Copy-Item -LiteralPath (Join-Path $backup ($r.path.Replace('/',[IO.Path]::DirectorySeparatorChar))) -Destination $dest -Force}
                elseif(Test-Path -LiteralPath $dest){Remove-Item -LiteralPath $dest -Force}
            } catch {$reverted=$false}
        }
        $metadata.state=if($reverted){'reverted-after-failure'}else{'recovery-required'}
        [IO.File]::WriteAllText($metaPath,($metadata|ConvertTo-Json -Depth 8), (New-Object Text.UTF8Encoding($false)))
        throw "Update failed: $original. Rollback status: $($metadata.state). ID: $id"
    }
} finally {$lock.Dispose()}
