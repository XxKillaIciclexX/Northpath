# Copies the pairing token for the CURRENT USER's owned bridge, without printing it.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-ManagedCommon.ps1')
$settings=Get-IcePackSettings
$def=Get-IcePackServiceDefinition 'bridge' $settings
$rec=Read-IcePackOwnedRecord 'bridge'
if(-not (Test-IcePackOwnedProcess $rec $def)) { throw 'Managed bridge ownership not verified. Manual bridge tokens are shown in their own terminal.' }
if(-not (Test-IcePackPort 3212)) { throw 'Bridge is not listening on port 3212.' }
$token=Read-IcePackBridgeToken
try { Set-Clipboard -Value $token; Write-Host 'Managed bridge token copied to clipboard. Paste into Northpath Connections; clear your clipboard afterward.' }
finally { $token=$null }
