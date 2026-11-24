# v2.3: One-command managed startup; does not adopt unowned services.
[CmdletBinding()]
param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-ManagedCommon.ps1')
$settings=Get-IcePackSettings
Assert-IcePackFiles $settings
$launcher=Join-Path $PSScriptRoot 'Start-IcePackBackground.ps1'
if(-not(Test-Path -LiteralPath $launcher -PathType Leaf)){throw 'Missing v2.2 managed launcher.'}
$names = @(Get-IcePackManagedServices)
if (Test-IcePackStreamerInstall) {
    foreach ($name in $names) {
        $def = Get-IcePackServiceDefinition $name $settings
        if ((Test-IcePackPort $def.Port) -and -not (Test-IcePackOwnedProcess (Read-IcePackOwnedRecord $name) $def)) {
            throw "Port $($def.Port) is in use. Stop your other Companion session and try again."
        }
    }
}
$failed=$false
foreach($name in $names) {
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
        if (Test-IcePackStreamerInstall) {
            $deadline = [DateTime]::UtcNow.AddSeconds(8)
            while (-not (Test-IcePackPort $def.Port)) {
                if ([DateTime]::UtcNow -ge $deadline) { throw "${name} is not listening on port $($def.Port). Check its log in $(Get-IcePackManagedRoot)." }
                Start-Sleep -Milliseconds 150
            }
            if (-not (Test-IcePackOwnedProcess $newRec $def)) { throw "${name} exited during startup. Check its log in $(Get-IcePackManagedRoot)." }
        }
        Write-Host "${name}: ownership confirmed."
    } catch {
        Write-Warning "${name}: startup failed: $($_.Exception.Message)"
        $failed=$true
        if (Test-IcePackStreamerInstall) { break }
    }
}
if($failed){Write-Error 'Companion startup incomplete. Review warnings and managed logs. No unowned process was stopped.' -ErrorAction Continue; exit 1}
if($CheckOnly){Write-Host 'Preflight completed; no processes were started.'}
elseif (Test-IcePackStreamerInstall) { Write-Host 'Managed launch completed. Use Operations Center to connect your Northpath account.' }
else {Write-Host 'Managed launch completed. Use Get-IcePackBackgroundStatus.ps1 to verify listening/HTTP readiness; copy bridge token to pair.'}
