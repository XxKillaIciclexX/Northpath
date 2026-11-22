# Restore a previous code snapshot, never touch live config, credentials, or unowned processes.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidatePattern('^\d{8}-\d{6}-[a-fA-F0-9]{8}$')][string]$Id,[switch]$ConfirmRollback)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-UpdateCommon.ps1')
$repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$dir=Join-Path $script:IcePackUpdateRoot $Id
$path=Join-Path $dir 'record.json'
if(-not(Test-Path -LiteralPath $path -PathType Leaf)){throw "Unknown update ID: $Id"}
$record=([IO.File]::ReadAllText($path,[Text.Encoding]::UTF8).TrimStart([char]0xFEFF)|ConvertFrom-Json)
if($record.id -ne $Id -or $record.schema -ne 1 -or $record.state -ne 'installed'){throw 'Update record is not eligible for rollback.'}
Write-Host "Rollback v$($record.version) ($Id):"
foreach($file in @($record.files)){ $null=Get-IcePackSafeRelativePath $file.path;Write-Host "  $($file.path) => $(if($file.existed){'previous version'}else{'remove newly added file'})" }
if(-not $ConfirmRollback){Write-Host 'DRY RUN ONLY. Rerun with -ConfirmRollback after stopping Companion.';exit 0}
$lock=Enter-IcePackUpdateLock
try {
    Assert-IcePackServicesStopped
    foreach($file in @($record.files)) {
        $rel=Get-IcePackSafeRelativePath $file.path
        Assert-IcePackPlainPath $repo $rel
        $dest=Join-Path $repo ($rel.Replace('/',[IO.Path]::DirectorySeparatorChar))
        if (-not (Test-Path -LiteralPath $dest -PathType Leaf)) { throw "Current update file missing: $rel. Refusing to overwrite new changes." }
        if ((Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.newHash) { throw "Current file modified since update: $rel. Refusing rollback." }
        if($file.existed){
            $saved=Join-Path (Join-Path $dir 'previous') ($rel.Replace('/',[IO.Path]::DirectorySeparatorChar))
            Assert-IcePackPlainPath $dir ('previous/'+$rel)
            if(-not(Test-Path -LiteralPath $saved -PathType Leaf)){throw "Backup missing: $rel"}
            if((Get-FileHash -LiteralPath $saved -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.oldHash){throw "Backup hash mismatch: $rel"}
        }
    }
    # Preflight verification above is complete before any files change.
    foreach($file in @($record.files)) {
        $rel=$file.path
        $dest=Join-Path $repo ($rel.Replace('/',[IO.Path]::DirectorySeparatorChar))
        if($file.existed){
            $saved=Join-Path (Join-Path $dir 'previous') ($rel.Replace('/',[IO.Path]::DirectorySeparatorChar))
            Copy-Item -LiteralPath $saved -Destination $dest -Force
            if((Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.oldHash){throw "Rollback verification failed: $rel"}
        }else{Remove-Item -LiteralPath $dest -Force}
    }
    $record.state='rolled-back'
    [IO.File]::WriteAllText($path,($record|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
    Write-Host "Rollback completed: $Id"
} finally {$lock.Dispose()}
