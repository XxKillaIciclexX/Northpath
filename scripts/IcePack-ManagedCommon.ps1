# v2.2 owned process helpers: bridge, engine and dashboard.
Set-StrictMode -Version Latest
. (Join-Path $PSScriptRoot 'Common.ps1')
function Get-IcePackManagedRoot {
    $root = Join-Path (Split-Path -Parent (Get-IcePackConfigPath)) 'managed'
    New-Item -ItemType Directory -Path $root -Force | Out-Null
    return $root
}
function Get-IcePackManagedServices([switch]$StopOrder) {
    if (Test-IcePackStreamerInstall) {
        if ($StopOrder) { return @('bridge','engine') }
        return @('engine','bridge')
    }
    if ($StopOrder) { return @('bridge','dashboard','engine') }
    return @('engine','bridge','dashboard')
}
function Get-IcePackServiceDefinition([string]$Name, $Settings) {
    $packaged = Test-IcePackStreamerInstall
    $node = if ($packaged) { Join-Path $Settings.repoPath 'runtime/node.exe' }
        else { (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source }
    switch ($Name) {
        'engine' {
            $script = Join-Path $Settings.enginePath 'server.mjs'
            $launchArgs = if ($packaged) { @('"' + $script + '"') } else { @('--env-file=.env','server.mjs') }
            return [pscustomobject]@{Name=$Name; Port=3210; Program=$node; WorkDir=$Settings.engineDataPath; Script=$script; Args=$launchArgs}
        }
        'dashboard' {
            $work = Join-Path $Settings.repoPath 'companion'
            $script = Join-Path $work 'node_modules\vite\bin\vite.js'
            if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "Vite is not installed at $script. Run npm install from the companion folder first." }
            return [pscustomobject]@{Name=$Name; Port=5173; Program=$node; WorkDir=$work; Script=$script; Args=@($script,'--host','127.0.0.1','--port','5173','--strictPort')}
        }
        'bridge' {
            $work = Join-Path $Settings.repoPath 'companion'
            $script = Join-Path $work 'agent-bridge\bridge.mjs'
            if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "Bridge is missing: $script" }
            return [pscustomobject]@{Name=$Name; Port=3212; Program=$node; WorkDir=$work; Script=$script; Args=@($script)}
        }
        default { throw "Unsupported managed service: $Name" }
    }
}
function Read-IcePackOwnedRecord([string]$Name) {
    $path = Join-Path (Get-IcePackManagedRoot) "$Name.json"
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $null }
    try { return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json) }
    catch { throw "Invalid ownership record $path. Do not delete or terminate arbitrary processes; inspect the file manually." }
}
function Test-IcePackOwnedProcess($Record, $Definition) {
    if ($null -eq $Record) { return $false }
    if ([string]$Record.name -cne $Definition.Name -or [int]$Record.port -ne $Definition.Port) { return $false }
    if ([string]$Record.script -cne $Definition.Script -or [string]$Record.executable -cne $Definition.Program) { return $false }
    $process = Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f [int]$Record.pid) -ErrorAction SilentlyContinue
    if ($null -eq $process) { return $false }
    $creation = ([datetime]$process.CreationDate).ToUniversalTime().ToString('o')
    if ($creation -cne [string]$Record.createdUtc) { return $false }
    if (-not [string]::Equals([string]$process.ExecutablePath, [string]$Definition.Program, [StringComparison]::OrdinalIgnoreCase)) { return $false }
    # Never stop a node process unless its launch command matches the known service script.
    $cmd = [string]$process.CommandLine
    if ($Definition.Name -eq 'engine' -and -not (Test-IcePackStreamerInstall)) {
        return $cmd.Contains('--env-file=.env') -and $cmd.Contains('server.mjs')
    }
    if ($Definition.Name -eq 'engine') { return $cmd.Contains([string]$Definition.Script) }
    if ($Definition.Name -eq 'bridge') { return $cmd.Contains([string]$Definition.Script) }
    return $cmd.Contains([string]$Definition.Script) -and $cmd.Contains('--strictPort')
}
function Save-IcePackOwnedRecord($Definition, [int]$ProcessId) {
    $proc = Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $ProcessId) -ErrorAction Stop
    if ($null -eq $proc) { throw "Cannot find newly started $($Definition.Name) process." }
    $created = ([datetime]$proc.CreationDate).ToUniversalTime().ToString('o')
    $rec = [ordered]@{name=$Definition.Name;pid=$ProcessId;port=$Definition.Port;script=$Definition.Script;executable=$Definition.Program;createdUtc=$created}
    $path = Join-Path (Get-IcePackManagedRoot) "$($Definition.Name).json"
    $temp = "$path.tmp"
    [IO.File]::WriteAllText($temp,($rec | ConvertTo-Json -Compress), (New-Object System.Text.UTF8Encoding($false)))
    Move-Item -LiteralPath $temp -Destination $path -Force
}

# A bridge token is protected at rest with Windows DPAPI / CurrentUser.
# Never log token material or store it in the process ownership record.
function Get-IcePackBridgeTokenPath { return (Join-Path (Get-IcePackManagedRoot) 'bridge-token.dpapi') }
function New-IcePackBridgeToken {
    $bytes=New-Object byte[] 24
    $rng=[System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return (-join ($bytes | ForEach-Object { $_.ToString('x2') }))
}
function Save-IcePackBridgeToken([string]$Token) {
    if ($Token -notmatch '^[0-9a-f]{48}$') { throw 'Invalid generated pairing token' }
    Add-Type -AssemblyName System.Security
    $raw=[System.Text.Encoding]::UTF8.GetBytes($Token)
    $protected=[System.Security.Cryptography.ProtectedData]::Protect($raw,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $dest=Get-IcePackBridgeTokenPath
    $temp="$dest.tmp"
    try { [System.IO.File]::WriteAllBytes($temp,$protected); Move-Item -LiteralPath $temp -Destination $dest -Force }
    finally { if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Force } }
}
function Read-IcePackBridgeToken {
    Add-Type -AssemblyName System.Security
    $file=Get-IcePackBridgeTokenPath
    if (-not(Test-Path -LiteralPath $file -PathType Leaf)) { throw 'No managed bridge token found. Start the bridge using Start quietly.' }
    $protected=[System.IO.File]::ReadAllBytes($file)
    $raw=[System.Security.Cryptography.ProtectedData]::Unprotect($protected,$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)
    $token=[System.Text.Encoding]::UTF8.GetString($raw)
    if ($token -notmatch '^[0-9a-f]{48}$') { throw 'Saved bridge token is invalid.' }
    return $token
}
