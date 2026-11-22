# Ice Pack Companion v2.4 - shared update checks. Windows PowerShell 5.1 compatible.
Set-StrictMode -Version Latest
$script:IcePackUpdateRoot = Join-Path $env:LOCALAPPDATA 'IcePackCompanion\updates'
function Assert-IcePackServicesStopped {
    foreach ($port in @(3210,3212,5173)) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $pending = $client.BeginConnect('127.0.0.1', $port, $null, $null)
            if ($pending.AsyncWaitHandle.WaitOne(400, $false)) {
                try { $client.EndConnect($pending); throw "Port $port is in use. Stop Companion and any manual services before updating." }
                catch [System.Net.Sockets.SocketException] { }
            }
        } finally { $client.Close() }
    }
}
function Get-IcePackSafeRelativePath([string]$Path) {
    if ([string]::IsNullOrWhiteSpace($Path) -or $Path.Contains('\') -or
        $Path.StartsWith('/') -or $Path -notmatch '^[A-Za-z0-9_./-]+$') { throw "Unsafe update path: $Path" }
    $parts = $Path.Split('/')
    if ($parts -contains '..' -or $parts -contains '.' -or $parts -contains '') { throw "Unsafe update path: $Path" }
    # Only update application code, never data/configuration, credentials, or install settings.
    if ($Path -notmatch '^(scripts/[A-Za-z0-9_.-]+\.ps1|tests/[A-Za-z0-9_.-]+\.mjs|companion/(src|agent-bridge)/[A-Za-z0-9_./-]+\.(mjs|mts|ts|tsx))$') {
        throw "Path not on code allowlist: $Path"
    }
    return $Path
}
function Assert-IcePackPlainPath([string]$Root, [string]$Relative) {
    $current = $Root
    if ((Get-Item -LiteralPath $Root -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Reparse-point root refused: $Root" }
    foreach ($part in $Relative.Split('/')) {
        $current = Join-Path $current $part
        if (Test-Path -LiteralPath $current) {
            $obj=Get-Item -LiteralPath $current -Force
            if ($obj.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Symlink/junction refused: $current" }
        }
    }
}
function Read-IcePackManifest([string]$PackagePath, [string]$RepoPath) {
    $manifestPath=Join-Path $PackagePath 'icepack-update.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'Missing icepack-update.json' }
    Assert-IcePackPlainPath $PackagePath 'icepack-update.json'
    $content=[IO.File]::ReadAllText($manifestPath, [Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
    $manifest=$content | ConvertFrom-Json
    if ($manifest.schema -ne 1 -or $manifest.version -notmatch '^\d+\.\d+(\.\d+)?(-[A-Za-z0-9.-]+)?$') { throw 'Unsupported update manifest or version' }
    if ($null -eq $manifest.files -or @($manifest.files).Count -lt 1 -or @($manifest.files).Count -gt 100) { throw 'Expected 1 to 100 files' }
    $seen=@{}
    $files=@()
    foreach ($entry in @($manifest.files)) {
        $rel=Get-IcePackSafeRelativePath ([string]$entry.path)
        if ($seen.ContainsKey($rel.ToLowerInvariant())) { throw "Duplicate update path: $rel" }
        $seen[$rel.ToLowerInvariant()]=$true
        $hash=([string]$entry.sha256).ToLowerInvariant()
        if ($hash -notmatch '^[a-f0-9]{64}$') { throw "Invalid SHA-256 for $rel" }
        Assert-IcePackPlainPath $PackagePath $rel
        Assert-IcePackPlainPath $RepoPath $rel
        $source=Join-Path $PackagePath ($rel.Replace('/',[IO.Path]::DirectorySeparatorChar))
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Update file missing: $rel" }
        $actual=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $hash) { throw "Update hash mismatch: $rel" }
        $files+= [pscustomobject]@{path=$rel;sha256=$hash;source=$source;destination=(Join-Path $RepoPath ($rel.Replace('/',[IO.Path]::DirectorySeparatorChar)))}
    }
    return [pscustomobject]@{version=[string]$manifest.version;files=$files}
}
function Enter-IcePackUpdateLock {
    New-Item -ItemType Directory -Path $script:IcePackUpdateRoot -Force | Out-Null
    $lockPath=Join-Path $script:IcePackUpdateRoot 'update.lock'
    try { return [IO.File]::Open($lockPath, [IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None) }
    catch { throw 'Another Companion update/rollback is in progress.' }
}
