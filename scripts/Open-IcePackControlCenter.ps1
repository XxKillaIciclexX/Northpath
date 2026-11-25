# Ice Pack Companion Windows Operations Center.
# Local service, diagnostics, and recovery controls.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSEdition -ne 'Desktop' -or [System.Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') {
    # Use the same .NET Framework WinForms host as the installed shortcut.
    & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -File $PSCommandPath
    exit $LASTEXITCODE
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
if (-not ('IcePack.Operations.RoundedButton' -as [type])) {
    Add-Type -Path (Join-Path $PSScriptRoot 'IcePack-OperationsTheme.cs') -ReferencedAssemblies @(
        'System.dll', 'System.Drawing.dll', 'System.Windows.Forms.dll'
    )
}
. (Join-Path $PSScriptRoot 'IcePack-ManagedCommon.ps1')
. (Join-Path $PSScriptRoot 'IcePack-Health.ps1')
. (Join-Path $PSScriptRoot 'IcePack-Release.ps1')

$streamer = Test-IcePackStreamerInstall
if ($streamer) {
    $firstWindow = $false
    $appMutex = [System.Threading.Mutex]::new($true, 'Local\Northpath.IcePackCompanionStreamer', [ref]$firstWindow)
    if (-not $firstWindow) { $appMutex.Dispose(); return }
    try {
        . (Join-Path $PSScriptRoot 'IcePack-StreamerCommon.ps1')
        Initialize-IcePackStreamer
    } catch {
        [void][System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Companion setup', 'OK', 'Warning')
        $appMutex.Dispose()
        return
    }
}
$settings = Get-IcePackSettings
$launchScript = Join-Path $PSScriptRoot 'Start-IcePackCompanion.ps1'
$diagnosticScript = Join-Path $PSScriptRoot 'Test-IcePackCompanion.ps1'
$readinessScript = Join-Path $PSScriptRoot 'Test-IcePackReadiness.ps1'
if (-not $streamer) {
    foreach ($script in @($launchScript, $diagnosticScript, $readinessScript)) {
        if (-not (Test-Path -LiteralPath $script -PathType Leaf)) { throw "Missing support script: $script" }
    }
}

$theme = @{
    Background = [System.Drawing.ColorTranslator]::FromHtml('#09111f')
    Surface    = [System.Drawing.ColorTranslator]::FromHtml('#101c2d')
    Border     = [System.Drawing.ColorTranslator]::FromHtml('#26374b')
    Hero       = [System.Drawing.ColorTranslator]::FromHtml('#122b36')
    Foreground = [System.Drawing.ColorTranslator]::FromHtml('#e2e8f0')
    Title      = [System.Drawing.ColorTranslator]::FromHtml('#f8fafc')
    Muted      = [System.Drawing.ColorTranslator]::FromHtml('#94a3b8')
    Accent     = [System.Drawing.ColorTranslator]::FromHtml('#67e8f9')
    Emerald    = [System.Drawing.ColorTranslator]::FromHtml('#10b981')
    Cyan       = [System.Drawing.ColorTranslator]::FromHtml('#0891b2')
    EmeraldHover = [System.Drawing.ColorTranslator]::FromHtml('#34d399')
    CyanHover  = [System.Drawing.ColorTranslator]::FromHtml('#06b6d4')
    OnGradient = [System.Drawing.ColorTranslator]::FromHtml('#061a24')
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
$actionFont = [System.Drawing.Font]::new($fontFamily, 10, [System.Drawing.FontStyle]::Bold)
$pillFont = [System.Drawing.Font]::new($fontFamily, 9, [System.Drawing.FontStyle]::Bold)
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

function New-Stack([System.Windows.Forms.TableLayoutPanel]$Stack = [System.Windows.Forms.TableLayoutPanel]::new()) {
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
    $card = New-Stack ([IcePack.Operations.RoundedSurface]::new())
    $card.FillStart = $card.FillEnd = $theme.Surface
    $card.Outline = $theme.Border
    $card.Margin = [System.Windows.Forms.Padding]::new(0, 0, 0, 14)
    $card.Padding = [System.Windows.Forms.Padding]::new(18, 14, 18, 15)
    Add-Row $card (New-Text $Title 13 $true $theme.Title)
    Add-Row $Stack $card
    return $card
}

function New-ActionButton([string]$Text, [string]$Variant = 'Secondary') {
    $button = [IcePack.Operations.RoundedButton]::new()
    $button.BackColor = $theme.Surface
    $button.Text = $Text
    $button.Font = $actionFont
    $button.AutoSize = $true
    $button.AutoSizeMode = 'GrowAndShrink'
    $button.MinimumSize = [System.Drawing.Size]::new(0, 38)
    $button.Padding = [System.Windows.Forms.Padding]::new(11, 3, 11, 3)
    $button.Cursor = [System.Windows.Forms.Cursors]::Hand
    Set-ActionButtonStyle $button $Variant
    return $button
}

function Set-ActionButtonStyle([System.Windows.Forms.Button]$Button, [string]$Variant) {
    $button.Outline = [System.Drawing.Color]::Empty
    switch ($Variant) {
        'Primary' {
            $button.FillStart = $theme.Emerald
            $button.FillEnd = $theme.Cyan
            $button.HoverStart = $theme.EmeraldHover
            $button.HoverEnd = $theme.CyanHover
            $button.ForeColor = $theme.OnGradient
        }
        'Danger' {
            $button.FillStart = $button.FillEnd = $theme.Danger
            $button.HoverStart = $button.HoverEnd = $theme.DangerHover
            $button.ForeColor = $theme.Error
            $button.Outline = $theme.DangerBorder
        }
        default {
            $button.FillStart = $button.FillEnd = $theme.Secondary
            $button.HoverStart = $button.HoverEnd = $theme.Hover
            $button.ForeColor = $theme.Foreground
            $button.Outline = $theme.ButtonBorder
        }
    }
    $button.Invalidate()
}

function Set-ActionToggle($Button, [bool]$Active, [string]$StartText, [string]$StopText) {
    $text = if ($Active) { $StopText } else { $StartText }
    if ($Button.Text -eq $text) { return }
    $Button.Text = $text
    Set-ActionButtonStyle $Button $(if ($Active) { 'Danger' } else { 'Primary' })
    $Button.Parent.PerformLayout()
}

function Add-ActionRow([System.Windows.Forms.TableLayoutPanel]$Stack, [System.Windows.Forms.Button[]]$Buttons) {
    $row = [IcePack.Operations.ActionStrip]::new()
    $row.Dock = 'Top'
    $row.Margin = [System.Windows.Forms.Padding]::new(0)
    foreach ($button in $Buttons) {
        $button.Margin = [System.Windows.Forms.Padding]::new(0, 7, 8, 0)
        $row.Controls.Add($button)
    }
    Add-Row $Stack $row
}

function New-StatusPill([string]$Text, [System.Drawing.Color]$Color) {
    $pill = [IcePack.Operations.StatusPill]::new()
    $pill.Text = $Text
    $pill.AutoSize = $true
    $pill.UseMnemonic = $false
    $pill.Font = $pillFont
    $pill.ForeColor = $Color
    $pill.Margin = [System.Windows.Forms.Padding]::new(0)
    $pill.Padding = [System.Windows.Forms.Padding]::new(9, 4, 9, 4)
    $pill.Anchor = 'Right'
    return $pill
}

function Add-ServiceRow([System.Windows.Forms.TableLayoutPanel]$Stack, [string]$Name, [int]$Port) {
    $row = New-Stack
    $row.ColumnCount = 3
    $row.ColumnStyles.Clear()
    [void]$row.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new('Absolute', 118))
    [void]$row.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new('Percent', 100))
    [void]$row.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new('AutoSize'))
    $row.Margin = [System.Windows.Forms.Padding]::new(0, 3, 0, 4)
    $nameLabel = New-Text $Name 10 $true $theme.Foreground
    $endpoint = New-Text "127.0.0.1:$Port" 9 $false $theme.Muted
    foreach ($label in @($nameLabel, $endpoint)) {
        $label.Anchor = 'Left'
        $label.Margin = [System.Windows.Forms.Padding]::new(0)
    }
    $status = New-StatusPill 'Checking...' $theme.Warning
    $row.Controls.Add($nameLabel, 0, 0)
    $row.Controls.Add($endpoint, 1, 0)
    $row.Controls.Add($status, 2, 0)
    Add-Row $Stack $row
    return $status
}

