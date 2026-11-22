# v2.7 - compares installed CODE to an opt-in local observation; no file writes.
[CmdletBinding()]param([switch]$AsJson)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-BaselineCommon.ps1')
$repo=Get-IcePackBaselineRepo
$baseline=Read-IcePackBaseline
$current=@(Get-IcePackBaselineEntries $repo)
$results=@()
if($baseline) {
    if (-not [string]::Equals([IO.Path]::GetFullPath([string]$baseline.repoPath),$repo,[StringComparison]::OrdinalIgnoreCase)) { throw 'Baseline belongs to a different repository. Refusing comparison.' }
    $oldByPath=@{};foreach($item in @($baseline.files)){$oldByPath[[string]$item.path]=$item}
    foreach($entry in $current){
        $old=$oldByPath[$entry.path]
        $status=if(-not $entry.present -and -not $old.present){'Absent in both'}elseif(-not $entry.present){'Missing since baseline'}elseif(-not $old.present){'Added since baseline'}elseif($entry.sha256 -eq [string]$old.sha256){'Unchanged'}else{'Changed'}
        $results += [pscustomobject]@{File=$entry.path;Status=$status}
    }
}
$report=[pscustomobject]@{Status=if($baseline){'Baseline comparison'}else{'Not registered'};Version='Unverified (manual overlays not identifiable by version)';CapturedUtc=if($baseline){$baseline.capturedUtc}else{$null};Files=$results;Note='Read-only local hash comparison. No publisher signatures or release provenance are verified.'}
if($AsJson){$report | ConvertTo-Json -Depth 5;return}
Write-Host 'Ice Pack Companion - Version / baseline status'
Write-Host "Version: $($report.Version)"
Write-Host "Baseline: $($report.Status)"
if($baseline){
    Write-Host "Captured UTC: $($report.CapturedUtc)"
    foreach($r in $results){Write-Host ('  {0}: {1}' -f $r.Status,$r.File)}
}else{Write-Host 'Run Register-IcePackInstallationBaseline.ps1 -ConfirmBaseline to save an observed-file baseline.'}
Write-Host $report.Note
