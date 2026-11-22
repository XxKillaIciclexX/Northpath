# Verify a v3.1 source bundle without extracting or executing its contents.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$BundlePath)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $BundlePath).ProviderPath)
try {
  $manifestEntry=$null
  foreach($candidate in $zip.Entries){if($candidate.FullName.Replace('\','/') -ceq 'icepack-bundle.json'){$manifestEntry=$candidate;break}}
  if($null -eq $manifestEntry){throw 'Missing bundle manifest.'}
  $reader=New-Object IO.StreamReader($manifestEntry.Open(),[Text.Encoding]::UTF8)
  try {$manifest=$reader.ReadToEnd()|ConvertFrom-Json}finally{$reader.Dispose()}
  if($manifest.schema -ne 1 -or $manifest.bundleType -ne 'source-snapshot' -or $manifest.releaseVersionVerified -ne $false){throw 'Invalid source bundle manifest.'}
  # ZipFile.CreateFromDirectory on Windows/.NET Framework may store backslash separators.
  # Use canonical names for both duplicate detection AND manifest file lookup.
  $byName=[System.Collections.Generic.Dictionary[string,System.IO.Compression.ZipArchiveEntry]]::new([StringComparer]::OrdinalIgnoreCase)
  foreach($entry in $zip.Entries){
    $name=$entry.FullName.Replace('\','/')
    if($name.StartsWith('/') -or $name -match '(^|/)\.\.(/|$)' -or $name -match '^[A-Za-z]:'){throw "Unsafe ZIP path: $name"}
    if($byName.ContainsKey($name)){throw "Duplicate ZIP entry: $name"}
    $byName.Add($name,$entry)
  }
  $allowed=[System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  [void]$allowed.Add('icepack-bundle.json')
  foreach($f in @($manifest.files)){
    $name=[string]$f.path
    if($name -notmatch '^(companion/(src|agent-bridge|public)/|companion/(package|vite|index|tsconfig|tailwind|postcss)|scripts/)' -or $name -match '(^|/)(\.env|node_modules|backups|settings|secrets)(/|$)'){throw "Disallowed manifest path: $name"}
    if(-not $allowed.Add($name)){throw "Duplicate manifest path: $name"}
    if(-not $byName.ContainsKey($name)){throw "Missing ZIP file: $name"}
    $item=$byName[$name]
    $stream=$item.Open()
    $sha=[Security.Cryptography.SHA256]::Create()
    try {$digest=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$stream.Dispose();$sha.Dispose()}
    if($digest -ne [string]$f.sha256){throw "SHA-256 mismatch: $name"}
    if($item.Length -ne [long]$f.bytes){throw "Length mismatch: $name"}
  }
  foreach($name in $byName.Keys){if(-not $allowed.Contains($name)){throw "Unexpected file in bundle: $name"}}
  Write-Host "VERIFIED: $(@($manifest.files).Count) files, SHA-256 intact, no unexpected entries."
  Write-Host 'Source snapshot only; does NOT constitute a signed or standalone installer.'
}finally {$zip.Dispose()}
