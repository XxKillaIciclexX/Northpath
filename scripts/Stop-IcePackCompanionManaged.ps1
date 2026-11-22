# v2.3: Stop only verified owned processes. In-flight ARK RCON cannot be recalled.
[CmdletBinding()]
param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-ManagedCommon.ps1')
$settings=Get-IcePackSettings
$stop=Join-Path $PSScriptRoot 'Stop-IcePackBackground.ps1'
if(-not(Test-Path -LiteralPath $stop -PathType Leaf)){throw 'Missing v2.2 managed shutdown script.'}
$failed=$false
foreach($name in @('bridge','dashboard','engine')) {
    $def=Get-IcePackServiceDefinition $name $settings
    $rec=Read-IcePackOwnedRecord $name
    if(-not $rec){Write-Host "${name}: not managed here; left untouched.";continue}
    if(-not(Test-IcePackOwnedProcess $rec $def)) {
        Write-Warning "${name}: ownership mismatch; refusing shutdown; inspect record."
        $failed=$true
        continue
    }
    if($CheckOnly){Write-Host "${name}: would stop PID $($rec.pid); no changes.";continue}
    try {
        & $stop -Service $name
        if(-not $?) { throw 'Managed stop reported failure.' }
        Write-Host "${name}: managed stop requested."
    } catch {
        Write-Warning "${name}: stop failed: $($_.Exception.Message)"
        $failed=$true
    }
}
if($failed){Write-Error 'Managed shutdown incomplete. No unverified process was stopped.' -ErrorAction Continue;exit 1}
if($CheckOnly){Write-Host 'Shutdown preflight completed; no processes stopped.'}
else {Write-Host 'Managed shutdown complete. Any unowned/manual processes were left untouched.'}
