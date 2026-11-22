# Ice Pack Companion Windows Operations Center.
# Local service, diagnostics, and recovery controls.
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
. (Join-Path $PSScriptRoot 'IcePack-Release.ps1')

$settings = Get-IcePackSettings
$launchScript = Join-Path $PSScriptRoot 'Start-IcePackCompanion.ps1'
$diagnosticScript = Join-Path $PSScriptRoot 'Test-IcePackCompanion.ps1'
$readinessScript = Join-Path $PSScriptRoot 'Test-IcePackReadiness.ps1'
foreach ($script in @($launchScript, $diagnosticScript, $readinessScript)) {
    if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "Missing support script: $script" }
}

$theme = @{
    Background = [System.Drawing.ColorTranslator]::FromHtml('#09111f')
    Surface    = [System.Drawing.ColorTranslator]::FromHtml('#101c2d')
    Border     = [System.Drawing.ColorTranslator]::FromHtml('#26374b')
    Foreground = [System.Drawing.ColorTranslator]::FromHtml('#e2e8f0')
    Title      = [System.Drawing.ColorTranslator]::FromHtml('#f8fafc')
    Muted      = [System.Drawing.ColorTranslator]::FromHtml('#94a3b8')
    Accent     = [System.Drawing.ColorTranslator]::FromHtml('#67e8f9')
    Primary    = [System.Drawing.ColorTranslator]::FromHtml('#0e6477')
    PrimaryHover = [System.Drawing.ColorTranslator]::FromHtml('#11758a')
    PrimaryBorder = [System.Drawing.ColorTranslator]::FromHtml('#22a3bb')
    Secondary  = [System.Drawing.ColorTranslator]::FromHtml('#17283a')
    Hover      = [System.Drawing.ColorTranslator]::FromHtml('#23374d')
    ButtonBorder = [System.Drawing.ColorTranslator]::FromHtml('#35495f')
    Danger     = [System.Drawing.ColorTranslator]::FromHtml('#451f2b')
    DangerHover = [System.Drawing.ColorTranslator]::FromHtml('#572534')
    DangerBorder = [System.Drawing.ColorTranslator]::FromHtml('#813a4d')
    Success    = [System.Drawing.ColorTranslator]::FromHtml('#6ee7b7')
    Warning    = [System.Drawing.ColorTranslator]::FromHtml('#fcd34d')
    Error      = [System.Drawing.ColorTranslator]::FromHtml('#fda4af')
}
$fontFamily = 'Segoe UI'
$form = [System.Windows.Forms.Form]::new()
$form.Text = 'Ice Pack Companion - Operations Center'
$form.AutoScaleDimensions = [System.Drawing.SizeF]::new(96, 96)
$form.AutoScaleMode = 'Dpi'
$form.ClientSize = [System.Drawing.Size]::new(752, 790)
$form.MinimumSize = [System.Drawing.Size]::new(556, 480)
$form.StartPosition = 'CenterScreen'
$form.BackColor = $theme.Background
$form.ForeColor = $theme.Foreground
$form.Font = [System.Drawing.Font]::new($fontFamily, 10)
$form.SuspendLayout()

function New-Stack {
    $stack = [System.Windows.Forms.TableLayoutPanel]::new()
    $stack.ColumnCount = 1
    [void]$stack.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new('Percent', 100))
    $stack.Dock = 'Top'
    $stack.AutoSize = $true
    $stack.AutoSizeMode = 'GrowAndShrink'
    $stack.Margin = [System.Windows.Forms.Padding]::new(0)
    return $stack
}

function Add-Row([System.Windows.Forms.TableLayoutPanel]$Stack, [System.Windows.Forms.Control]$Control) {
    $row = $Stack.RowCount
    $Stack.RowCount++
    [void]$Stack.RowStyles.Add([System.Windows.Forms.RowStyle]::new('AutoSize'))
    $Stack.Controls.Add($Control, 0, $row)
}

