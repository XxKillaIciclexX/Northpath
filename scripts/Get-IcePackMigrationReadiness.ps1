# Ice Pack Companion v2.8 — read-only installer/migration preparation.
# No service control, no configuration writes, no credential contents read.
[CmdletBinding()]
param([switch]$AsJson)
$ErrorActionPreference = 'Stop'

. (Join-Path $PSScriptRoot 'IcePack-BaselineCommon.ps1')
$repo = Get-IcePackBaselineRepo
$settingsPath = Join-Path $env:LOCALAPPDATA 'IcePackCompanion\settings.json'
$hasSettings = Test-Path -LiteralPath $settingsPath -PathType Leaf
$settings = $null
if ($hasSettings) {
    if ((Get-Item -LiteralPath $settingsPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked installer settings refused' }
    $settings = ([IO.File]::ReadAllText($settingsPath, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF) | ConvertFrom-Json)
    if ([string]::IsNullOrWhiteSpace([string]$settings.enginePath)) { throw 'Installed settings missing enginePath' }
}
$engine = if ($settings) { [IO.Path]::GetFullPath([string]$settings.enginePath) } else { 'C:\IcePackARK\ice-pack-ark' }
$kit = if ($settings -and -not [string]::IsNullOrWhiteSpace([string]$settings.kitDir)) { [IO.Path]::GetFullPath([string]$settings.kitDir) } else { Join-Path $engine 'icepack-catalog-manager' }

function Test-PlainLocation([string]$Path, [string]$Name) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    if ((Get-Item -LiteralPath $Path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked $Name path refused" }
}
Test-PlainLocation $engine 'engine'
Test-PlainLocation $kit 'Kit directory'
$components = @(
    [pscustomobject]@{Name='Northpath repository';Path=$repo;Kind='directory'},
    [pscustomobject]@{Name='ARK engine directory';Path=$engine;Kind='directory'},
    [pscustomobject]@{Name='Engine entry point';Path=(Join-Path $engine 'server.mjs');Kind='file'},
    [pscustomobject]@{Name='Kit manager directory';Path=$kit;Kind='directory'},
    [pscustomobject]@{Name='Bridge entry point';Path=(Join-Path $repo 'companion\agent-bridge\bridge.mjs');Kind='file'},
    [pscustomobject]@{Name='Dashboard package';Path=(Join-Path $repo 'companion\package.json');Kind='file'},
    [pscustomobject]@{Name='Managed startup';Path=(Join-Path $repo 'scripts\Start-IcePackCompanionManaged.ps1');Kind='file'},
    [pscustomobject]@{Name='Managed shutdown';Path=(Join-Path $repo 'scripts\Stop-IcePackCompanionManaged.ps1');Kind='file'},
    [pscustomobject]@{Name='Update manager';Path=(Join-Path $repo 'scripts\Install-IcePackUpdate.ps1');Kind='file'},
    [pscustomobject]@{Name='Update rollback';Path=(Join-Path $repo 'scripts\Restore-IcePackUpdate.ps1');Kind='file'}
)
foreach ($item in $components) {
    $item | Add-Member -NotePropertyName Present -NotePropertyValue ([bool](Test-Path -LiteralPath $item.Path -PathType $(if ($item.Kind -eq 'file') {'Leaf'} else {'Container'})))
}
# Only report existence of sensitive files; never access their contents.
$protected = @(
    [pscustomobject]@{Name='Engine credentials (.env)';Present=[bool](Test-Path -LiteralPath (Join-Path $engine '.env') -PathType Leaf);Policy='Never migrate automatically or include in update packages'},
    [pscustomobject]@{Name='Legacy player and rules JSON';Present=[bool](Test-Path -LiteralPath (Join-Path $engine 'rules-v06.json') -PathType Leaf);Policy='Preserve in place; use protected configuration backup'},
    [pscustomobject]@{Name='Configuration backup directory';Present=[bool](Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'IcePackCompanion\backups') -PathType Container);Policy='Preserve in place; never overwrite'},
    [pscustomobject]@{Name='Installed path settings';Present=$hasSettings;Policy='Preserve non-secret directory mapping'}
)
$baseline = Read-IcePackBaseline
$baselineState = if ($null -eq $baseline) {'Not registered'} else {'Registered (local hashes; release unverified)'}
$missing = @($components | Where-Object { -not $_.Present })
$warnings = @()
if (-not $hasSettings) { $warnings += 'No installed settings: defaults were used for engine and Kit location' }
if ($null -eq $baseline) { $warnings += 'No observed-code baseline registered' }
if ($missing.Count -gt 0) { $warnings += "Missing components: $($missing.Count)" }
# No blanket requirement to stop services for a read-only report.
$report = [pscustomobject]@{
    Schema=1
    Purpose='Read-only migration readiness; not an installer or release authenticity check'
    Repository=$repo
    EngineDirectory=$engine
    KitDirectory=$kit
    InstallerSettingsPresent=$hasSettings
    Baseline=$baselineState
    Components=$components
    ProtectedData=$protected
    ReadyForInstallerPlanning=($missing.Count -eq 0 -and $hasSettings)
    Warnings=$warnings
    Note='Does not read .env, pairing tokens, player ID, Kit content, or Gift Rule content; does not modify processes or files.'
}
if ($AsJson) { $report | ConvertTo-Json -Depth 7; return }
Write-Host 'Ice Pack Companion v2.8 - Migration readiness (read only)'
Write-Host "Repository: $repo"
Write-Host "Engine: $engine"
Write-Host "Kit directory: $kit"
Write-Host "Installed settings: $hasSettings"
Write-Host "Baseline: $baselineState"
foreach ($item in $components) { Write-Host ('  {0}: {1}' -f $(if($item.Present){'PASS'}else{'MISSING'}),$item.Name) }
foreach ($item in $protected) { Write-Host ('  PRESERVE {0}: {1}' -f $item.Name,$(if($item.Present){'present'}else{'not found'})) }
foreach ($warning in $report.Warnings) { Write-Warning $warning }
Write-Host "Ready for installer planning: $($report.ReadyForInstallerPlanning)"
Write-Host $report.Note
