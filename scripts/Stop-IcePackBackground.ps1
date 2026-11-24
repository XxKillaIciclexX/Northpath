# Stops only processes carrying matching ownership PID, start time, executable, and script command.
[CmdletBinding()]
param([ValidateSet('all','engine','dashboard','bridge')][string]$Service='all', [switch]$CheckOnly)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-ManagedCommon.ps1')
$settings=Get-IcePackSettings
$names=if($Service -eq 'all'){Get-IcePackManagedServices -StopOrder}else{@($Service)}
foreach($name in $names){
    $def=Get-IcePackServiceDefinition $name $settings
    $rec=Read-IcePackOwnedRecord $name
    if(-not $rec){Write-Host "$name has no ownership record; not stopping anything.";continue}
    if(-not(Test-IcePackOwnedProcess $rec $def)){
        Write-Warning "$name ownership could not be verified; refusing to stop PID $($rec.pid). Record retained for inspection."
        continue
    }
    if($CheckOnly){Write-Host "Would stop owned $name PID $($rec.pid).";continue}
    Stop-Process -Id ([int]$rec.pid) -ErrorAction Stop
    Wait-Process -Id ([int]$rec.pid) -Timeout 5 -ErrorAction SilentlyContinue
    $recordPath=Join-Path (Get-IcePackManagedRoot) "$name.json"
    Remove-Item -LiteralPath $recordPath -Force
    if($name -eq 'bridge') { Remove-Item -LiteralPath (Get-IcePackBridgeTokenPath) -Force -ErrorAction SilentlyContinue }
    Write-Host "Stopped owned $name process (PID $($rec.pid))."
}
Write-Host 'Unowned processes are never touched. Visible/manual bridge instances are unowned and remain untouched.'
