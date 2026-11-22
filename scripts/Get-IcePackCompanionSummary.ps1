# v2.3: read-only status; no tokens, IDs or RCON calls.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-ManagedCommon.ps1')
$settings=Get-IcePackSettings
foreach($name in @('engine','bridge','dashboard')){
    $def=Get-IcePackServiceDefinition $name $settings
    $rec=Read-IcePackOwnedRecord $name
    $owned=($null -ne $rec) -and (Test-IcePackOwnedProcess $rec $def)
    $portBusy=Test-IcePackPort $def.Port
    [pscustomobject]@{Service=$name;Port=$def.Port;Status=$(if($owned){'MANAGED'}elseif($portBusy){'UNOWNED/PORT BUSY'}else{'STOPPED'});Owned=$owned;Listening=$portBusy}
}
