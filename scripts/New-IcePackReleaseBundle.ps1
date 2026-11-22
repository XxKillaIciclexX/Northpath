# Ice Pack Companion v3.1 - non-destructive, allowlisted application source bundle.
# Deliberately excludes the original engine, configuration, credentials, and runtime state.
[CmdletBinding()]
param([string]$RepoPath,[string]$OutputDirectory,[switch]$Build)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
function Is-Link([string]$Path) {
  return [bool]((Get-Item -LiteralPath $Path -Force -ErrorAction Stop).Attributes -band [IO.FileAttributes]::ReparsePoint)
}
function Resolve-Repo {
  if (-not [string]::IsNullOrWhiteSpace($RepoPath)) {return (Resolve-Path -LiteralPath $RepoPath -ErrorAction Stop).ProviderPath}
  $settings=Join-Path $env:LOCALAPPDATA 'IcePackCompanion\settings.json'
  if (-not (Test-Path -LiteralPath $settings -PathType Leaf)) {throw 'No installed settings found; supply -RepoPath.'}
  if (Is-Link $settings) {throw 'Linked installation settings refused.'}
  $text=[IO.File]::ReadAllText($settings,[Text.Encoding]::UTF8).TrimStart([char]0xFEFF)
  $config=$text | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace([string]$config.repoPath)) {throw 'Installed repoPath is empty; supply -RepoPath.'}
  return (Resolve-Path -LiteralPath ([string]$config.repoPath) -ErrorAction Stop).ProviderPath
}
$repo=Resolve-Repo
if (Is-Link $repo) {throw 'Linked repository root refused.'}
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {$OutputDirectory=Join-Path $env:LOCALAPPDATA 'IcePackCompanion\releases'}
$dest=[IO.Path]::GetFullPath($OutputDirectory)
if ($dest.TrimEnd('\') -eq $repo.TrimEnd('\') -or $dest.StartsWith($repo.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)) {throw 'Output directory must be outside the repository.'}
# Only known source paths. No .env, user data, backups, node_modules, .git, or credentials.
$required=@('companion/package.json','companion/vite.config.ts','companion/index.html','companion/src/App.tsx','companion/src/main.tsx','companion/src/icepack-release.json','companion/agent-bridge/bridge.mjs','scripts/Open-IcePackControlCenter.ps1','scripts/IcePack-Release.ps1','scripts/Start-IcePackCompanionManaged.ps1','scripts/Stop-IcePackCompanionManaged.ps1')
$selected=New-Object 'System.Collections.Generic.List[string]'
foreach($rel in $required){
  $p=Join-Path $repo ($rel.Replace('/','\'))
  if (-not (Test-Path -LiteralPath $p -PathType Leaf)) {throw "Required application file missing: $rel"}
}
$fixed=@('companion/package.json','companion/package-lock.json','companion/vite.config.ts','companion/tsconfig.json','companion/tailwind.config.js','companion/postcss.config.js','companion/index.html')
foreach($rel in $fixed){if(Test-Path -LiteralPath (Join-Path $repo ($rel.Replace('/','\'))) -PathType Leaf){$selected.Add($rel)}}
$directories=@(
  @{path='companion/src';extensions=@('.tsx','.ts','.css','.json','.mjs','.mts')},
  @{path='companion/agent-bridge';extensions=@('.mjs')},
  @{path='companion/public';extensions=@('.svg','.png','.jpg','.jpeg','.webp','.ico')},
  @{path='scripts';extensions=@('.ps1')}
)
foreach($spec in $directories){
  $base=Join-Path $repo ($spec.path.Replace('/','\'))
  if (-not (Test-Path -LiteralPath $base -PathType Container)) {continue}
  if (Is-Link $base) {throw "Linked directory refused: $($spec.path)"}
  foreach($f in (Get-ChildItem -LiteralPath $base -File -Recurse -Force)) {
    if ($f.Extension.ToLowerInvariant() -notin $spec.extensions) {continue}
    $rel=$f.FullName.Substring($repo.TrimEnd('\').Length+1).Replace('\','/')
    if ($rel -match '(^|/)(test|tests|node_modules|\.git|dist|backups|data|settings|secrets)(/|$)' -or $f.Name -match '(?i)^(\.env|.*\.local\.|.*secret.*|.*token.*|.*credentials.*)') {continue}
    $selected.Add($rel)
  }
}
$files=@($selected | Sort-Object -Unique)
if($files.Count -lt 12){throw 'Incomplete source inventory; refusing to create bundle.'}
$entries=New-Object 'System.Collections.Generic.List[object]'
foreach($rel in $files){
  $parts=$rel.Split('/')
  $p=$repo
  foreach($part in $parts){$p=Join-Path $p $part;if(Is-Link $p){throw "Linked source path refused: $rel"}}
  $hash=(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()
  $entries.Add([pscustomobject]@{path=$rel;sha256=$hash;bytes=(Get-Item -LiteralPath $p).Length})
}
Write-Host "Ice Pack Companion v3.1 release bundle preview: $($entries.Count) allowlisted source files"
Write-Host 'Includes: Northpath Companion dashboard, bridge source, Windows scripts.'
Write-Host 'Excludes: original ARK engine, .env, runtime settings, RCON credentials, pairing secrets, player IDs, Kits, gift configuration, backups, node_modules.'
Write-Host "Output directory: $dest"
foreach($e in $entries){Write-Host ('  '+$e.path)}
if(-not $Build){Write-Host 'DRY RUN. No output created. Rerun with -Build to generate a ZIP.';return}
New-Item -ItemType Directory -Path $dest -Force | Out-Null
if (Is-Link $dest) {throw 'Linked output directory refused.'}
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'
$id=[guid]::NewGuid().ToString('N').Substring(0,8)
$stage=Join-Path $dest ('.staging-'+$stamp+'-'+$id)
$archive=Join-Path $dest ('IcePackCompanion-source-bundle-'+$stamp+'-'+$id+'.zip')
New-Item -ItemType Directory -Path $stage -Force | Out-Null
try{
 foreach($e in $entries){
   $source=Join-Path $repo ($e.path.Replace('/','\'))
   if((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $e.sha256){throw "Source changed while bundling: $($e.path)"}
   $target=Join-Path $stage ($e.path.Replace('/','\'))
   New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
   Copy-Item -LiteralPath $source -Destination $target -ErrorAction Stop
   if((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $e.sha256){throw "Copy verification failed: $($e.path)"}
 }
 $manifest=[ordered]@{schema=1;bundleType='source-snapshot';label='Ice Pack Companion v3.1 source bundle';releaseVersionVerified=$false;requiresExternalEngine=$true;files=@($entries.ToArray())}
 [IO.File]::WriteAllText((Join-Path $stage 'icepack-bundle.json'),($manifest|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
 Add-Type -AssemblyName System.IO.Compression.FileSystem
 [IO.Compression.ZipFile]::CreateFromDirectory($stage,$archive,[IO.Compression.CompressionLevel]::Optimal,$false)
 Write-Host "Bundle created: $archive"
 Write-Host "File count: $($entries.Count). Verify with Test-IcePackReleaseBundle.ps1."
}finally{if(Test-Path -LiteralPath $stage){Remove-Item -LiteralPath $stage -Recurse -Force}}