$layout = New-Stack
$layout.Dock = 'Fill'
$layout.AutoSize = $false

$headerShell = New-Stack
$headerShell.Padding = [System.Windows.Forms.Padding]::new(20, 16, 20, 14)
$header = New-Stack ([IcePack.Operations.RoundedSurface]::new())
$header.FillStart = $theme.Hero
$header.FillEnd = $theme.Surface
$header.Outline = $theme.Border
$header.ColumnCount = 3
$header.ColumnStyles.Clear()
[void]$header.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new('AutoSize'))
[void]$header.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new('Percent', 100))
[void]$header.ColumnStyles.Add([System.Windows.Forms.ColumnStyle]::new('AutoSize'))
$header.Padding = [System.Windows.Forms.Padding]::new(17, 14, 17, 14)
$mark = [IcePack.Operations.BrandMark]::new()
$mark.Size = [System.Drawing.Size]::new(44, 44)
$mark.MinimumSize = $mark.Size
$mark.Radius = 12
$mark.FillStart = $theme.EmeraldHover
$mark.FillEnd = $theme.CyanHover
$mark.ForeColor = $theme.OnGradient
$mark.Anchor = 'Left'
$mark.Margin = [System.Windows.Forms.Padding]::new(0, 0, 13, 0)
$heading = New-Stack
Add-Row $heading (New-Text 'Ice Pack Companion' 20 $true $theme.Title)
$subtitle = New-Text 'Operations Center' 10 $false $theme.Muted
$subtitle.Margin = [System.Windows.Forms.Padding]::new(0)
Add-Row $heading $subtitle
$releasePath = Join-Path (Split-Path -Parent $PSScriptRoot) 'companion/src/icepack-release.json'
$versionBadge = New-StatusPill (Get-IcePackReleaseLabel $releasePath) $theme.Accent
$header.Controls.Add($mark, 0, 0)
$header.Controls.Add($heading, 1, 0)
$header.Controls.Add($versionBadge, 2, 0)
Add-Row $headerShell $header
Add-Row $layout $headerShell

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
if (-not $streamer) { $dashboardLabel = Add-ServiceRow $services 'Dashboard' 5173 }
$companionButton = New-ActionButton 'Start Companion' 'Primary'
$openButton = New-ActionButton 'Open dashboard'
Add-ActionRow $services @($companionButton, $openButton)
if (-not $streamer) {
    $checkButton = New-ActionButton 'Refresh status'
    $diagButton = New-ActionButton 'Diagnostics'
    $quietLogsButton = New-ActionButton 'Open logs'
    Add-ActionRow $services @($checkButton, $diagButton, $quietLogsButton)
}

