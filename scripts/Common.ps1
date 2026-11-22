# Shared path settings and read-only network checks for Ice Pack Companion v0.9.
Set-StrictMode -Version Latest

function Get-IcePackConfigPath {
    if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'LOCALAPPDATA is not set. Use a normal Windows user session.' }
    return (Join-Path $env:LOCALAPPDATA 'IcePackCompanion\settings.json')
}

function Get-IcePackSettings {
    $repo = Split-Path -Parent $PSScriptRoot
    $defaultEngine = 'C:\IcePackARK\ice-pack-ark'
    $defaults = @{
        repoPath = $repo
        enginePath = $defaultEngine
        kitDir = (Join-Path $defaultEngine 'icepack-catalog-manager')
    }
    $file = Get-IcePackConfigPath
    if (Test-Path -LiteralPath $file -PathType Leaf) {
        try {
            $stored = Get-Content -LiteralPath $file -Raw -Encoding UTF8 | ConvertFrom-Json
        } catch { throw "Unable to read local installer settings at $file. Run Install-IcePackCompanion.ps1 again." }
        foreach ($key in @('repoPath','enginePath','kitDir')) {
            $value = $stored.$key
            if (-not [string]::IsNullOrWhiteSpace([string]$value)) { $defaults[$key] = [string]$value }
        }
    }
    return [pscustomobject]$defaults
}

function Test-IcePackPort([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(400)) { return $false }
        try { $client.EndConnect($async); return $true } catch { return $false }
    } catch { return $false }
    finally { $client.Dispose() }
}

function Assert-IcePackFiles($settings) {
    $requirements = @(
        @{ Name='ARK engine'; Path=(Join-Path $settings.enginePath 'server.mjs') },
        @{ Name='Private ARK engine .env'; Path=(Join-Path $settings.enginePath '.env') },
        @{ Name='Local bridge'; Path=(Join-Path $settings.repoPath 'companion\agent-bridge\bridge.mjs') },
        @{ Name='Dashboard'; Path=(Join-Path $settings.repoPath 'companion\package.json') }
    )
    foreach ($item in $requirements) {
        if (-not (Test-Path -LiteralPath $item.Path -PathType Leaf)) {
            throw "Missing $($item.Name) at $($item.Path). Check installer paths."
        }
    }
    foreach ($cmd in @('node','npm')) {
        if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd is missing from PATH." }
    }
}
