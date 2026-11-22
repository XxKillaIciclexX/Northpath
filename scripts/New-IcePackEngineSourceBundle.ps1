# Ice Pack Companion v3.2 - read-only engine source snapshot. Not a standalone installer.
[CmdletBinding()]
param([string]$EnginePath='C:\IcePackARK\ice-pack-ark', [string]$OutputDirectory, [switch]$Build)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Is-Link([string]$Path) {
  return [bool]((Get-Item -LiteralPath $Path -Force -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint)
}
$root=(Resolve-Path -LiteralPath $EnginePath -ErrorAction Stop).ProviderPath.TrimEnd('\','/')
if(Is-Link $root){throw 'Linked engine directory refused.'}
if([string]::IsNullOrWhiteSpace($OutputDirectory)){$OutputDirectory=Join-Path $env:LOCALAPPDATA 'IcePackCompanion\releases'}
$dest=[IO.Path]::GetFullPath($OutputDirectory).TrimEnd('\','/')
if($dest.Equals($root,[StringComparison]::OrdinalIgnoreCase) -or $dest.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) -or $dest.StartsWith($root+'/',[StringComparison]::OrdinalIgnoreCase)){throw 'Output must be outside the engine directory.'}
$required=@('server.mjs','engine.mjs','icepack-custom-rules.mjs','icepack-gift-rcon.mjs','icepack-spawn-rcon.mjs','package.json')
foreach($name in $required){if(-not (Test-Path -LiteralPath (Join-Path $root $name) -PathType Leaf)){throw "Required engine source missing: $name"}}
$lockExists=Test-Path -LiteralPath (Join-Path $root 'package-lock.json') -PathType Leaf
$names=New-Object 'System.Collections.Generic.List[string]'
# Only root JS source, npm manifests, and the dashboard HTML. Never collect runtime JSON.
foreach($file in (Get-ChildItem -LiteralPath $root -File -Force)){
  if($file.Extension -ceq '.mjs' -and $file.Name -notmatch '(?i)(secret|token|credential|password|\.test\.mjs$)'){$names.Add($file.Name)}
}
$names.Add('package.json')
if($lockExists){$names.Add('package-lock.json')}
if(Test-Path -LiteralPath (Join-Path $root 'public\index.html') -PathType Leaf){$names.Add('public/index.html')}
$names=@($names | Sort-Object -Unique)
if($names.Count -lt 6){throw 'Engine inventory is incomplete.'}
$records=New-Object 'System.Collections.Generic.List[object]'
foreach($name in $names){
  $parts=$name.Split('/')
  $source=$root
  foreach($part in $parts){$source=Join-Path $source $part;if(Is-Link $source){throw "Linked source file refused: $name"}}
  if(-not (Test-Path -LiteralPath $source -PathType Leaf)){throw "Source disappeared: $name"}
  $bytes=(Get-Item -LiteralPath $source).Length
  $records.Add([pscustomobject]@{path=('engine/'+$name);sha256=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant();bytes=$bytes})
}
Write-Host "Engine source inventory: $($records.Count) files"
Write-Host 'Includes only engine root .mjs source, npm manifests, and optional public/index.html.'
Write-Host 'Excludes rules-v06.json, catalog.json, .env, Kits, backups, logs, node_modules, runtime settings.'
Write-Host "Dependency lockfile present: $lockExists"
foreach($rec in $records){Write-Host ('  '+$rec.path)}
if(-not $Build){Write-Host 'DRY RUN: no files created. Use -Build to create a source ZIP.';return}
if(-not $lockExists){throw 'package-lock.json is required for reproducible dependency setup. Run npm install --package-lock-only in the ENGINE folder after reviewing its package.json, then retry.'}
New-Item -ItemType Directory -Path $dest -Force | Out-Null
if(Is-Link $dest){throw 'Linked output directory refused.'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$id=[guid]::NewGuid().ToString('N').Substring(0,8)
$stage=Join-Path $dest ('.engine-stage-'+$stamp+'-'+$id)
$zipPath=Join-Path $dest ('IcePackCompanion-engine-source-'+$stamp+'-'+$id+'.zip')
New-Item -Path $stage -ItemType Directory -Force | Out-Null
try {
  foreach($rec in $records){
    $relative=$rec.path.Substring('engine/'.Length)
    $from=Join-Path $root ($relative.Replace('/','\'))
    if((Get-FileHash -LiteralPath $from -Algorithm SHA256).Hash.ToLowerInvariant() -ne $rec.sha256){throw "Source changed during snapshot: $relative"}
    $to=Join-Path $stage ($rec.path.Replace('/','\'))
    New-Item -Path (Split-Path -Parent $to) -ItemType Directory -Force | Out-Null
    Copy-Item -LiteralPath $from -Destination $to -ErrorAction Stop
    if((Get-FileHash -LiteralPath $to -Algorithm SHA256).Hash.ToLowerInvariant() -ne $rec.sha256){throw "Copy hash mismatch: $relative"}
  }
  $manifest=[ordered]@{schema=1;bundleType='engine-source-snapshot';label='Ice Pack Companion v3.2 engine source';releaseVersionVerified=$false;includesCredentials=$false;includesGameData=$false;includesNodeModules=$false;requiresExternalArkServer=$true;files=@($records.ToArray())}
  [IO.File]::WriteAllText((Join-Path $stage 'icepack-engine-bundle.json'),($manifest | ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::CreateFromDirectory($stage,$zipPath,[IO.Compression.CompressionLevel]::Optimal,$false)
  Write-Host "Engine source bundle created: $zipPath"
  Write-Host 'Review source before publishing; source code may still contain user-authored private strings.'
} finally {if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -Recurse -Force}}
