# Ice Pack Companion v2.2 Alpha - Windows Operations Center.
# Only reads local ports and starts the existing v0.9 launcher. No RCON or gift-mode controls.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'

if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') {
    # Windows Forms needs STA. Do not recurse: Windows PowerShell launched with -STA should always comply.
    & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -File $PSCommandPath
    exit $LASTEXITCODE
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot 'Common.ps1')
. (Join-Path $PSScriptRoot 'IcePack-Health.ps1')

$settings = Get-IcePackSettings
$launchScript = Join-Path $PSScriptRoot 'Start-IcePackCompanion.ps1'
$diagnosticScript = Join-Path $PSScriptRoot 'Test-IcePackCompanion.ps1'
$readinessScript = Join-Path $PSScriptRoot 'Test-IcePackReadiness.ps1'
foreach ($script in @($launchScript, $diagnosticScript, $readinessScript)) {
    if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "Missing support script: $script" }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Ice Pack Companion - Operations Center (v2.7 Alpha)'
$form.Size = New-Object System.Drawing.Size(650, 1092)
$form.MinimumSize = New-Object System.Drawing.Size(650, 1092)
$form.MaximumSize = New-Object System.Drawing.Size(650, 1092)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$form.ForeColor = [System.Drawing.Color]::White
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

function Add-Text([string]$Text, [int]$X, [int]$Y, [int]$W, [int]$H, [int]$Size, [bool]$Bold, [System.Drawing.Color]$Color) {
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Text
    $label.Location = New-Object System.Drawing.Point($X, $Y)
    $label.Size = New-Object System.Drawing.Size($W, $H)
    $label.ForeColor = $Color
    $label.Font = New-Object System.Drawing.Font('Segoe UI', $Size, $(if ($Bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }))
    $form.Controls.Add($label)
    return $label
}
function Add-Button([string]$Text, [int]$X, [int]$Y, [int]$W, [int]$H, [bool]$Primary) {
    $button = New-Object System.Windows.Forms.Button
    $button.Text = $Text
    $button.Location = New-Object System.Drawing.Point($X, $Y)
    $button.Size = New-Object System.Drawing.Size($W, $H)
    $button.FlatStyle = 'Flat'
    $button.FlatAppearance.BorderSize = 1
    $button.Cursor = [System.Windows.Forms.Cursors]::Hand
    if ($Primary) {
        $button.BackColor = [System.Drawing.Color]::FromArgb(6, 182, 212)
        $button.ForeColor = [System.Drawing.Color]::FromArgb(2, 6, 23)
        $button.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(6, 182, 212)
    } else {
        $button.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
        $button.ForeColor = [System.Drawing.Color]::White
        $button.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(71, 85, 105)
    }
    $form.Controls.Add($button)
    return $button
}

$white = [System.Drawing.Color]::White
$muted = [System.Drawing.Color]::FromArgb(148, 163, 184)
$green = [System.Drawing.Color]::FromArgb(52, 211, 153)
$red = [System.Drawing.Color]::FromArgb(251, 113, 133)
$yellow = [System.Drawing.Color]::FromArgb(250, 204, 21)

$null = Add-Text 'ICE PACK COMPANION' 26 18 580 42 23 $true $white
$null = Add-Text 'Northpath / local Windows agent / v2.7 Alpha' 28 62 565 25 10 $false $muted
$null = Add-Text 'Local service status' 28 112 500 30 14 $true $white
$null = Add-Text 'ARK Engine   ·   127.0.0.1:3210' 28 157 355 27 11 $false $white
$null = Add-Text 'Local Bridge  ·   127.0.0.1:3212' 28 199 355 27 11 $false $white
$null = Add-Text 'Dashboard   ·   127.0.0.1:5173' 28 241 355 27 11 $false $white
$engineLabel = Add-Text 'Checking...' 402 157 195 28 11 $true $yellow
$bridgeLabel = Add-Text 'Checking...' 402 199 195 28 11 $true $yellow
$dashboardLabel = Add-Text 'Checking...' 402 241 195 28 11 $true $yellow
$statusLabel = Add-Text 'Checking local services...' 28 291 570 24 9 $false $muted

