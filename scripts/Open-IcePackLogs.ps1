[CmdletBinding()]
param()
$root=Join-Path $env:LOCALAPPDATA 'IcePackCompanion\managed'
New-Item -ItemType Directory -Path $root -Force | Out-Null
Start-Process -FilePath explorer.exe -ArgumentList ('"'+$root+'"')