function New-Text([string]$Text, [int]$Size, [bool]$Bold, [System.Drawing.Color]$Color) {
    $label = [System.Windows.Forms.Label]::new()
    $label.Text = $Text
    $label.AutoSize = $true
    $label.UseMnemonic = $false
    $label.ForeColor = $Color
    $label.Margin = [System.Windows.Forms.Padding]::new(0, 0, 0, 6)
    $style = if ($Bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $label.Font = [System.Drawing.Font]::new($fontFamily, $Size, $style)
    return $label
}

function New-Card([System.Windows.Forms.TableLayoutPanel]$Stack, [string]$Title) {
    $frame = [System.Windows.Forms.Panel]::new()
    $frame.Dock = 'Top'
    $frame.AutoSize = $true
    $frame.AutoSizeMode = 'GrowAndShrink'
    $frame.BackColor = $theme.Border
    $frame.Padding = [System.Windows.Forms.Padding]::new(1)
    $frame.Margin = [System.Windows.Forms.Padding]::new(0, 0, 0, 12)

    $card = New-Stack
    $card.BackColor = $theme.Surface
    $card.Padding = [System.Windows.Forms.Padding]::new(16, 12, 16, 12)
    Add-Row $card (New-Text $Title 13 $true $theme.Title)
    $frame.Controls.Add($card)
    Add-Row $Stack $frame
    return $card
}

function New-ActionButton([string]$Text, [string]$Variant = 'Secondary') {
    $button = [System.Windows.Forms.Button]::new()
    $button.Text = $Text
    $button.Dock = 'Fill'
    $button.AutoSize = $true
    $button.MinimumSize = [System.Drawing.Size]::new(0, 38)
    $button.Padding = [System.Windows.Forms.Padding]::new(6, 3, 6, 3)
    $button.FlatStyle = 'Flat'
    $button.UseVisualStyleBackColor = $false
    $button.Cursor = [System.Windows.Forms.Cursors]::Hand
    switch ($Variant) {
        'Primary' {
            $button.BackColor = $theme.Primary
            $button.ForeColor = $theme.Title
            $button.FlatAppearance.BorderColor = $theme.PrimaryBorder
            $button.FlatAppearance.MouseOverBackColor = $theme.PrimaryHover
        }
        'Danger' {
            $button.BackColor = $theme.Danger
            $button.ForeColor = $theme.Error
            $button.FlatAppearance.BorderColor = $theme.DangerBorder
            $button.FlatAppearance.MouseOverBackColor = $theme.DangerHover
        }
        default {
            $button.BackColor = $theme.Secondary
            $button.ForeColor = $theme.Foreground
            $button.FlatAppearance.BorderColor = $theme.ButtonBorder
            $button.FlatAppearance.MouseOverBackColor = $theme.Hover
        }
    }
    return $button
}

function Add-ActionRow([System.Windows.Forms.TableLayoutPanel]$Stack, [System.Windows.Forms.Button[]]$Buttons) {
    $row = New-Stack
    $row.ColumnCount = $Buttons.Count
    $row.ColumnStyles.Clear()
    $columnWidth = 100 / $Buttons.Count
    for ($i = 0; $i -lt $Buttons.Count; $i++) {
        [void]$row.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new('Percent', $columnWidth))
        $left = if ($i -eq 0) { 0 } else { 8 }
        $Buttons[$i].Margin = [System.Windows.Forms.Padding]::new($left, 6, 0, 0)
        $row.Controls.Add($Buttons[$i], $i, 0)
    }
    Add-Row $Stack $row
}

function Add-ServiceRow([System.Windows.Forms.TableLayoutPanel]$Stack, [string]$Name, [int]$Port) {
    $row = New-Stack
    $row.ColumnCount = 2
    [void]$row.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new('AutoSize'))
    $nameLabel = New-Text "$Name  /  127.0.0.1:$Port" 10 $false $theme.Foreground
    $status = New-Text 'Checking...' 10 $true $theme.Warning
    $status.Anchor = 'Top, Right'
    $row.Controls.Add($nameLabel, 0, 0)
    $row.Controls.Add($status, 1, 0)
    Add-Row $Stack $row
    return $status
}

$layout = New-Stack
$layout.Dock = 'Fill'
$layout.AutoSize = $false

