# Ice Pack Companion v2.6 - Read-only installation inventory and tracked update integrity.
# Windows PowerShell 5.1 compatible. Does not access .env, pairing tokens, or player IDs.
[CmdletBinding()]
param([switch]$AsJson)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$settingsPath = Join-Path $env:LOCALAPPDATA 'IcePackCompanion\settings.json'
$enginePath = 'C:\IcePackARK\ice-pack-ark'
$kitPath = Join-Path $enginePath 'icepack-catalog-manager'
$installationNote = 'Default paths (installer settings not found)'
$warnings = New-Object 'System.Collections.Generic.List[string]'
if (Test-Path -LiteralPath $settingsPath -PathType Leaf) {
    try {
        $settingsText = [IO.File]::ReadAllText($settingsPath,[Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
        $settings = $settingsText | ConvertFrom-Json
        if ($settings.repoPath) { $repo = [IO.Path]::GetFullPath([string]$settings.repoPath) }
        if ($settings.enginePath) { $enginePath = [IO.Path]::GetFullPath([string]$settings.enginePath) }
        if ($settings.kitDir) { $kitPath = [IO.Path]::GetFullPath([string]$settings.kitDir) }
        else { $kitPath = Join-Path $enginePath 'icepack-catalog-manager' }
        $installationNote = 'Saved installer settings loaded'
    } catch {
        $warnings.Add('Installer settings could not be parsed. No changes were made.')
        $installationNote = 'Installer settings invalid; using default locations'
    }
}
$requirements = [ordered]@{
    Engine = (Join-Path $enginePath 'server.mjs')
    Bridge = (Join-Path $repo 'companion\agent-bridge\bridge.mjs')
    Dashboard = (Join-Path $repo 'companion\package.json')
    ControlCenter = (Join-Path $repo 'scripts\Open-IcePackControlCenter.ps1')
    UpdateManager = (Join-Path $repo 'scripts\Open-IcePackUpdateManager.ps1')
}
$components = @(
    foreach ($entry in $requirements.GetEnumerator()) {
        [pscustomobject]@{Name=$entry.Key;Present=[bool](Test-Path -LiteralPath $entry.Value -PathType Leaf)}
    }
)
$updatesRoot=Join-Path $env:LOCALAPPDATA 'IcePackCompanion\updates'
$latest=$null
$updateCount=0
if (Test-Path -LiteralPath $updatesRoot -PathType Container) {
    foreach ($directory in @(Get-ChildItem -LiteralPath $updatesRoot -Directory | Sort-Object Name -Descending)) {
        $recordPath=Join-Path $directory.FullName 'record.json'
        if (-not (Test-Path -LiteralPath $recordPath -PathType Leaf)) { continue }
        try {
            if ((Get-Item -LiteralPath $recordPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked record refused' }
            $rec=([IO.File]::ReadAllText($recordPath,[Text.Encoding]::UTF8).TrimStart([char]0xFEFF)|ConvertFrom-Json)
            if ($rec.schema -ne 1 -or [string]$rec.id -ne $directory.Name -or [string]$rec.version -notmatch '^\d+\.\d+(\.\d+)?(-[A-Za-z0-9.-]+)?$') { throw 'Invalid record format' }
            $updateCount++
            if ($null -eq $latest -and [string]$rec.state -eq 'installed') {
                $latest=[pscustomobject]@{Id=[string]$rec.id;Version=[string]$rec.version;State=[string]$rec.state;Files=@($rec.files)}
            }
        } catch { $warnings.Add("Unreadable update history record: $($directory.Name)") }
    }
}
$changed=New-Object 'System.Collections.Generic.List[string]'
if ($latest) {
    # Latest tracked PACKAGE only: older/manual overlays can legitimately supersede it.
    foreach($entry in $latest.Files) {
        $rel=[string]$entry.path
        if ($rel -notmatch '^(scripts/[A-Za-z0-9_.-]+\.ps1|tests/[A-Za-z0-9_.-]+\.mjs|companion/(src|agent-bridge)/[A-Za-z0-9_./-]+\.(mjs|mts|ts|tsx))$' -or $rel.Split('/') -contains '..') {
            $warnings.Add('A tracked update contains an unsafe file path; integrity comparison skipped.')
            continue
        }
        $dest=Join-Path $repo ($rel.Replace('/',[IO.Path]::DirectorySeparatorChar))
        if (-not (Test-Path -LiteralPath $dest -PathType Leaf)) { $changed.Add($rel);continue }
        try {
            if ((Get-Item -LiteralPath $dest -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { $changed.Add($rel); continue }
            $hash=(Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($hash -ne [string]$entry.newHash) { $changed.Add($rel) }
        } catch { $changed.Add($rel) }
    }
}
$report=[pscustomobject]@{
    Product='Ice Pack Companion'
    ControlCenterBuild='2.6 Alpha'
    InstallSettings=$installationNote
    TrackedPackageVersion=$(if($latest){$latest.Version}else{'None (manual overlays not tracked)'})
    TrackedUpdateId=$(if($latest){$latest.Id}else{$null})
    UpdateHistoryCount=$updateCount
    Components=$components
    LatestPackageFilesChanged=@($changed)
    Warnings=@($warnings)
    Note='Tracked update version is NOT the overall installed application version. Differences may be caused by later manual overlays.'
}
if($AsJson){$report|ConvertTo-Json -Depth 6;return}
Write-Host 'Ice Pack Companion - Installation report (read-only)'
Write-Host "Control Center build: $($report.ControlCenterBuild)"
Write-Host "Installer settings: $($report.InstallSettings)"
Write-Host "Latest tracked package: $($report.TrackedPackageVersion)"
Write-Host "Update records: $updateCount"
foreach($component in $components){Write-Host ("  {0}: {1}" -f $component.Name,$(if($component.Present){'PRESENT'}else{'MISSING'}))}
if($latest){Write-Host "Latest tracked package file differences: $($changed.Count)";foreach($rel in $changed){Write-Host "  CHANGED / MISSING: $rel"}}
foreach($warning in $warnings){Write-Warning $warning}
Write-Host $report.Note
