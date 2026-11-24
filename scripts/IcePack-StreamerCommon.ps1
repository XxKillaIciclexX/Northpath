. (Join-Path $PSScriptRoot 'Common.ps1')

function Write-IcePackStreamerFile([string]$Path, [byte[]]$Bytes, [switch]$Seed) {
    $temp = "$Path.$([Guid]::NewGuid().ToString('N')).tmp"
    try {
        [IO.File]::WriteAllBytes($temp, $Bytes)
        if ($Seed) {
            try { [IO.File]::Move($temp, $Path) }
            catch [IO.IOException] { if (-not [IO.File]::Exists($Path)) { throw } }
        } elseif ([IO.File]::Exists($Path)) {
            [IO.File]::Replace($temp, $Path, [NullString]::Value)
        } else {
            [IO.File]::Move($temp, $Path)
        }
    } finally {
        if ([IO.File]::Exists($temp)) { [IO.File]::Delete($temp) }
    }
}

function Write-IcePackStreamerJson([string]$Path, $Value, [switch]$Seed) {
    Write-IcePackStreamerFile $Path ([Text.Encoding]::UTF8.GetBytes(($Value | ConvertTo-Json -Depth 8 -Compress))) -Seed:$Seed
}

function Initialize-IcePackStreamer {
    $settings = Get-IcePackSettings
    $public = Join-Path $settings.engineDataPath 'public'
    New-Item -ItemType Directory -Path @($settings.kitDir, $public) -Force | Out-Null
    $seeds = @(
        @{ Path=(Join-Path $settings.engineDataPath 'rules-v06.json'); Value=@{ playerId=''; rules=@() } },
        @{ Path=(Join-Path $settings.kitDir 'streamer-config-v2.json'); Value=@{ schemaVersion=2; kits=@(); rules=@() } }
    )
    foreach ($seed in $seeds) {
        if (-not [IO.File]::Exists($seed.Path)) { Write-IcePackStreamerJson $seed.Path $seed.Value -Seed }
    }
    $catalog = Join-Path $settings.kitDir 'ark-catalog-v2.json'
    if (-not [IO.File]::Exists($catalog)) {
        Write-IcePackStreamerFile $catalog ([IO.File]::ReadAllBytes((Join-Path $settings.repoPath 'companion/src/reviewed-catalog.json'))) -Seed
    }
    $index = Join-Path $public 'index.html'
    if (-not [IO.File]::Exists($index)) {
        $page = '<!doctype html><meta charset="utf-8"><title>Ice Pack Companion</title><a href="https://northpath.ai/companion">Open the Northpath dashboard</a>'
        Write-IcePackStreamerFile $index ([Text.Encoding]::UTF8.GetBytes($page)) -Seed
    }
    # Only app-derived paths are shared with the bridge. Credentials have their own file.
    Write-IcePackStreamerJson (Get-IcePackConfigPath) $settings
}

function Get-IcePackServerSettingsPath {
    return (Join-Path (Split-Path -Parent (Get-IcePackConfigPath)) 'ark-server.json')
}

function Read-IcePackServerSettings {
    $file = Get-IcePackServerSettingsPath
    if (-not [IO.File]::Exists($file)) { return $null }
    try {
        $server = [IO.File]::ReadAllText($file) | ConvertFrom-Json
        if (-not $server.host -or [int]$server.port -lt 1 -or [int]$server.port -gt 65535 -or -not $server.password) { throw 'Invalid server settings.' }
        return $server
    } catch { throw 'ARK server settings are unreadable. Save them again in Set ARK Server.' }
}

function Save-IcePackServerSettings([string]$ServerName, [int]$Port, [string]$Password) {
    if ($ServerName -notmatch '^[a-zA-Z0-9:.\-]{1,253}$') { throw 'Enter the RCON hostname or IP address without a URL or port.' }
    if ($Port -lt 1 -or $Port -gt 65535) { throw 'Enter an RCON port between 1 and 65535.' }
    $previous = $null
    if (-not $Password) { $previous = Read-IcePackServerSettings }
    if (-not $Password -and $null -eq $previous) { throw 'Enter your RCON password.' }
    $protected = if ($Password) {
        ConvertTo-SecureString $Password -AsPlainText -Force | ConvertFrom-SecureString
    } else { $previous.password }
    Write-IcePackStreamerJson (Get-IcePackServerSettingsPath) @{ host=$ServerName; port=$Port; password=$protected }
}