$header = New-Stack
$header.ColumnCount = 2
[void]$header.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new('AutoSize'))
$header.Padding = [System.Windows.Forms.Padding]::new(20, 14, 20, 10)
$heading = New-Stack
Add-Row $heading (New-Text 'Ice Pack Companion' 21 $true $theme.Title)
Add-Row $heading (New-Text 'Operations Center' 11 $false $theme.Muted)
$releasePath = Join-Path (Split-Path -Parent $PSScriptRoot) 'companion/src/icepack-release.json'
$versionBadge = New-Text (Get-IcePackReleaseLabel $releasePath) 9 $true $theme.Accent
$versionBadge.BackColor = $theme.Secondary
$versionBadge.Padding = [System.Windows.Forms.Padding]::new(8, 4, 8, 4)
$versionBadge.Anchor = 'Top, Right'
$header.Controls.Add($heading, 0, 0)
$header.Controls.Add($versionBadge, 1, 0)
Add-Row $layout $header

$scroll = [System.Windows.Forms.Panel]::new()
$scroll.Dock = 'Fill'
$scroll.AutoScroll = $true
$scroll.Margin = [System.Windows.Forms.Padding]::new(0)
$scroll.Padding = [System.Windows.Forms.Padding]::new(20, 0, 20, 0)
[void]$layout.RowStyles.Add([System.Windows.Forms.RowStyle]::new('Percent', 100))
$layout.RowCount = 2
$layout.Controls.Add($scroll, 0, 1)
$content = New-Stack
$scroll.Controls.Add($content)

$services = New-Card $content 'Local services'
$engineLabel = Add-ServiceRow $services 'ARK Engine' 3210
$bridgeLabel = Add-ServiceRow $services 'Local Bridge' 3212
$dashboardLabel = Add-ServiceRow $services 'Dashboard' 5173
$quietStartButton = New-ActionButton 'Start Companion' 'Primary'
$openButton = New-ActionButton 'Open dashboard'
$quietStopButton = New-ActionButton 'Stop Companion' 'Danger'
Add-ActionRow $services @($quietStartButton, $openButton, $quietStopButton)
$checkButton = New-ActionButton 'Refresh status'
$diagButton = New-ActionButton 'Diagnostics'
$quietLogsButton = New-ActionButton 'Open logs'
Add-ActionRow $services @($checkButton, $diagButton, $quietLogsButton)

$readiness = New-Card $content 'Operational readiness'
$targetLabel = New-Text 'Player target: checking...' 10 $false $theme.Muted
$safeLabel = New-Text 'Reward lanes: checking...' 10 $false $theme.Muted
Add-Row $readiness $targetLabel
Add-Row $readiness $safeLabel
$readinessButton = New-ActionButton 'Run preflight'
Add-ActionRow $readiness @($readinessButton)

$pairing = New-Card $content 'Bridge pairing'
Add-Row $pairing (New-Text 'Paste the pairing token into the dashboard. Keep it private.' 10 $false $theme.Muted)
$copyTokenButton = New-ActionButton 'Copy bridge pairing token'
Add-ActionRow $pairing @($copyTokenButton)

$recovery = New-Card $content 'Configuration protection'
$backupButton = New-ActionButton 'Backup now'
$backupsButton = New-ActionButton 'Open backups'
$restoreHelpButton = New-ActionButton 'Recovery guide'
Add-ActionRow $recovery @($backupButton, $backupsButton, $restoreHelpButton)

$updates = New-Card $content 'Updates and inventory'
$updateManagerButton = New-ActionButton 'Open Update Manager'
Add-ActionRow $updates @($updateManagerButton)
$reportButton = New-ActionButton 'View installation report'
$baselineButton = New-ActionButton 'Version / baseline status'
Add-ActionRow $updates @($reportButton, $baselineButton)

$tools = New-Card $content 'Utilities'
$startButton = New-ActionButton 'Legacy startup'
$folderButton = New-ActionButton 'Open project folder'
Add-ActionRow $tools @($startButton, $folderButton)

$footer = New-Stack
$footer.BackColor = $theme.Surface
$footer.Padding = [System.Windows.Forms.Padding]::new(20, 7, 20, 2)
$statusLabel = New-Text 'Checking local services...' 9 $false $theme.Muted
$statusLabel.Dock = 'Fill'
$statusLabel.AutoSize = $false
$statusLabel.AutoEllipsis = $true
$statusLabel.Height = 20
Add-Row $footer $statusLabel
Add-Row $layout $footer
$form.Controls.Add($layout)
$form.ResumeLayout($true)

