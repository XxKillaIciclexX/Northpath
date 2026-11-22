# Ice Pack Companion v1.2 - configuration backup support.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'Common.ps1')

function Get-BackupLayout {
    $settings = Get-IcePackSettings
    $engine = [System.IO.Path]::GetFullPath($settings.enginePath)
    $kit = [System.IO.Path]::GetFullPath($settings.kitDir)
    $root = Join-Path (Split-Path -Parent (Get-IcePackConfigPath)) 'backups'
    return [pscustomobject]@{
        Engine = $engine
        Kit = $kit
        Root = $root
        Files = @(
            [pscustomobject]@{ Key='legacy-rules'; Path=(Join-Path $engine 'rules-v06.json') },
            [pscustomobject]@{ Key='streamer-config'; Path=(Join-Path $kit 'streamer-config-v2.json') }
        )
    }
}

function Assert-ConfigFile([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing configuration: $Path" }
    $info = Get-Item -LiteralPath $Path
    if ($info.Length -gt 4MB -or $info.Length -eq 0) { throw "Unexpected configuration size: $Path" }
    try { $null = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop }
    catch { throw "Invalid JSON: $Path ($($_.Exception.Message))" }
}
function Get-FileHashText([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant() }
function Assert-EngineStopped {
    if (Test-IcePackPort 3210) { throw 'Port 3210 is listening. Stop the original engine before restoring configurations. Preview/Live state may still be active.' }
}
function Get-SafeSnapshotName([string]$Name) {
    if ($Name -notmatch '^\d{8}-\d{6}-[0-9a-f]{8}$') { throw "Invalid snapshot name: $Name" }
    return $Name
}
