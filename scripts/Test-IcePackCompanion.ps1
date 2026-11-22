# Ice Pack Companion v0.8: read-only local diagnostics. Never prints credentials or logs.
[CmdletBinding()]
param([switch]$Json)
$ErrorActionPreference = 'Stop'
function Test-LoopbackPort([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne(350)) { return $false }
        try { $client.EndConnect($async); return $true } catch { return $false }
    } catch { return $false }
    finally { $client.Dispose() }
}
function Test-Http([string]$Url) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        return @{ reachable = $true; statusCode = [int]$response.StatusCode; note = 'HTTP response received' }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        return @{ reachable = $false; statusCode = $statusCode; note = 'HTTP request failed' }
    }
}

$enginePort = Test-LoopbackPort 3210
$bridgePort = Test-LoopbackPort 3212
$dashboardPort = Test-LoopbackPort 5173
$engine = if ($enginePort) { Test-Http 'http://127.0.0.1:3210/state' } else { @{ reachable = $false; statusCode = $null; note = 'Port closed' } }
$bridge = if ($bridgePort) { Test-Http 'http://127.0.0.1:3212/status' } else { @{ reachable = $false; statusCode = $null; note = 'Port closed' } }
$dashboard = if ($dashboardPort) { Test-Http 'http://127.0.0.1:5173/' } else { @{ reachable = $false; statusCode = $null; note = 'Port closed' } }

# HTTP 503 at bridge /status means bridge itself may be up but cannot reach the engine.
$results = @(
  [pscustomobject]@{ Service='ARK Engine'; Port=3210; Listening=$enginePort; HttpReachable=$engine.reachable; HttpStatus=$engine.statusCode },
  [pscustomobject]@{ Service='Local Bridge'; Port=3212; Listening=$bridgePort; HttpReachable=$bridge.reachable; HttpStatus=$bridge.statusCode },
  [pscustomobject]@{ Service='Northpath Dashboard'; Port=5173; Listening=$dashboardPort; HttpReachable=$dashboard.reachable; HttpStatus=$dashboard.statusCode }
)
if ($Json) { $results | ConvertTo-Json -Depth 3 }
else {
    Write-Host 'Ice Pack Companion v0.8 — read-only diagnostic' -ForegroundColor Cyan
    $results | Format-Table -AutoSize
    if ($bridgePort -and -not $bridge.reachable) {
        Write-Warning 'Bridge port is listening but its /status endpoint is unavailable. If status is 503, confirm engine connectivity.'
    }
    if ($results.Where({-not $_.Listening}).Count -gt 0) {
        Write-Host 'To start missing services: .\scripts\Start-IcePackCompanion.ps1' -ForegroundColor Yellow
    }
    Write-Host 'Port checks cannot prove RCON credentials, pairing, or in-game delivery.'
}
