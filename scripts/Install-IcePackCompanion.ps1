# v0.9 first-run installer: saves NON-SECRET paths and creates shortcuts for current user.
[CmdletBinding()]
param(
    [string]$EnginePath = 'C:\IcePackARK\ice-pack-ark',
    [string]$KitDir,
    [switch]$SkipShortcuts
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')
$repo = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($KitDir)) { $KitDir = Join-Path $EnginePath 'icepack-catalog-manager' }
$repo = (Resolve-Path -LiteralPath $repo).Path
$EnginePath = (Resolve-Path -LiteralPath $EnginePath -ErrorAction Stop).Path
$settings = [pscustomobject]@{ schemaVersion=1; repoPath=$repo; enginePath=$EnginePath; kitDir=$KitDir }
Assert-IcePackFiles $settings
if (-not (Test-Path -LiteralPath $KitDir -PathType Container)) {
    Write-Warning "Kit directory not found: $KitDir. The bridge may need ICEPACK_KIT_DIR corrected later."
}
$config = Get-IcePackConfigPath
$directory = Split-Path -Parent $config
if (-not (Test-Path -LiteralPath $directory)) { New-Item -Path $directory -ItemType Directory -Force | Out-Null }
$settings | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $config -Encoding UTF8
Write-Host "Saved non-secret local paths to: $config" -ForegroundColor Green

if (-not $SkipShortcuts) {
    $shell = New-Object -ComObject WScript.Shell
    $startScript = Join-Path $repo 'scripts\Start-IcePackCompanion.ps1'
    $checkScript = Join-Path $repo 'scripts\Test-IcePackCompanion.ps1'
    $controlScript = Join-Path $repo 'scripts\Open-IcePackControlCenter.ps1'
    $desktop = [Environment]::GetFolderPath('Desktop')
    $startMenu = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs'
    foreach ($spec in @(
        @{Path=(Join-Path $desktop 'Ice Pack Companion.lnk');Target=$startScript},
        @{Path=(Join-Path $desktop 'Ice Pack Companion Control Center.lnk');Target=$controlScript},
        @{Path=(Join-Path $startMenu 'Ice Pack Companion.lnk');Target=$startScript},
        @{Path=(Join-Path $startMenu 'Ice Pack Companion Control Center.lnk');Target=$controlScript},
        @{Path=(Join-Path $startMenu 'Ice Pack Companion Diagnostics.lnk');Target=$checkScript}
    )) {
        $shortcut = $shell.CreateShortcut($spec.Path)
        $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
        $shortcut.Arguments = '-NoProfile -STA -ExecutionPolicy Bypass -File "' + $spec.Target + '"'
        $shortcut.WorkingDirectory = $repo
        $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,14"
        $shortcut.Description = 'Ice Pack Companion local launcher (preview/live state unchanged)'
        $shortcut.Save()
    }
    Write-Host 'Desktop and Start Menu shortcuts created.' -ForegroundColor Green
}
Write-Host 'Installation complete. The launcher does not start live gift processing.' -ForegroundColor Cyan
Write-Host 'Run: .\scripts\Start-IcePackCompanion.ps1 -CheckOnly'
