# Start owned, quiet services. Bridge pairing token is DPAPI-protected for current Windows user.
[CmdletBinding()]
param([ValidateSet('all','engine','dashboard','bridge')][string]$Service='all', [switch]$CheckOnly)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'IcePack-ManagedCommon.ps1')
$settings=Get-IcePackSettings
Assert-IcePackFiles $settings
$packaged = Test-IcePackStreamerInstall
if ($packaged) {
    . (Join-Path $PSScriptRoot 'IcePack-StreamerCommon.ps1')
    if (-not $CheckOnly) { Initialize-IcePackStreamer }
}
$names=if($Service -eq 'all'){Get-IcePackManagedServices}else{@($Service)}
foreach($name in $names){
    $def=Get-IcePackServiceDefinition $name $settings
    $existing=Read-IcePackOwnedRecord $name
    if($existing -and (Test-IcePackOwnedProcess $existing $def)){
        Write-Host "$name already owned/running (PID $($existing.pid)); skipping.";continue
    }
    if(Test-IcePackPort $def.Port){
        Write-Warning "$name port $($def.Port) already in use by an unowned process; will not start or adopt it."
        continue
    }
    if($CheckOnly){Write-Host "$name would start on port $($def.Port).";continue}
    if($name -eq 'engine') {
        $backup=Join-Path $PSScriptRoot 'AutoBackup-IcePackConfiguration.ps1'
        if(-not(Test-Path -LiteralPath $backup -PathType Leaf)){throw 'Missing v1.3 startup backup script; refusing engine launch.'}
        & $backup
        if(-not $?) { throw 'Startup backup failed; refusing engine launch.' }
    }
    $root=Get-IcePackManagedRoot
    $out=Join-Path $root "$name.stdout.log"
    $err=Join-Path $root "$name.stderr.log"
    # Start-Process requires separate stdout/stderr files, and does not expose shell windows.
    $launchArgs = if ($name -eq 'dashboard') { @(('"' + $def.Script + '"'),'--host','127.0.0.1','--port','5173','--strictPort') } else { $def.Args }
    $proc=$null
    if($name -eq 'bridge') {
        # Inject fresh token only in child environment; never in command line, files or logs.
        # Start-Process inherits environment variables; restore parent value immediately.
        $oldToken=[Environment]::GetEnvironmentVariable('ICEPACK_BRIDGE_PAIRING_TOKEN','Process')
        $oldKit=[Environment]::GetEnvironmentVariable('ICEPACK_KIT_DIR','Process')
        $oldWebsiteDir=[Environment]::GetEnvironmentVariable('ICEPACK_WEBSITE_LINK_DIR','Process')
        $oldSettingsPath=[Environment]::GetEnvironmentVariable('ICEPACK_COMPANION_SETTINGS_PATH','Process')
        $oldPreviewMode=[Environment]::GetEnvironmentVariable('ICEPACK_ALPHA_PREVIEW','Process')
        $token=New-IcePackBridgeToken
        try {
            Save-IcePackBridgeToken $token
            [Environment]::SetEnvironmentVariable('ICEPACK_BRIDGE_PAIRING_TOKEN',$token,'Process')
            [Environment]::SetEnvironmentVariable('ICEPACK_KIT_DIR',[string]$settings.kitDir,'Process')
            [Environment]::SetEnvironmentVariable('ICEPACK_WEBSITE_LINK_DIR',$root,'Process')
            if ($packaged) {
                [Environment]::SetEnvironmentVariable('ICEPACK_COMPANION_SETTINGS_PATH',(Get-IcePackConfigPath),'Process')
                [Environment]::SetEnvironmentVariable('ICEPACK_ALPHA_PREVIEW',$null,'Process')
            }
            $proc=Start-Process -FilePath $def.Program -ArgumentList @('"'+$def.Script+'"') -WorkingDirectory $def.WorkDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
        } finally {
            [Environment]::SetEnvironmentVariable('ICEPACK_BRIDGE_PAIRING_TOKEN',$oldToken,'Process')
            [Environment]::SetEnvironmentVariable('ICEPACK_KIT_DIR',$oldKit,'Process')
            [Environment]::SetEnvironmentVariable('ICEPACK_WEBSITE_LINK_DIR',$oldWebsiteDir,'Process')
            [Environment]::SetEnvironmentVariable('ICEPACK_COMPANION_SETTINGS_PATH',$oldSettingsPath,'Process')
            [Environment]::SetEnvironmentVariable('ICEPACK_ALPHA_PREVIEW',$oldPreviewMode,'Process')
            $token=$null
            if($null -eq $proc) { Remove-Item -LiteralPath (Get-IcePackBridgeTokenPath) -Force -ErrorAction SilentlyContinue }
        }
    } elseif ($name -eq 'engine') {
        $giftSource = Get-IcePackGiftSource
        if ($giftSource -eq 'tikfinity' -and -not [IO.File]::ReadAllText($def.Script).Contains('process.env.ICEPACK_GIFT_SOURCE')) {
            throw 'Install the direct TikFinity engine update before starting with this gift source.'
        }
        $oldGiftSource = [Environment]::GetEnvironmentVariable('ICEPACK_GIFT_SOURCE','Process')
        $privateEnv = @{}
        try {
            [Environment]::SetEnvironmentVariable('ICEPACK_GIFT_SOURCE',$giftSource,'Process')
            if ($packaged) {
                $server = Read-IcePackServerSettings
                $rcon = @{ RCON_HOST=$null; RCON_PORT=$null; RCON_PASSWORD=$null; ICEPACK_KIT_DIR=$settings.kitDir }
                if ($null -ne $server) {
                    $rcon.RCON_HOST = [string]$server.host
                    $rcon.RCON_PORT = [string]$server.port
                    $credential = [System.Net.NetworkCredential]::new('', (ConvertTo-SecureString $server.password))
                    $rcon.RCON_PASSWORD = $credential.Password
                }
                foreach ($key in $rcon.Keys) {
                    $privateEnv[$key] = [Environment]::GetEnvironmentVariable($key,'Process')
                    [Environment]::SetEnvironmentVariable($key,$rcon[$key],'Process')
                }
            }
            $proc=Start-Process -FilePath $def.Program -ArgumentList $launchArgs -WorkingDirectory $def.WorkDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
        } finally {
            [Environment]::SetEnvironmentVariable('ICEPACK_GIFT_SOURCE',$oldGiftSource,'Process')
            foreach ($key in $privateEnv.Keys) { [Environment]::SetEnvironmentVariable($key,$privateEnv[$key],'Process') }
            $rcon = $null
            $credential = $null
        }
    } else {
        $proc=Start-Process -FilePath $def.Program -ArgumentList $launchArgs -WorkingDirectory $def.WorkDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err
    }
    try { Save-IcePackOwnedRecord $def $proc.Id }
    catch { Write-Warning "Unable to record ownership; attempting to stop ONLY new process $($proc.Id).";if(-not $proc.HasExited){Stop-Process -Id $proc.Id -ErrorAction SilentlyContinue};if($name -eq 'bridge'){Remove-Item -LiteralPath (Get-IcePackBridgeTokenPath) -Force -ErrorAction SilentlyContinue};throw }
    Write-Host "$name launched quietly (PID $($proc.Id)). Logs: $root"
}
if (-not $packaged) { Write-Host 'For managed bridge pairing, use Copy-IcePackBridgeToken.ps1 (clipboard only). Existing visible bridge is still supported.' }
