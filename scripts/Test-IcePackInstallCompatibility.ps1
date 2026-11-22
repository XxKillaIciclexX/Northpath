# v2.7 - read-only Windows installer prerequisite check. Doesn't inspect secrets.
[CmdletBinding()]param([switch]$AsJson)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-BaselineCommon.ps1')
$repo=Get-IcePackBaselineRepo
$checks = New-Object 'System.Collections.Generic.List[object]'
function Add-Check([string]$name,[bool]$ok,[string]$detail){$checks.Add([pscustomobject]@{Name=$name;Pass=$ok;Detail=$detail})}
Add-Check 'PowerShell 5.1+' ($PSVersionTable.PSVersion.Major -ge 5) ([string]$PSVersionTable.PSVersion)
$node=Get-Command node -ErrorAction SilentlyContinue
$nodeVersion='Not found'
$nodeOk=$false
if($node){
    try{$nodeVersion=(& node --version 2>$null | Select-Object -First 1).Trim();$nodeOk=([version]($nodeVersion.TrimStart('v').Split('-')[0])).Major -ge 20}catch{$nodeOk=$false}
}
Add-Check 'Node.js 20+' $nodeOk $nodeVersion
$npm=Get-Command npm -ErrorAction SilentlyContinue
Add-Check 'npm available' ([bool]$npm) $(if($npm){'Found'}else{'Not found'})
foreach($req in @(
    @{name='Northpath dashboard';path=(Join-Path $repo 'companion\package.json')},
    @{name='ARK bridge';path=(Join-Path $repo 'companion\agent-bridge\bridge.mjs')},
    @{name='Managed launcher';path=(Join-Path $repo 'scripts\Start-IcePackCompanionManaged.ps1')},
    @{name='Update rollback';path=(Join-Path $repo 'scripts\Restore-IcePackUpdate.ps1')}
)) { Add-Check $req.name (Test-Path -LiteralPath $req.path -PathType Leaf) $(if(Test-Path -LiteralPath $req.path -PathType Leaf){'Present'}else{'Missing'}) }
# Materialize the generic List explicitly: @($checks) can throw ArgumentException on Windows PowerShell 5.1.
$checkItems = $checks.ToArray()
$failedItems = @($checkItems | Where-Object { -not $_.Pass })
$report=[pscustomobject]@{Ready=($failedItems.Count -eq 0);Checks=$checkItems;Note='Read-only prerequisites only; does not verify publisher authenticity or live ARK connectivity.'}
if($AsJson){$report|ConvertTo-Json -Depth 5;return}
Write-Host 'Ice Pack Companion - Installer compatibility preflight'
foreach($c in $checks){Write-Host ('  {0}: {1} ({2})' -f $(if($c.Pass){'PASS'}else{'CHECK'}),$c.Name,$c.Detail)}
Write-Host "Prerequisites complete: $($report.Ready)"
Write-Host $report.Note
if(-not $report.Ready){exit 1}
