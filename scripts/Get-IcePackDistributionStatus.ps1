# Ice Pack Companion v3.0 Alpha - read-only distribution status.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
$repo=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$record=Join-Path $env:LOCALAPPDATA 'IcePackCompanion\updates'
Write-Host 'Ice Pack Companion - Distribution status (v3.0 Alpha)'
Write-Host "Repository: $repo"
foreach ($rel in @('scripts\Open-IcePackControlCenter.ps1','scripts\Open-IcePackUpdateManager.ps1','scripts\Start-IcePackCompanionManaged.ps1','scripts\Stop-IcePackCompanionManaged.ps1','companion\agent-bridge\bridge.mjs','companion\src\App.tsx')) {
 $exists=Test-Path -LiteralPath (Join-Path $repo $rel) -PathType Leaf
 Write-Host "$(if($exists){'PRESENT'}else{'MISSING'})  $rel"
}
if(Test-Path -LiteralPath $record -PathType Container) {
 $recent=Get-ChildItem -LiteralPath $record -Directory -ErrorAction Stop | ForEach-Object {
   $f=Join-Path $_.FullName 'record.json'
   if(Test-Path -LiteralPath $f -PathType Leaf) {
     try{$r=[IO.File]::ReadAllText($f,[Text.Encoding]::UTF8).TrimStart([char]0xFEFF)|ConvertFrom-Json; if($r.state -eq 'installed'){[pscustomobject]@{Version=$r.version;Id=$r.id;Date=$_.LastWriteTime}}}catch{}
   }
 } | Sort-Object Date -Descending | Select-Object -First 1
 if($recent){Write-Host "Last tracked update: $($recent.Version) / $($recent.Id)"}else{Write-Host 'Last tracked update: none'}
}
Write-Host 'Local update history is NOT publisher authentication or a full application version guarantee.'
