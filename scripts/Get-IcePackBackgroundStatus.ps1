[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-ManagedCommon.ps1')
$settings=Get-IcePackSettings
foreach($name in @('engine','dashboard','bridge')){
    $def=Get-IcePackServiceDefinition $name $settings
    $rec=Read-IcePackOwnedRecord $name
    $owned=($null -ne $rec) -and (Test-IcePackOwnedProcess $rec $def)
    [pscustomobject]@{Service=$name;Port=$def.Port;Listening=(Test-IcePackPort $def.Port);Owned=$owned;Pid=$(if($owned){$rec.pid}else{$null})}
}
