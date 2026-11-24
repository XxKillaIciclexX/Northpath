# Ice Pack Companion v2.0 - read-only, localhost-only readiness probes.
# Never returns player identifiers, pairing tokens, RCON credentials, or raw logs.
Set-StrictMode -Version Latest
function Invoke-IcePackLocalJson([string]$Url, [int]$TimeoutMs = 1000) {
    $uri = [Uri]$Url
    if ($uri.Scheme -ne 'http' -or $uri.Host -ne '127.0.0.1' -or $uri.AbsolutePath -notin @('/state','/status')) {
        throw 'Readiness probe only permits approved loopback status endpoints.'
    }
    $request = [System.Net.HttpWebRequest][System.Net.WebRequest]::Create($uri)
    $request.Method = 'GET'
    $request.Timeout = $TimeoutMs
    $request.ReadWriteTimeout = $TimeoutMs
    $request.Proxy = $null
    try {
        $response = $request.GetResponse()
        try {
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            try { $raw = $reader.ReadToEnd() } finally { $reader.Dispose() }
        } finally { $response.Dispose() }
        if ($raw.Length -gt 2000000) { throw 'Response too large' }
        return [pscustomobject]@{ HttpStatus = 200; Data = ($raw | ConvertFrom-Json) }
    } catch [System.Net.WebException] {
        $webResponse = $_.Exception.Response
        if ($null -ne $webResponse) {
            $code = [int]([System.Net.HttpWebResponse]$webResponse).StatusCode
            try {
                $stream = New-Object System.IO.StreamReader($webResponse.GetResponseStream())
                try { $raw = $stream.ReadToEnd() } finally { $stream.Dispose() }
                if ($raw.Length -lt 2000000) { return [pscustomobject]@{ HttpStatus = $code; Data = ($raw | ConvertFrom-Json) } }
            } catch {} finally { $webResponse.Dispose() }
        }
        return $null
    } catch { return $null }
}
function Test-IcePackWeb([int]$TimeoutMs = 1000) {
    $request = [System.Net.HttpWebRequest][System.Net.WebRequest]::Create('http://127.0.0.1:5173/')
    $request.Method = 'GET'; $request.Timeout = $TimeoutMs; $request.ReadWriteTimeout = $TimeoutMs; $request.Proxy = $null
    try { $response = $request.GetResponse(); try { return ([int]$response.StatusCode -eq 200) } finally { $response.Dispose() } } catch { return $false }
}
function Get-IcePackHealth([switch]$Hosted, [switch]$SkipEngine, [switch]$SkipBridge) {
    $engine = if (-not $SkipEngine) { Invoke-IcePackLocalJson 'http://127.0.0.1:3210/state' }
    $bridge = if (-not $SkipBridge) { Invoke-IcePackLocalJson 'http://127.0.0.1:3212/status' }
    $dashboard = -not $Hosted -and (Test-IcePackWeb)
    $engineHealthy = ($null -ne $engine -and $engine.HttpStatus -eq 200 -and $null -ne $engine.Data.settings)
    $bridgeHealthy = ($null -ne $bridge -and $bridge.HttpStatus -eq 200 -and $bridge.Data.engineOnline -eq $true)
    $bridgeReachable = ($null -ne $bridge -and $bridge.Data.online -eq $true)
    $targetPresent = ($engineHealthy -and [string]$engine.Data.settings.playerId -match '^\d{1,10}$' -and [decimal]$engine.Data.settings.playerId -ge 1 -and [decimal]$engine.Data.settings.playerId -le 4294967295)
    $targetLoaded = ($engineHealthy -and $engine.Data.customRules.playerIdConfigured -eq $true)
    $legacyArmed = ($engineHealthy -and $engine.Data.armed -eq $true)
    $customMode = if ($engineHealthy) { [string]$engine.Data.customRules.mode } else { 'unknown' }
    $experimentalMode = if ($engineHealthy) { [string]$engine.Data.giftRcon.mode } else { 'unknown' }
    $giftSource = $null
    $giftSourceStatus = $null
    $giftTest = $null
    if ($engineHealthy) {
        $giftSource = if ($engine.Data.PSObject.Properties['giftSource']) { [string]$engine.Data.giftSource } else { 'streamerbot' }
        $giftSourceStatus = if ($engine.Data.PSObject.Properties['giftSourceStatus']) { [string]$engine.Data.giftSourceStatus } else { 'ready' }
        if ($engine.Data.PSObject.Properties['giftTest']) { $giftTest = $engine.Data.giftTest }
    }
    # Preview must not be mistaken for Live, and unknown mode values must not be treated as safe.
    $knownModes = @('off','preview','live')
    $modesKnown = ($engineHealthy -and $customMode -cin $knownModes -and $experimentalMode -cin $knownModes)
    $liveActive = ($engineHealthy -and ($legacyArmed -or $customMode -eq 'live' -or $experimentalMode -eq 'live'))
    $safeForSetup = ($modesKnown -and -not $liveActive -and $customMode -eq 'off' -and $experimentalMode -eq 'off')
    $previewSafe = ($modesKnown -and -not $liveActive -and ($customMode -eq 'preview' -or $experimentalMode -eq 'preview'))
    $rewardState = if (-not $engineHealthy -or -not $modesKnown) { 'UNKNOWN' }
      elseif ($liveActive) { 'LIVE OR ARMED' }
      elseif ($previewSafe) { 'PREVIEW (NO RCON FROM PREVIEW)' }
      else { 'OFF' }
    $servicesReady = ($engineHealthy -and $bridgeHealthy -and $dashboard -and $targetPresent -and $targetLoaded)
    return [pscustomobject]@{
        EngineHealthy = [bool]$engineHealthy
        BridgeReachable = [bool]$bridgeReachable
        BridgeHealthy = [bool]$bridgeHealthy
        DashboardHealthy = [bool]$dashboard
        TargetSaved = [bool]$targetPresent
        TargetLoaded = [bool]$targetLoaded
        RewardLanesOff = [bool]$safeForSetup
        RewardState = $rewardState
        CustomRulesMode = $customMode
        ExperimentalMode = $experimentalMode
        LegacyArmed = [bool]$legacyArmed
        GiftSource = $giftSource
        GiftSourceStatus = $giftSourceStatus
        GiftTestReady = ($null -ne $giftTest -and $giftTest.state -notin @('unavailable','armed'))
        GiftTestMessage = $(if ($null -ne $giftTest) { [string]$giftTest.message } else { '' })
        PreviewSafe = [bool]$previewSafe
        LiveOrArmed = [bool]$liveActive
        ReadyForPreviewSetup = [bool]($servicesReady -and $safeForSetup)
        ReadyForPreview = [bool]($servicesReady -and ($safeForSetup -or $previewSafe))
        CheckedAt = (Get-Date).ToString('s')
    }
}