$startButton = Add-Button 'Legacy startup' 28 326 278 44 $true
$openButton = Add-Button 'Open dashboard' 320 326 278 44 $false
$checkButton = Add-Button 'Refresh status' 28 381 177 40 $false
$diagButton = Add-Button 'Diagnostics' 219 381 180 40 $false
$folderButton = Add-Button 'Open project folder' 413 381 185 40 $false
$null = Add-Text 'Configuration protection' 28 437 560 26 13 $true $white
$backupButton = Add-Button 'Backup now' 28 472 177 40 $true
$backupsButton = Add-Button 'Open backups' 219 472 180 40 $false
$restoreHelpButton = Add-Button 'Recovery guide' 413 472 185 40 $false
$null = Add-Text 'Companion controls (Engine + Bridge + Dashboard)' 28 658 570 27 13 $true $white
$quietStartButton = Add-Button 'Start Companion' 28 693 177 40 $true
$quietStopButton = Add-Button 'Stop Companion' 219 693 180 40 $false
$quietLogsButton = Add-Button 'Open logs' 413 693 185 40 $false
$null = Add-Text 'Managed bridge token is encrypted for your Windows user account.' 28 752 585 24 9 $false $muted
$copyTokenButton = Add-Button 'Copy bridge pairing token' 28 782 278 41 $true
$null = Add-Text 'Clipboard contains a secret until replaced. Never share it.' 320 790 275 36 9 $false $muted
$null = Add-Text 'Application updates (local packages)' 28 846 560 27 13 $true $white
$updateManagerButton = Add-Button 'Open Update Manager' 28 882 278 43 $true
$null = Add-Text 'Dry-run first; services must be stopped before apply or rollback.' 320 884 282 44 9 $false $muted
$null = Add-Text 'Installation inventory (read-only)' 28 941 560 28 13 $true $white
$reportButton = Add-Button 'View installation report' 28 979 278 42 $false
$baselineButton = Add-Button 'Version / baseline status' 320 979 278 42 $false
$null = Add-Text 'Shows tracked updates, component presence, and file differences.' 320 981 285 39 9 $false $muted

$null = Add-Text 'Operational readiness (read-only)' 28 529 570 27 13 $true $white
$targetLabel = Add-Text 'Player target: checking...' 28 563 360 25 10 $false $muted
$safeLabel = Add-Text 'Reward lanes: checking...' 28 590 360 25 10 $false $muted
$readinessButton = Add-Button 'Run preflight' 413 560 185 45 $true
$null = Add-Text 'Preflight never sends RCON or enables Preview/Live.' 28 623 570 24 9 $false $muted

function Refresh-IcePackStatus {
    # Health probes read only three fixed localhost URLs; no tokens or IDs are displayed.
    $health = Get-IcePackHealth
    $serviceResults = @($health.EngineHealthy, $health.BridgeReachable, $health.DashboardHealthy)
    $labels = @($engineLabel, $bridgeLabel, $dashboardLabel)
    $open = 0
    for ($i = 0; $i -lt $labels.Count; $i++) {
        if ($serviceResults[$i]) {
            $labels[$i].Text = 'RESPONDING'
            $labels[$i].ForeColor = $green
            $open++
        } else {
            $labels[$i].Text = 'CHECK SERVICE'
            $labels[$i].ForeColor = $red
        }
    }
    if ($health.TargetSaved -and $health.TargetLoaded) {
        $targetLabel.Text = 'Player target: SAVED + LOADED'
        $targetLabel.ForeColor = $green
    } else {
        $targetLabel.Text = 'Player target: NOT VERIFIED'
        $targetLabel.ForeColor = $yellow
    }
    $safeLabel.Text = 'Reward lanes: ' + $health.RewardState
    $safeLabel.ForeColor = if ($health.RewardLanesOff -or $health.PreviewSafe) { $green } elseif ($health.LiveOrArmed) { $red } else { $yellow }
    $statusLabel.Text = "$open of 3 services respond to HTTP  ·  $(Get-Date -Format 'h:mm:ss tt')"
    # Status represents endpoint health only, never live gift readiness or RCON connectivity.
}

function Open-PowerShellScript([string]$Path) {
    Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList @('-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$Path+'"')) -WorkingDirectory $settings.repoPath
}

$startButton.Add_Click({
    try {
        Assert-IcePackFiles $settings
        Open-PowerShellScript $launchScript
        $statusLabel.Text = 'Start requested. The launcher opens only missing services.'
    } catch {
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Startup check failed', 'OK', 'Warning') | Out-Null
    }
})
$openButton.Add_Click({ Start-Process 'http://127.0.0.1:5173/' })
$checkButton.Add_Click({ Refresh-IcePackStatus })
$diagButton.Add_Click({ Open-PowerShellScript $diagnosticScript })
$readinessButton.Add_Click({ Open-PowerShellScript $readinessScript })
$folderButton.Add_Click({ Start-Process 'explorer.exe' -ArgumentList ('"' + $settings.repoPath + '"') })
$backupButton.Add_Click({
    try {
        $script = Join-Path $PSScriptRoot 'Backup-IcePackConfiguration.ps1'
        if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw 'Install v1.2 backup scripts first.' }
        Open-PowerShellScript $script
    } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Backup unavailable', 'OK', 'Warning') | Out-Null }
})
$backupsButton.Add_Click({
    try {
        $script = Join-Path $PSScriptRoot 'IcePack-ConfigCommon.ps1'
        if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw 'Install v1.2 backup scripts first.' }
        $root = Join-Path (Split-Path -Parent (Get-IcePackConfigPath)) 'backups'
        New-Item -ItemType Directory -Path $root -Force | Out-Null
        Start-Process -FilePath 'explorer.exe' -ArgumentList ('"' + $root + '"')
    } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Backups unavailable', 'OK', 'Warning') | Out-Null }
})
$restoreHelpButton.Add_Click({
    [System.Windows.Forms.MessageBox]::Show(
        'Stop the original engine and Kit Editor before restoring. Run List-IcePackBackups.ps1 to identify a snapshot, then Restore-IcePackConfiguration.ps1 -Snapshot <name> for a dry run. Only use -ConfirmRestore after reviewing the results. A safety backup is created first.',
        'Recovery guide (manual and dry-run-first)', 'OK', 'Information') | Out-Null
})