$readiness = New-Card $content $(if ($streamer) { 'ARK rewards' } else { 'Operational readiness' })
$targetLabel = New-Text 'Player target: checking...' 10 $false $theme.Muted
$safeLabel = New-Text 'Reward lanes: checking...' 10 $false $theme.Muted
Add-Row $readiness $targetLabel
Add-Row $readiness $safeLabel
$survivorButton = New-ActionButton 'Set Survivor ID'
if ($streamer) {
    $serverLabel = New-Text 'ARK server: checking...' 10 $false $theme.Muted
    Add-Row $readiness $serverLabel
    $serverButton = New-ActionButton 'Set ARK Server'
    Add-ActionRow $readiness @($serverButton, $survivorButton)
} else {
    $readinessButton = New-ActionButton 'Run preflight'
    Add-ActionRow $readiness @($survivorButton, $readinessButton)
}
$startLiveText = if ($streamer) { 'Start Live Rewards' } else { 'Enable Live Custom Rules' }
$stopLiveText = if ($streamer) { 'Stop Live Rewards' } else { 'Stop Custom Rules' }
$liveButton = New-ActionButton $startLiveText 'Primary'
Add-ActionRow $readiness @($liveButton)

$giftInputCard = New-Card $content 'Gift source'
$giftInputLabel = New-Text 'Checking gift source...' 10 $false $theme.Muted
Add-Row $giftInputCard $giftInputLabel
$armGiftTestButton = New-ActionButton 'Arm TikFinity test gift'
if ($streamer) {
    $giftTestLabel = New-Text '' 10 $false $theme.Muted
    $giftTestLabel.MaximumSize = [System.Drawing.Size]::new(415, 0)
    Add-Row $giftInputCard $giftTestLabel
    Add-ActionRow $giftInputCard @($armGiftTestButton)
} else {
    $directGiftButton = New-ActionButton 'Use direct TikFinity'
    $streamerBotGiftButton = New-ActionButton 'Use Streamer.bot'
    Add-ActionRow $giftInputCard @($directGiftButton, $streamerBotGiftButton)
    $giftTestStatusButton = New-ActionButton 'Check test status'
    Add-ActionRow $giftInputCard @($armGiftTestButton, $giftTestStatusButton)
}

if (-not $streamer) {
    $pairing = New-Card $content 'Bridge pairing'
    Add-Row $pairing (New-Text 'Paste the pairing token into the dashboard. Keep it private.' 10 $false $theme.Muted)
    $copyTokenButton = New-ActionButton 'Copy bridge pairing token'
    Add-ActionRow $pairing @($copyTokenButton)
}

$website = New-Card $content 'Northpath website'
$websiteCodeButton = New-ActionButton 'Copy website pairing code'
if ($streamer) {
    $syncLabel = New-Text '' 10 $false $theme.Muted
    $syncLabel.MaximumSize = [System.Drawing.Size]::new(415, 0)
    Add-Row $website $syncLabel
    $syncButton = New-ActionButton 'Enable account sync' 'Primary'
    Add-ActionRow $website @($websiteCodeButton, $syncButton)
} else {
    $websiteButton = New-ActionButton 'Open website Connections'
    Add-ActionRow $website @($websiteCodeButton, $websiteButton)
    $reviewWebsiteRuleButton = New-ActionButton 'Review website rule'
    Add-ActionRow $website @($reviewWebsiteRuleButton)
    $enableAccountSyncButton = New-ActionButton 'Enable account sync'
    $disableAccountSyncButton = New-ActionButton 'Disable account sync'
    $checkAccountSyncButton = New-ActionButton 'Check sync status'
    Add-ActionRow $website @($enableAccountSyncButton, $disableAccountSyncButton, $checkAccountSyncButton)
}

if (-not $streamer) {
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
}

$footer = New-Stack
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

