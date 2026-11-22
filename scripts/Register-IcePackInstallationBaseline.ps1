# v2.7 - opt-in observation only. Records code SHA-256 hashes; NEVER asserts a release version.
[CmdletBinding()]
param([switch]$ConfirmBaseline,[switch]$Replace)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-BaselineCommon.ps1')
$repo=Get-IcePackBaselineRepo
$entries=@(Get-IcePackBaselineEntries $repo)
Write-Host 'Ice Pack Companion - local code baseline'
Write-Host "Repository: $repo"
Write-Host "Present: $(@($entries | Where-Object present).Count) / $($entries.Count)"
Write-Host 'This records observed file hashes, NOT a verified version or trusted release.'
if(-not $ConfirmBaseline) { Write-Host 'DRY RUN: no baseline saved. Add -ConfirmBaseline to record one.';exit 0 }
$dir=Split-Path -Parent $script:IcePackBaselineFile
if(-not(Test-Path -LiteralPath $dir -PathType Container)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
$existing=Test-Path -LiteralPath $script:IcePackBaselineFile
if($existing -and -not $Replace) { throw 'Baseline exists. Use -Replace to intentionally refresh it after verifying your update.' }
if($existing) {
    if((Get-Item -LiteralPath $script:IcePackBaselineFile -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked baseline refused' }
    $old=Read-IcePackBaseline
    $prior = "$($script:IcePackBaselineFile).$(Get-Date -Format yyyyMMdd-HHmmss).bak"
}
$baseline=[pscustomobject]@{schema=1;source='observed-local-files';repoPath=$repo;capturedUtc=[DateTime]::UtcNow.ToString('o');files=$entries;note='This is a local inventory snapshot, not a verified software version.'}
$tmp="$($script:IcePackBaselineFile).$([guid]::NewGuid().ToString('N')).tmp"
try {
    [IO.File]::WriteAllText($tmp,($baseline | ConvertTo-Json -Depth 5),(New-Object Text.UTF8Encoding($false)))
    if($existing){
        [IO.File]::Replace($tmp,$script:IcePackBaselineFile,$prior)
        Write-Host "Previous baseline saved: $prior"
    } else { [IO.File]::Move($tmp,$script:IcePackBaselineFile) }
} finally {if(Test-Path -LiteralPath $tmp){Remove-Item -LiteralPath $tmp -Force}}
Write-Host "Baseline captured: $($script:IcePackBaselineFile)"
