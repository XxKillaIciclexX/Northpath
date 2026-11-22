# v2.3: One-command managed startup; does not adopt unowned services.
[CmdletBinding()]
param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-ManagedCommon.ps1')
$settings=Get-IcePackSettings
Assert-IcePackFiles $settings
$launcher=Join-Path $PSScriptRoot 'Start-IcePackBackground.ps1'
if(-not(Test-Path -LiteralPath $launcher -PathType Leaf)){throw 'Missing v2.2 managed launcher.'}
$failed=$false
foreach($name in @('engine','bridge','dashboard')) {
    $def=Get-IcePackServiceDefinition $name $settings
    $rec=Read-IcePackOwnedRecord $name
    if($rec -and (Test-IcePackOwnedProcess $rec $def)) {
        Write-Host "${name}: already managed/running; not restarted."
        continue
    }
    if(Test-IcePackPort $def.Port) {
        Write-Warning "${name}: port $($def.Port) belongs to an UNOWNED process. It will not be adopted or stopped."
        $failed=$true
        continue
    }
    if($CheckOnly){Write-Host "${name}: would start; no changes.";continue}
    try {
        & $launcher -Service $name
        if(-not $?) { throw 'Managed launcher reported failure.' }
        $newRec=Read-IcePackOwnedRecord $name
        if(-not $newRec -or -not(Test-IcePackOwnedProcess $newRec $def)) { throw "${name} did not pass ownership verification after launch." }
        Write-Host "${name}: ownership confirmed."
    } catch {
        Write-Warning "${name}: startup failed: $($_.Exception.Message)"
        $failed=$true
    }
}
if($failed){Write-Error 'Companion startup incomplete. Review warnings and managed logs. No unowned process was stopped.' -ErrorAction Continue; exit 1}
if($CheckOnly){Write-Host 'Preflight completed; no processes were started.'}
else {Write-Host 'Managed launch completed. Use Get-IcePackBackgroundStatus.ps1 to verify listening/HTTP readiness; copy bridge token to pair.'}