function Update-IcePackGiftSourceLabel($Health) {
    try { $selected = Get-IcePackGiftSource }
    catch { $giftInputLabel.Text = $_.Exception.Message; return }
    $name = if ($selected -eq 'tikfinity') { 'TikFinity Desktop' } else { 'Streamer.bot' }
    if (-not $Health.EngineHealthy) { $giftInputLabel.Text = "Next start: $name"; return }
    $message = if ($Health.GiftSource -eq 'tikfinity') {
        if ($Health.GiftSourceStatus -eq 'connected') { 'TikFinity Desktop connected' }
        else { 'Waiting for TikFinity Desktop' }
    } else { 'Streamer.bot ready' }
    if ($selected -ne $Health.GiftSource) { $message += " | Restart Companion for $name" }
    $giftInputLabel.Text = $message
}

function Test-IcePackServiceOwned([string]$Name) {
    $record = Read-IcePackOwnedRecord $Name
    if ($null -eq $record) { return $false }
    return (Test-IcePackOwnedProcess $record (Get-IcePackServiceDefinition $Name $settings))
}

$script:hasOwnedService = $false
$script:stopRules = $false
$script:syncEnabled = $false

function Refresh-IcePackStatus {
    # Health probes read only three fixed localhost URLs; no tokens or IDs are displayed.
    $engineOwned = Test-IcePackServiceOwned 'engine'
    $bridgeOwned = Test-IcePackServiceOwned 'bridge'
    $script:hasOwnedService = $engineOwned -or $bridgeOwned
    if (-not $streamer) { $script:hasOwnedService = $script:hasOwnedService -or (Test-IcePackServiceOwned 'dashboard') }
    Set-ActionToggle $companionButton $script:hasOwnedService 'Start Companion' 'Stop Companion'
    $health = Get-IcePackHealth -Hosted:$streamer -SkipEngine:($streamer -and -not $engineOwned) -SkipBridge:($streamer -and -not $bridgeOwned)
    $engineReady = $health.EngineHealthy
    $bridgeReady = $health.BridgeHealthy -and $engineReady
    $bridgeActionsReady = $bridgeReady -and $null -eq $script:managedProcess
    $serviceResults = @($engineReady, $health.BridgeReachable)
    $labels = @($engineLabel, $bridgeLabel)
    if (-not $streamer) {
        $serviceResults += $health.DashboardHealthy
        $labels += $dashboardLabel
    }
    $open = 0
    for ($i = 0; $i -lt $labels.Count; $i++) {
        if ($serviceResults[$i]) {
            $labels[$i].Text = 'Responding'
            $labels[$i].ForeColor = $theme.Success
            $open++
        } else {
            $labels[$i].Text = if ($streamer) { 'Offline' } else { 'Check service' }
            $labels[$i].ForeColor = if ($streamer) { $theme.Muted } else { $theme.Error }
        }
    }
    if ($engineReady -and $health.TargetSaved -and $health.TargetLoaded) {
        $targetLabel.Text = 'Player target: saved and loaded'
        $targetLabel.ForeColor = $theme.Success
    } else {
        $targetLabel.Text = 'Player target: unverified'
        $targetLabel.ForeColor = $theme.Warning
    }
    $safeLabel.Text = 'Reward lanes: ' + $health.RewardState
    $safeLabel.ForeColor = if ($health.RewardLanesOff -or $health.PreviewSafe) { $theme.Success } elseif ($health.LiveOrArmed) { $theme.Error } else { $theme.Warning }
    $script:stopRules = $engineReady -and ($health.HostedLiveEnabled -or $health.CustomRulesMode -in @('preview', 'live'))
    Set-ActionToggle $liveButton $script:stopRules $startLiveText $stopLiveText
    $liveButton.Enabled = $bridgeActionsReady -and ($script:stopRules -or ($health.TargetLoaded -and -not $health.LiveOrArmed))
    if ($streamer) {
        $validSettings = $false
        try { $validSettings = $null -ne (Read-IcePackServerSettings) } catch {}
        $serverLabel.Text = if ($validSettings) { 'Direct ARK connection: settings saved' } else { 'Hosted rewards use your approved Northpath server.' }
        $serverButton.Enabled = -not $script:hasOwnedService -and $null -eq $script:managedProcess
        $liveButton.Enabled = $bridgeActionsReady -and ($script:stopRules -or $health.HostedLiveReady -or
            ($validSettings -and $health.TargetLoaded -and $health.RewardLanesOff))
        $survivorButton.Enabled = $bridgeActionsReady -and $health.RewardLanesOff
        $websiteCodeButton.Enabled = $bridgeActionsReady
        $armGiftTestButton.Enabled = $bridgeActionsReady -and $health.RewardLanesOff -and $health.GiftTestReady
        $giftTestLabel.Text = if ($health.HostedLiveEnabled -or $health.HostedLiveMessage -like '*because server approval*') {
            $health.HostedLiveMessage
        } elseif ($engineReady) { $health.GiftTestMessage } else { '' }
        if ($engineReady) { Update-IcePackGiftSourceLabel $health } else { $giftInputLabel.Text = 'Start Companion for TikFinity Desktop.' }
        $script:syncEnabled = $false
        $syncButton.Enabled = $false
        $syncLabel.Text = 'Start Companion to connect to your Northpath account.'
        if ($bridgeReady) {
            try {
                $sync = Invoke-IcePackBridgePost 'operations/account-sync-status' (Read-IcePackBridgeToken) @{}
                $script:syncEnabled = $sync.enabled -eq $true
                $syncLabel.Text = $sync.message
                $syncButton.Enabled = $bridgeActionsReady
            } catch { $syncLabel.Text = 'Account sync status unavailable.' }
        }
        Set-ActionToggle $syncButton $script:syncEnabled 'Enable account sync' 'Disable account sync'
        if (-not $engineReady) { $safeLabel.Text = 'Reward lanes: OFFLINE' }
    } else { Update-IcePackGiftSourceLabel $health }
    if ($null -eq $script:managedProcess) {
        $statusLabel.Text = "$open of $($labels.Count) services responding  /  $(Get-Date -Format 'h:mm:ss tt')"
    }
    # Status represents endpoint health only, never live gift readiness or RCON connectivity.
}