function Refresh-IcePackStatus {
    # Health probes read only three fixed localhost URLs; no tokens or IDs are displayed.
    $health = Get-IcePackHealth
    $serviceResults = @($health.EngineHealthy, $health.BridgeReachable, $health.DashboardHealthy)
    $labels = @($engineLabel, $bridgeLabel, $dashboardLabel)
    $open = 0
    for ($i = 0; $i -lt $labels.Count; $i++) {
        if ($serviceResults[$i]) {
            $labels[$i].Text = 'Responding'
            $labels[$i].ForeColor = $theme.Success
            $open++
        } else {
            $labels[$i].Text = 'Check service'
            $labels[$i].ForeColor = $theme.Error
        }
    }
    if ($health.TargetSaved -and $health.TargetLoaded) {
        $targetLabel.Text = 'Player target: saved and loaded'
        $targetLabel.ForeColor = $theme.Success
    } else {
        $targetLabel.Text = 'Player target: unverified'
        $targetLabel.ForeColor = $theme.Warning
    }
    $safeLabel.Text = 'Reward lanes: ' + $health.RewardState
    $safeLabel.ForeColor = if ($health.RewardLanesOff -or $health.PreviewSafe) { $theme.Success } elseif ($health.LiveOrArmed) { $theme.Error } else { $theme.Warning }
    $statusLabel.Text = "$open of 3 services responding  /  $(Get-Date -Format 'h:mm:ss tt')"
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
        if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "Missing backup support script: $script" }
        Open-PowerShellScript $script
    } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Backup unavailable', 'OK', 'Warning') | Out-Null }
})
$backupsButton.Add_Click({
    try {
        $script = Join-Path $PSScriptRoot 'IcePack-ConfigCommon.ps1'
        if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "Missing backup support script: $script" }
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

function Invoke-IcePackManagedAction([string]$FileName, [string]$ActionName) {
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
        $script:managedActionName = $ActionName
        $script:managedActionStarted = [datetime]::UtcNow
        $script:managedTimeoutReported = $false
        $script:managedExitedAt = [datetime]::MinValue
        $quietStartButton.Enabled = $false
        $quietStopButton.Enabled = $false
        $statusLabel.Text = "$ActionName in progress..."
        $script:managedActionTimer.Start()
    } catch {
        $process.Dispose()
        throw
    }
}

$quietStartButton.Add_Click({
    try { Invoke-IcePackManagedAction 'Start-IcePackCompanionManaged.ps1' 'Start Companion' }
    catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Managed startup','OK','Warning') | Out-Null }
})
$quietStopButton.Add_Click({
    if ([System.Windows.Forms.MessageBox]::Show('Stop ONLY processes owned by Ice Pack Companion? In-flight RCON commands cannot be recalled.','Confirm managed stop','YesNo','Warning') -eq 'Yes') {
        try { Invoke-IcePackManagedAction 'Stop-IcePackCompanionManaged.ps1' 'Stop Companion' }
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
        if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing Update Manager script: $path" }
        # Separate window/process keeps the Operations Center responsive.
        Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList @('-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',('"' + $path + '"')) -WorkingDirectory $settings.repoPath
    } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Update Manager','OK','Warning') | Out-Null }
})
$reportButton.Add_Click({
    try {
        $script = Join-Path $PSScriptRoot 'Get-IcePackInstallationReport.ps1'
        if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "Missing installation report script: $script" }
        # Read-only report in a separate PowerShell window, with no impact on status polling.
        Open-PowerShellScript $script
    } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Installation report','OK','Warning') | Out-Null }
})
$baselineButton.Add_Click({
    try {
        $script = Join-Path $PSScriptRoot 'Get-IcePackVersionStatus.ps1'
        if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "Missing version status script: $script" }
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
$form.Add_Load({
    $workArea = [System.Windows.Forms.Screen]::FromControl($form).WorkingArea
    $form.Width = [Math]::Min($form.Width, $workArea.Width)
    $form.Height = [Math]::Min($form.Height, $workArea.Height)
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
