# Removes v0.9 launcher shortcuts and NON-SECRET path config. Leaves every app and user file untouched.
[CmdletBinding(SupportsShouldProcess=$true, ConfirmImpact='Medium')]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$desktop = [Environment]::GetFolderPath('Desktop')
$startMenu = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'
$targets = @(
    (Join-Path $desktop 'Ice Pack Companion.lnk'),
    (Join-Path $desktop 'Ice Pack Companion Control Center.lnk'),
    (Join-Path $startMenu 'Ice Pack Companion.lnk'),
    (Join-Path $startMenu 'Ice Pack Companion Control Center.lnk'),
    (Join-Path $startMenu 'Ice Pack Companion Diagnostics.lnk'),
    (Get-IcePackConfigPath)
)
foreach ($path in $targets) {
    if ((Test-Path -LiteralPath $path -PathType Leaf) -and $PSCmdlet.ShouldProcess($path, 'Remove local launcher file')) {
        Remove-Item -LiteralPath $path -Force
        Write-Host "Removed $path"
    }
}
Write-Host 'Engine, dashboard, bridge, rules, kits, and .env were NOT removed.'