# Managed actions run in a child process with asynchronously drained stdout/stderr.
# A WinForms timer observes completion on the UI thread. Never WaitForExit on that thread.
$script:managedProcess = $null
$script:managedOutputTask = $null
$script:managedErrorTask = $null
$script:managedActionName = ''
$script:managedActionStarted = [datetime]::MinValue
$script:managedTimeoutReported = $false
$script:managedExitedAt = [datetime]::MinValue
$script:managedActionTimer = New-Object System.Windows.Forms.Timer
$script:managedActionTimer.Interval = 250

function Finish-IcePackManagedAction {
    $process = $script:managedProcess
    $script:managedActionTimer.Stop()
    if ($null -eq $process) { return }
    try {
        # HasExited was checked before this call. Do not block the UI here.
        $exitCode = $process.ExitCode
        # Only read completed tasks. A child service may inherit stdout/stderr pipes,
        # keeping ReadToEndAsync open after the launcher itself has exited.
        # Never block the Windows Forms UI waiting for those inherited handles.
        $outputParts = @()
        if ($null -ne $script:managedOutputTask -and $script:managedOutputTask.IsCompleted) {
            try { $outputParts += [string]$script:managedOutputTask.GetAwaiter().GetResult() }
            catch { $outputParts += 'Output read unavailable.' }
        }
        if ($null -ne $script:managedErrorTask -and $script:managedErrorTask.IsCompleted) {
            try { $outputParts += [string]$script:managedErrorTask.GetAwaiter().GetResult() }
            catch { $outputParts += 'Error output read unavailable.' }
        }
        $details = ($outputParts -join [Environment]::NewLine).Trim()
        if (-not $script:managedOutputTask.IsCompleted -or -not $script:managedErrorTask.IsCompleted) {
            $details += "`nSome output streams remained open after the command exited. Check service logs for full details."
        }
        if ($details.Length -gt 2500) { $details = $details.Substring(0,2500) + "`n... (output shortened; check logs)" }
        if ($exitCode -ne 0) {
            [System.Windows.Forms.MessageBox]::Show("Managed action failed (exit $exitCode):`n$details", $script:managedActionName, 'OK', 'Warning') | Out-Null
        } else {
            $message = if ($details) { $details } else { 'Completed. Check current service status.' }
            [System.Windows.Forms.MessageBox]::Show($message, $script:managedActionName, 'OK', 'Information') | Out-Null
        }
    } catch {
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Managed action result', 'OK', 'Warning') | Out-Null
    } finally {
        $process.Dispose()
        $script:managedProcess = $null
        $script:managedOutputTask = $null
        $script:managedErrorTask = $null
        $quietStartButton.Enabled = $true
        $quietStopButton.Enabled = $true
        $form.UseWaitCursor = $false
        try { Refresh-IcePackStatus } catch { $statusLabel.Text = 'Refresh failed: use Refresh status.' }
    }
}

$script:managedActionTimer.Add_Tick({
    if ($null -eq $script:managedProcess) { $script:managedActionTimer.Stop(); return }
    if ($script:managedProcess.HasExited) {
        # Give redirected output a short grace period, but never make button
        # re-enablement depend indefinitely on streams inherited by child services.
        if ($script:managedExitedAt -eq [datetime]::MinValue) {
            $script:managedExitedAt = [datetime]::UtcNow
        }
        $streamsDone = $script:managedOutputTask.IsCompleted -and $script:managedErrorTask.IsCompleted
        if ($streamsDone -or ([datetime]::UtcNow - $script:managedExitedAt).TotalSeconds -ge 2) {
            Finish-IcePackManagedAction
        }
        return
    }
    $elapsed = ([datetime]::UtcNow - $script:managedActionStarted).TotalSeconds
    if ($elapsed -ge 45 -and -not $script:managedTimeoutReported) {
        $script:managedTimeoutReported = $true
        $statusLabel.Text = 'Still running: check managed logs. No retry or termination performed.'
        [System.Windows.Forms.MessageBox]::Show(
            'The managed command is still running after 45 seconds. The window remains responsive. Do not start the operation again. Check ownership and logs; this action is still being monitored.',
            'Managed action still running', 'OK', 'Warning') | Out-Null
    }
})

