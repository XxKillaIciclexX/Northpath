# v2.7 - version/inventory baseline; no secrets, no source modifications.
Set-StrictMode -Version Latest
$script:IcePackBaselineFile = Join-Path $env:LOCALAPPDATA 'IcePackCompanion\installation-baseline.json'
$script:IcePackBaselinePaths = @(
 'scripts/Open-IcePackControlCenter.ps1',
 'scripts/Open-IcePackUpdateManager.ps1',
 'scripts/Start-IcePackCompanionManaged.ps1',
 'scripts/Stop-IcePackCompanionManaged.ps1',
 'scripts/IcePack-ManagedCommon.ps1',
 'scripts/Install-IcePackUpdate.ps1',
 'scripts/Restore-IcePackUpdate.ps1',
 'scripts/Get-IcePackInstallationReport.ps1',
 'companion/agent-bridge/bridge.mjs',
 'companion/agent-bridge/protected-apply.mjs',
 'companion/agent-bridge/recovery.mjs',
 'companion/agent-bridge/audit.mjs',
 'companion/agent-bridge/target.mjs',
 'companion/src/App.tsx',
 'companion/src/RecoveryPanel.tsx',
 'companion/src/TargetPanel.tsx'
)
function Get-IcePackBaselineRepo {
    $repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    $settingsPath = Join-Path $env:LOCALAPPDATA 'IcePackCompanion\settings.json'
    if (Test-Path -LiteralPath $settingsPath -PathType Leaf) {
        if ((Get-Item -LiteralPath $settingsPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked installer settings refused' }
        $cfg = [IO.File]::ReadAllText($settingsPath,[Text.Encoding]::UTF8).TrimStart([char]0xFEFF) | ConvertFrom-Json
        if ($cfg.repoPath) { $repo = [IO.Path]::GetFullPath([string]$cfg.repoPath) }
    }
    if (-not (Test-Path -LiteralPath $repo -PathType Container)) { throw 'Installed repository path not found' }
    if ((Get-Item -LiteralPath $repo -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked repository root refused' }
    return $repo
}
function Get-IcePackBaselineEntries([string]$Repo) {
    $entries = @()
    foreach ($relative in $script:IcePackBaselinePaths) {
        $dest = Join-Path $Repo ($relative.Replace('/',[IO.Path]::DirectorySeparatorChar))
        $current = $Repo
        $linked = $false
        foreach($part in $relative.Split('/')) {
            $current = Join-Path $current $part
            if (Test-Path -LiteralPath $current) {
                if ((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { $linked = $true;break }
            }
        }
        if ($linked) { throw "Linked application path refused: $relative" }
        $present = Test-Path -LiteralPath $dest -PathType Leaf
        $hash = if ($present) {(Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash.ToLowerInvariant()} else {$null}
        $entries += [pscustomobject]@{path=$relative;sha256=$hash;present=[bool]$present}
    }
    return $entries
}
function Read-IcePackBaseline {
    if (-not (Test-Path -LiteralPath $script:IcePackBaselineFile -PathType Leaf)) { return $null }
    if ((Get-Item -LiteralPath $script:IcePackBaselineFile -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked baseline refused' }
    $baseline = ([IO.File]::ReadAllText($script:IcePackBaselineFile,[Text.Encoding]::UTF8).TrimStart([char]0xFEFF) | ConvertFrom-Json)
    if ($baseline.schema -ne 1 -or $baseline.source -ne 'observed-local-files' -or [string]$baseline.repoPath -eq '' -or @($baseline.files).Count -ne $script:IcePackBaselinePaths.Count) { throw 'Invalid baseline format' }
    $seen = @{}
    foreach($item in @($baseline.files)) {
        $rel = [string]$item.path
        if ($script:IcePackBaselinePaths -cnotcontains $rel -or $seen.ContainsKey($rel)) { throw 'Unrecognized or duplicate baseline path' }
        $seen[$rel]=$true
        $hash=[string]$item.sha256
        if ($item.present -and $hash -notmatch '^[0-9a-f]{64}$') { throw 'Invalid baseline hash' }
        if (-not $item.present -and $hash -ne '') { throw 'Invalid absent baseline hash' }
    }
    return $baseline
}
