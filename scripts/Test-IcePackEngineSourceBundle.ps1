# Read-only ZIP verification; no extraction, execution, or network activity.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$BundlePath)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $BundlePath -ErrorAction Stop).ProviderPath)
try {
  $byName=[System.Collections.Generic.Dictionary[string,System.IO.Compression.ZipArchiveEntry]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach($item in $zip.Entries){
    $name=$item.FullName.Replace('\','/')
    if([string]::IsNullOrWhiteSpace($name) -or $name.StartsWith('/') -or $name -match '(^|/)\.\.?(/|$)' -or $name -match '^[A-Za-z]:' -or $name -match '//'){throw "Unsafe ZIP entry: $name"}
    if($byName.ContainsKey($name)){throw "Duplicate ZIP entry: $name"}
    $byName.Add($name,$item)
  }
  if(-not $byName.ContainsKey('icepack-engine-bundle.json')){throw 'Missing engine bundle manifest.'}
  $reader=New-Object IO.StreamReader($byName['icepack-engine-bundle.json'].Open(),[Text.Encoding]::UTF8)
  try{$manifest=($reader.ReadToEnd() | ConvertFrom-Json)}finally{$reader.Dispose()}
  if($manifest.schema -ne 1 -or $manifest.bundleType -cne 'engine-source-snapshot' -or $manifest.releaseVersionVerified -ne $false){throw 'Invalid engine source bundle manifest.'}
  $allow=[System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  [void]$allow.Add('icepack-engine-bundle.json')
  $files=@($manifest.files)
  if($files.Count -lt 6){throw 'Incomplete engine source manifest.'}
  foreach($f in $files){
    $name=[string]$f.path
    if($name -cnotmatch '^engine/([A-Za-z0-9_-]+\.mjs|package(-lock)?\.json|public/index\.html)$' -or $name -match '(?i)(secret|token|credential|password)'){throw "Disallowed engine file: $name"}
    if(-not $allow.Add($name)){throw "Duplicate manifest path: $name"}
    if(-not $byName.ContainsKey($name)){throw "Missing ZIP file: $name"}
    $item=$byName[$name]
    $sha=[Security.Cryptography.SHA256]::Create()
    $stream=$item.Open()
    try{$digest=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose();$stream.Dispose()}
    if($digest -cne ([string]$f.sha256).ToLowerInvariant()){throw "SHA-256 mismatch: $name"}
    if($item.Length -ne [long]$f.bytes){throw "File length mismatch: $name"}
  }
  foreach($name in $byName.Keys){if(-not $allow.Contains($name)){throw "Unexpected ZIP entry: $name"}}
  Write-Host "VERIFIED engine source: $($files.Count) files, hashes and file lengths match; no unexpected entries."
  Write-Host 'Source snapshot only. NOT a signed release, ready-to-run install, or copy of saved game settings.'
}finally{$zip.Dispose()}