function Open-PowerShellScript([string]$Path) {
    Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList @('-NoExit','-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$Path+'"')) -WorkingDirectory $settings.repoPath
}

if (-not $streamer) {
    $startButton.Add_Click({
        try {
            Assert-IcePackFiles $settings
            Open-PowerShellScript $launchScript
            $statusLabel.Text = 'Start requested. The launcher opens only missing services.'
        } catch {
            [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Startup check failed', 'OK', 'Warning') | Out-Null
        }
    })
}

$openButton.Add_Click({
    Start-Process $(if ($streamer) { 'https://northpath.ai/companion#connections' } else { 'http://127.0.0.1:5173/' })
})
function Select-IcePackGiftSource([string]$Source) {
    try {
        Set-IcePackGiftSource $Source
        Refresh-IcePackStatus
    } catch {
        [void][System.Windows.Forms.MessageBox]::Show($form, $_.Exception.Message, 'Gift source unavailable', 'OK', 'Warning')
    }
}
if (-not $streamer) {
    $checkButton.Add_Click({ Refresh-IcePackStatus })
    $directGiftButton.Add_Click({ Select-IcePackGiftSource 'tikfinity' })
    $streamerBotGiftButton.Add_Click({ Select-IcePackGiftSource 'streamerbot' })
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
}

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
        } elseif (-not $streamer) {
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
        $companionButton.Enabled = $true
        $form.UseWaitCursor = $false
        try { Refresh-IcePackStatus } catch { $statusLabel.Text = 'Status check failed. Retrying shortly.' }
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
        $companionButton.Enabled = $false
        if ($streamer) { $serverButton.Enabled = $false }
        $statusLabel.Text = "$ActionName in progress..."
        $script:managedActionTimer.Start()
    } catch {
        $process.Dispose()
        throw
    }
}

$companionButton.Add_Click({
    try {
        if ($script:hasOwnedService) {
            if (-not $streamer -and [System.Windows.Forms.MessageBox]::Show(
                $form, 'Stop Companion services? In-flight RCON commands cannot be recalled.',
                'Confirm managed stop', 'YesNo', 'Warning') -ne 'Yes') { return }
            Invoke-IcePackManagedAction 'Stop-IcePackCompanionManaged.ps1' 'Stop Companion'
        } else {
            Invoke-IcePackManagedAction 'Start-IcePackCompanionManaged.ps1' 'Start Companion'
        }
    } catch {
        [void][System.Windows.Forms.MessageBox]::Show($form, $_.Exception.Message, 'Companion services', 'OK', 'Warning')
    }
})
if (-not $streamer) {
    $copyTokenButton.Add_Click({
        try {
            & (Join-Path $PSScriptRoot 'Copy-IcePackBridgeToken.ps1') | Out-Null
            $statusLabel.Text='Bridge pairing token copied to clipboard.'
        } catch { [System.Windows.Forms.MessageBox]::Show($_.Exception.Message,'Pairing token unavailable','OK','Warning') | Out-Null }
    })
}

