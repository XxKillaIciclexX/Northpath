# Ice Pack Companion v1.2 - create validated configuration backup.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'IcePack-ConfigCommon.ps1')

$layout = Get-BackupLayout
$available = @($layout.Files | Where-Object { Test-Path -LiteralPath $_.Path -PathType Leaf })
if ($available.Count -eq 0) { throw 'No supported configuration files found. Check installer paths.' }
foreach ($entry in $available) { Assert-ConfigFile $entry.Path }

New-Item -ItemType Directory -Path $layout.Root -Force | Out-Null
$name = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$dir = Join-Path $layout.Root $name
New-Item -ItemType Directory -Path $dir -ErrorAction Stop | Out-Null
try {
    $entries = @()
    foreach ($entry in $available) {
        $filename = "$($entry.Key).json"
        $destination = Join-Path $dir $filename
        Copy-Item -LiteralPath $entry.Path -Destination $destination -ErrorAction Stop
        $entries += [pscustomobject]@{ key=$entry.Key; filename=$filename; sha256=(Get-FileHashText $destination) }
    }
    $manifest = [ordered]@{ format='icepack-config-backup'; version=1; createdUtc=(Get-Date).ToUniversalTime().ToString('o'); entries=$entries }
    $manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $dir 'manifest.json') -Encoding UTF8
} catch {
    Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
    throw
}
Write-Host "Backup created: $name" -ForegroundColor Green
foreach ($entry in $entries) { Write-Host "  $($entry.key) - SHA256 verified at creation" }
Write-Host "Location: $dir"
Write-Host 'Credentials (.env), executable code, and live-mode state were not backed up.'