function Invoke-IcePackManagedAction([string]$FileName) {
    if ($null -ne $script:managedProcess) { throw 'Another managed action is in progress. Wait for its result.' }
    $actionScript = Join-Path $PSScriptRoot $FileName
    if (-not (Test-Path -LiteralPath $actionScript -PathType Leaf)) { throw "Missing managed action: $actionScript" }
    $si = New-Object System.Diagnostics.ProcessStartInfo
    $si.FileName = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $si.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + $actionScript + '"'
    $si.WorkingDirectory = $settings.repoPath
    $si.UseShellExecute = $false
    $si.CreateNoWindow = $true
    $si.RedirectStandardOutput = $true
    $si.RedirectStandardError = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $si
    try {
        [void]$process.Start()
        $script:managedOutputTask = $process.StandardOutput.ReadToEndAsync()
        $script:managedErrorTask = $process.StandardError.ReadToEndAsync()
        $script:managedProcess = $process
        $script:managedActionName = $FileName
        $script:managedActionStarted = [datetime]::UtcNow
        $script:managedTimeoutReported = $false
        $script:managedExitedAt = [datetime]::MinValue
        $quietStartButton.Enabled = $false
        $quietStopButton.Enabled = $false
        $statusLabel.Text = 'Running ' + $FileName + '... other controls remain available.'
        $script:managedActionTimer.Start()
    } catch {
        $process.Dispose()
        throw
    }
}

$quietStartButton.Add_Click({
    try { Invoke-IcePackManagedAction 'Start-IcePackCompanionManaged.ps1' }
    catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Managed startup','OK','Warning') | Out-Null }
})
$quietStopButton.Add_Click({
    if ([System.Windows.Forms.MessageBox]::Show('Stop ONLY processes owned by Ice Pack Companion? In-flight RCON commands cannot be recalled.','Confirm managed stop','YesNo','Warning') -eq 'Yes') {
        try { Invoke-IcePackManagedAction 'Stop-IcePackCompanionManaged.ps1' }
        catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Managed shutdown','OK','Warning') | Out-Null }
    }
})
$copyTokenButton.Add_Click({
    try {
        & (Join-Path $PSScriptRoot 'Copy-IcePackBridgeToken.ps1') | Out-Null
        $statusLabel.Text='Bridge pairing token copied to clipboard.'
    } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Pairing token unavailable','OK','Warning') | Out-Null }
})
$updateManagerButton.Add_Click({
    try {
        $path = Join-Path $PSScriptRoot 'Open-IcePackUpdateManager.ps1'
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw 'Install the v2.5 Update Manager script first.' }
        # Separate window/process keeps the Operations Center responsive.
        Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList @('-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',('"' + $path + '"')) -WorkingDirectory $settings.repoPath
    } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Update Manager','OK','Warning') | Out-Null }
})
$reportButton.Add_Click({
    try {
        $script = Join-Path $PSScriptRoot 'Get-IcePackInstallationReport.ps1'
        if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw 'Missing v2.6 installation report script.' }
        # Read-only report in a separate PowerShell window, with no impact on status polling.
        Open-PowerShellScript $script
    } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Installation report','OK','Warning') | Out-Null }
})
$baselineButton.Add_Click({
    try {
        $script = Join-Path $PSScriptRoot 'Get-IcePackVersionStatus.ps1'
        if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw 'Missing v2.7 version status script.' }
        Open-PowerShellScript $script
    } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Version status','OK','Warning') | Out-Null }
})
$quietLogsButton.Add_Click({
    try { & (Join-Path $PSScriptRoot 'Open-IcePackLogs.ps1') }
    catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Logs unavailable','OK','Warning') | Out-Null }
})

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 10000
$timer.Add_Tick({
    # Service refresh stays active during managed startup/shutdown.
    try { Refresh-IcePackStatus } catch { $statusLabel.Text = 'Status check failed; try Refresh status.' }
})
$form.Add_Shown({ Refresh-IcePackStatus; $timer.Start() })
$form.Add_FormClosed({
    $timer.Stop(); $timer.Dispose()
    $script:managedActionTimer.Stop(); $script:managedActionTimer.Dispose()
    # Child action is intentionally not terminated if user closes this window.
    # Existing ownership checks still govern the managed services.
    if ($null -ne $script:managedProcess) { $script:managedProcess.Dispose() }
})
[void]$form.ShowDialog()