function Invoke-IcePackBridgePost([string]$Endpoint, [string]$Token, [hashtable]$Body) {
    Add-Type -AssemblyName System.Net.Http
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.UseProxy = $false
    $handler.AllowAutoRedirect = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    try {
        $client.Timeout = [TimeSpan]::FromSeconds(20)
        $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, "http://127.0.0.1:3212/$Endpoint")
        try {
            $request.Headers.Add('x-icepack-sync-token', $Token)
            if (-not $Endpoint.StartsWith('operations/')) { $request.Headers.Add('Origin', 'http://127.0.0.1:5173') }
            $request.Content = [System.Net.Http.StringContent]::new(($Body | ConvertTo-Json -Compress), [System.Text.Encoding]::UTF8, 'application/json')
            $response = $client.SendAsync($request).GetAwaiter().GetResult()
            try {
                $raw = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                $result = $raw | ConvertFrom-Json -ErrorAction SilentlyContinue
                if (-not $response.IsSuccessStatusCode) {
                    if ($result -and $result.PSObject.Properties['error']) { throw ([string]$result.error) }
                    throw "Companion bridge returned HTTP $([int]$response.StatusCode)."
                }
                if (-not $result) { throw 'The Companion bridge returned an unreadable response.' }
                return $result
            } finally { $response.Dispose() }
        } finally { $request.Dispose() }
    } finally { $client.Dispose() }
}
function Invoke-IcePackBridgeAction([string]$Endpoint, [hashtable]$Body = @{}) {
    if ($streamer -and $null -ne $script:managedProcess) { throw 'Wait for Companion to finish starting or stopping.' }
    . (Join-Path $PSScriptRoot 'IcePack-ManagedCommon.ps1')
    $definition = Get-IcePackServiceDefinition 'bridge' $settings
    if (-not (Test-IcePackOwnedProcess (Read-IcePackOwnedRecord 'bridge') $definition) -or
        ($streamer -and -not (Test-IcePackServiceOwned 'engine'))) {
        throw 'Start Companion from Operations Center first.'
    }
    Invoke-IcePackBridgePost $Endpoint (Read-IcePackBridgeToken) $Body
}
if ($streamer) {
    $serverButton.Add_Click({
        $dialog = [System.Windows.Forms.Form]::new()
        try {
            $dialog.Text = 'Set ARK Server'
            $dialog.ClientSize = [System.Drawing.Size]::new(400, 290)
            $dialog.FormBorderStyle = 'FixedDialog'
            $dialog.StartPosition = 'CenterParent'
            $dialog.MaximizeBox = $false
            $dialog.MinimizeBox = $false
            $dialog.BackColor = $theme.Surface
            $dialog.ForeColor = $theme.Foreground
            $dialog.Font = $form.Font
            $stack = New-Stack
            $stack.Padding = [System.Windows.Forms.Padding]::new(16)
            $dialog.Controls.Add($stack)
            $saved = $null
            try { $saved = Read-IcePackServerSettings } catch {}
            $fields = @{}
            foreach ($label in @('RCON host', 'RCON port', 'RCON password')) {
                Add-Row $stack (New-Text $label 10 $true $theme.Foreground)
                $field = [System.Windows.Forms.TextBox]::new()
                $field.Dock = 'Top'
                $field.Margin = [System.Windows.Forms.Padding]::new(0, 0, 0, 10)
                Add-Row $stack $field
                $fields[$label] = $field
            }
            $fields['RCON password'].UseSystemPasswordChar = $true
            if ($null -ne $saved) {
                $fields['RCON host'].Text = $saved.host
                $fields['RCON port'].Text = [string]$saved.port
                Add-Row $stack (New-Text 'Leave the password blank to keep the saved password.' 9 $false $theme.Muted)
            }
            $save = New-ActionButton 'Save' 'Primary'
            $save.DialogResult = 'OK'
            $cancel = New-ActionButton 'Cancel'
            $cancel.DialogResult = 'Cancel'
            Add-ActionRow $stack @($save, $cancel)
            $dialog.AcceptButton = $save
            $dialog.CancelButton = $cancel
            while ($dialog.ShowDialog($form) -eq 'OK') {
                try {
                    if ($fields['RCON port'].Text.Trim() -notmatch '^\d{1,5}$') { throw 'Enter a numeric RCON port.' }
                    Save-IcePackServerSettings $fields['RCON host'].Text.Trim() ([int]$fields['RCON port'].Text) $fields['RCON password'].Text
                    Refresh-IcePackStatus
                    break
                } catch {
                    [void][System.Windows.Forms.MessageBox]::Show($form, $_.Exception.Message, 'ARK server settings', 'OK', 'Warning')
                }
            }
        } finally { $dialog.Dispose() }
    })
}
$armGiftTestButton.Add_Click({
    try {
        $useHosted = $streamer
        if ($streamer) {
            $localConfigured = $false
            try { $localConfigured = $null -ne (Read-IcePackServerSettings) } catch {}
            if ($localConfigured) {
                $routeMessage = "Use your Northpath server approval?`nYes for Hosted Rose test. No for direct ARK connection."
                $route = [System.Windows.Forms.MessageBox]::Show($form, $routeMessage, 'TikFinity test route', 'YesNoCancel', 'Question', 'Button1')
                if ($route -eq 'Cancel') { return }
                $useHosted = $route -eq 'Yes'
            }
        }
        if ($useHosted) {
            $target = Invoke-IcePackBridgeAction 'operations/hosted-test-target'
            if (-not $target.enabled) { throw 'The Northpath website has not enabled hosted tests. Check the website relay configuration.' }
            $confirm = "Allow one TikFinity test to send 5 Stone to survivor $($target.survivorId) on $($target.serverName)? The test expires after two minutes."
            if ([System.Windows.Forms.MessageBox]::Show($form, $confirm, 'Arm hosted Rose test', 'YesNo', 'Question', 'Button2') -ne 'Yes') { return }
            $result = Invoke-IcePackBridgeAction 'operations/arm-hosted-tikfinity-test' @{
                serverId = $target.serverId; survivorId = $target.survivorId; confirmation = 'ARM HOSTED ROSE'
            }
        } else {
            Add-Type -AssemblyName Microsoft.VisualBasic
            $gift = [Microsoft.VisualBasic.Interaction]::InputBox(
                'Enter the name or ID of an enabled rule with one reward command.', 'Arm TikFinity test gift'
            ).Trim()
            if (-not $gift) { return }
            $confirm = "Allow one TikFinity action to send the $gift reward to your saved survivor in ARK? The test expires after two minutes."
            if ([System.Windows.Forms.MessageBox]::Show($form, $confirm, 'Arm TikFinity test gift', 'YesNo', 'Question', 'Button2') -ne 'Yes') { return }
            $result = Invoke-IcePackBridgeAction 'operations/arm-tikfinity-test' @{ gift = $gift; confirmation = 'ARM TIKFINITY TEST' }
        }
        Refresh-IcePackStatus
        $statusLabel.Text = $result.message
        [void][System.Windows.Forms.MessageBox]::Show($form, $result.message, 'TikFinity test gift', 'OK', 'Information')
    } catch {
        [void][System.Windows.Forms.MessageBox]::Show($form, $_.Exception.Message, 'TikFinity test gift', 'OK', 'Warning')
    }
})
if (-not $streamer) {
    $giftTestStatusButton.Add_Click({
        try {
            $result = Invoke-IcePackBridgeAction 'operations/tikfinity-test-status'
            [void][System.Windows.Forms.MessageBox]::Show($form, $result.message, 'TikFinity test gift', 'OK', 'Information')
        } catch {
            [void][System.Windows.Forms.MessageBox]::Show($form, $_.Exception.Message, 'TikFinity test gift', 'OK', 'Warning')
        }
    })
}

