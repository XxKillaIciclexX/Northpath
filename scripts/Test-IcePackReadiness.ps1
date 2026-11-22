# Read-only pre-stream readiness. No gift controls and no secrets displayed.
[CmdletBinding()]
param([switch]$Json)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'IcePack-Health.ps1')
$result = Get-IcePackHealth
if ($Json) { $result | ConvertTo-Json -Depth 3; return }
Write-Host 'Ice Pack Companion v2.0.1 - operational readiness' -ForegroundColor Cyan
$fields = @(
  @('Engine HTTP health', $result.EngineHealthy),
  @('Bridge reachable', $result.BridgeReachable),
  @('Bridge ↔ engine health', $result.BridgeHealthy),
  @('Dashboard HTTP health', $result.DashboardHealthy),
  @('Player target saved', $result.TargetSaved),
  @('Player target loaded', $result.TargetLoaded)
)
foreach ($item in $fields) { Write-Host ('{0}: {1}' -f $item[0], $(if ($item[1]) {'PASS'} else {'CHECK'})) -ForegroundColor $(if ($item[1]) {'Green'} else {'Yellow'}) }
$rewardColor = if ($result.RewardState -eq 'OFF' -or $result.PreviewSafe) { 'Green' } elseif ($result.LiveOrArmed) { 'Red' } else { 'Yellow' }
Write-Host ('Reward lanes: {0}' -f $result.RewardState) -ForegroundColor $rewardColor
if ($result.ReadyForPreviewSetup) {
    Write-Host 'READY for controlled preview setup. All reward lanes are Off.' -ForegroundColor Green
} elseif ($result.ReadyForPreview) {
    Write-Host 'PREVIEW READY: a preview lane is enabled. Preview does not send RCON; do not assume Live is enabled.' -ForegroundColor Green
} elseif ($result.LiveOrArmed) {
    Write-Host 'LIVE/ARMED DETECTED: preflight cannot certify reward safety or successful RCON delivery.' -ForegroundColor Yellow
} else {
    Write-Host 'NOT READY: inspect service, target, and mode checks. Do not assume gifts are live or safe.' -ForegroundColor Yellow
}