$survivorButton.Add_Click({
    Add-Type -AssemblyName Microsoft.VisualBasic
    $survivorId = [Microsoft.VisualBasic.Interaction]::InputBox(
        'Enter the numeric Specimen Implant ID for your survivor. The ID is saved to your local ARK Engine.',
        'Set Survivor ID'
    ).Trim()
    if (-not $survivorId) { return }
    try {
        $result = Invoke-IcePackBridgeAction 'target/save' @{ playerId = $survivorId }
        if (-not $result.ok) { throw 'The engine did not confirm the Survivor ID.' }
        Refresh-IcePackStatus
        $statusLabel.Text = 'Survivor ID saved and loaded by the ARK Engine.'
    } catch {
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Could not save Survivor ID', 'OK', 'Warning') | Out-Null
    }
})
$websiteCodeButton.Add_Click({
    try {
        $result = Invoke-IcePackBridgeAction 'website/connect'
        if ($result.pairingCode -cnotmatch '^[0-9a-f]{64}$') { throw 'Restart Companion to load the updated bridge.' }
        [System.Windows.Forms.Clipboard]::SetText($result.pairingCode)
        $statusLabel.Text = 'Website pairing code copied. Paste it in Northpath Connections.'
    } catch {
        [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Website pairing unavailable', 'OK', 'Warning') | Out-Null
    }
})

function Invoke-IcePackAccountSyncAction([string]$Command) {
    try {
        $result = Invoke-IcePackBridgeAction "operations/$Command"
        [void][System.Windows.Forms.MessageBox]::Show($form, $result.message, 'Northpath account sync', 'OK', 'Information')
    } catch {
        [void][System.Windows.Forms.MessageBox]::Show($form, $_.Exception.Message, 'Northpath account sync', 'OK', 'Warning')
    }
}
function Enable-IcePackAccountSync {
    $message = 'Use the saved Northpath draft to manage matching local Gift Rules and Kits? Saving to your account will update those entries once gift lanes are idle. Local-only entries are kept.'
    if ([System.Windows.Forms.MessageBox]::Show($form, $message, 'Enable account sync', 'YesNo', 'Question', 'Button2') -eq 'Yes') {
        Invoke-IcePackAccountSyncAction 'enable-account-sync'
    }
}
if ($streamer) {
    $syncButton.Add_Click({
        if ($script:syncEnabled) { Invoke-IcePackAccountSyncAction 'disable-account-sync' }
        else { Enable-IcePackAccountSync }
        Refresh-IcePackStatus
    })
} else {
    $websiteButton.Add_Click({ Start-Process 'https://northpath.ai/companion#connections' })
    $enableAccountSyncButton.Add_Click({ Enable-IcePackAccountSync })
    $disableAccountSyncButton.Add_Click({ Invoke-IcePackAccountSyncAction 'disable-account-sync' })
    $checkAccountSyncButton.Add_Click({ Invoke-IcePackAccountSyncAction 'account-sync-status' })
}
function Format-IcePackRule($Rule) {
    if ($null -eq $Rule) { return 'No matching local rule' }
    $gift = if ($Rule.giftName) { [string]$Rule.giftName } else { "Gift $($Rule.giftId)" }
    if ($Rule.giftName -and $Rule.giftId) { $gift += " (ID $($Rule.giftId))" }
    $reward = $Rule.reward
    $description = switch ($reward.type) {
        'kit' { "Kit $($reward.kitId)" }
        'item' { "Give $($reward.quantity) x $($reward.itemId)" }
        'dinosaur' { "Spawn $($reward.quantity) x $($reward.status) $($reward.creatureId), level $($reward.level)" }
    }
    $enabled = if ($Rule.enabled) { 'enabled' } else { 'disabled' }
    return "$gift - $description ($enabled, $($Rule.cooldown)s cooldown)"
}
if (-not $streamer) {
    $reviewWebsiteRuleButton.Add_Click({
        Add-Type -AssemblyName Microsoft.VisualBasic
        $gift = [Microsoft.VisualBasic.Interaction]::InputBox(
            'Enter a gift name or ID from the draft saved to your Northpath account.', 'Review website rule'
        ).Trim()
        if (-not $gift) { return }
        try {
            $review = Invoke-IcePackBridgeAction 'operations/review-rule' @{ gift = $gift }
            $current = Format-IcePackRule $review.previous
            $proposed = Format-IcePackRule $review.rule
            $summary = "Current rule`n$current`n`nProposed rule`n$proposed"
            if ($review.applyBlock) {
                $message = "$summary`n`n$($review.applyBlock)`nUse Stop Custom Rules in Operational readiness, then review the rule again to apply it."
                [void][System.Windows.Forms.MessageBox]::Show($form, $message, 'Website rule review', 'OK', 'Information')
                return
            }
            $message = "$summary`n`nApply this rule to the local ARK Engine? A recovery snapshot is saved first."
            if ([System.Windows.Forms.MessageBox]::Show($form, $message, 'Approve website rule', 'YesNo', 'Question', 'Button2') -ne 'Yes') { return }
            $applied = Invoke-IcePackBridgeAction 'operations/apply-rule' @{ reviewId = $review.reviewId }
            [void][System.Windows.Forms.MessageBox]::Show($form,
                "Rule applied and loaded.`nRecovery snapshot $($applied.recoverySnapshot)", 'Website rule applied', 'OK', 'Information')
            Refresh-IcePackStatus
        } catch {
            [void][System.Windows.Forms.MessageBox]::Show($form, $_.Exception.Message, 'Website rule unavailable', 'OK', 'Warning')
        }
    })
}

$liveButton.Add_Click({
    if ($script:stopRules) {
        try {
            Invoke-IcePackBridgeAction 'operations/stop-live' | Out-Null
            Refresh-IcePackStatus
            $statusLabel.Text = 'Live Rewards stopped.'
        } catch {
            [void][System.Windows.Forms.MessageBox]::Show($form, $_.Exception.Message, 'Could not stop Custom Gift Rules', 'OK', 'Warning')
        }
        return
    }
    try {
        $useHosted = $streamer
        if ($streamer) {
            $localConfigured = $false
            try { $localConfigured = $null -ne (Read-IcePackServerSettings) } catch {}
            if ($localConfigured) {
                $route = [System.Windows.Forms.MessageBox]::Show($form,
                    "Use your Northpath server approval?`nYes for Hosted Live Rewards. No for direct ARK connection.",
                    'Live Rewards route', 'YesNoCancel', 'Question', 'Button1')
                if ($route -eq 'Cancel') { return }
                $useHosted = $route -eq 'Yes'
            }
        }
        if ($useHosted) {
            $target = Invoke-IcePackBridgeAction 'operations/hosted-test-target'
            if (-not $target.enabled -or -not $target.liveRoseEnabled) { throw 'The owner must allow live Rose rewards in Northpath Connections.' }
            $message = "Start live Rose rewards for survivor $($target.survivorId) on $($target.serverName)? An accepted Rose gift or completed streak delivers 5 Stone."
            if ([System.Windows.Forms.MessageBox]::Show($form, $message, 'Start Hosted Live Rewards', 'YesNo', 'Warning', 'Button2') -ne 'Yes') { return }
            Invoke-IcePackBridgeAction 'operations/start-hosted-live' @{
                confirmation = 'START HOSTED ROSE'; serverId = $target.serverId; survivorId = $target.survivorId
            } | Out-Null
        } else {
            $message = 'Enable Live Custom Rules? Incoming matching gifts can deliver rewards to your saved survivor.'
            if ([System.Windows.Forms.MessageBox]::Show($form, $message, 'Enable Live Custom Rules', 'YesNo', 'Warning', 'Button2') -ne 'Yes') { return }
            Invoke-IcePackBridgeAction 'operations/enable-live' @{ confirmation = 'ENABLE LIVE CUSTOM RULES' } | Out-Null
        }
        Refresh-IcePackStatus
        $statusLabel.Text = 'Live Rewards enabled.'
    } catch {
        [void][System.Windows.Forms.MessageBox]::Show($form, $_.Exception.Message, 'Live Custom Rules unavailable', 'OK', 'Warning')
    }
})
if (-not $streamer) {
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
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 10000
$timer.Add_Tick({
    # Service refresh stays active during managed startup/shutdown.
    try { Refresh-IcePackStatus } catch { $statusLabel.Text = 'Status check failed. Retrying shortly.' }
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
try { [void]$form.ShowDialog() }
finally { if ($streamer) { $appMutex.Dispose() } }
