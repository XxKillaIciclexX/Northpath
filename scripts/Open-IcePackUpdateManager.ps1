# Ice Pack Companion v2.5 - GUI for the verified v2.4 local update/rollback scripts.
# Dry-run must succeed in this session before applying. All scripts run in child processes.
[CmdletBinding()]param()
$ErrorActionPreference = 'Stop'
if ([Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') {
    & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -File $PSCommandPath
    exit $LASTEXITCODE
}
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$installer = Join-Path $PSScriptRoot 'Install-IcePackUpdate.ps1'
$restorer = Join-Path $PSScriptRoot 'Restore-IcePackUpdate.ps1'
$history = Join-Path $PSScriptRoot 'Get-IcePackUpdateHistory.ps1'
foreach ($path in @($installer,$restorer,$history,(Join-Path $PSScriptRoot 'IcePack-UpdateCommon.ps1'))) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing update support script: $path" }
}
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Ice Pack Companion - Update Manager'
$form.Size = New-Object Drawing.Size(810,700)
$form.MinimumSize = New-Object Drawing.Size(810,700)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [Drawing.Color]::FromArgb(15,23,42)
$form.ForeColor = [Drawing.Color]::White
$form.Font = New-Object Drawing.Font('Segoe UI',10)
function Add-UpdateLabel([string]$caption,[int]$x,[int]$y,[int]$w,[int]$h) {
    $v = New-Object Windows.Forms.Label
    $v.Text=$caption;$v.SetBounds($x,$y,$w,$h)
    $v.ForeColor=[Drawing.Color]::White
    $form.Controls.Add($v)
    return $v
}
function Add-UpdateButton([string]$caption,[int]$x,[int]$y,[int]$w,[int]$h) {
    $v=New-Object Windows.Forms.Button
    $v.Text=$caption;$v.SetBounds($x,$y,$w,$h)
    $v.FlatStyle='Flat';$v.FlatAppearance.BorderSize=1
    $v.FlatAppearance.BorderColor=[Drawing.Color]::FromArgb(71,85,105)
    $v.BackColor=[Drawing.Color]::FromArgb(30,41,59)
    $v.ForeColor=[Drawing.Color]::White
    $form.Controls.Add($v)
    return $v
}
$null=Add-UpdateLabel 'LOCAL UPDATE MANAGER' 24 15 720 36
$null=Add-UpdateLabel 'Choose an extracted package folder containing icepack-update.json. Never select the repository itself.' 24 51 740 34
$package=New-Object Windows.Forms.TextBox
$package.SetBounds(24,92,580,30)
$form.Controls.Add($package)
$browse=Add-UpdateButton 'Browse folder' 622 90 150 33
$preview=Add-UpdateButton 'Preview installation' 24 138 190 39
$install=Add-UpdateButton 'Install (confirmed)' 224 138 190 39
$null=Add-UpdateLabel 'Rollback ID (from Update History):' 24 201 355 27
$rollbackId=New-Object Windows.Forms.TextBox
$rollbackId.SetBounds(24,232,425,30)
$form.Controls.Add($rollbackId)
$previewRollback=Add-UpdateButton 'Preview rollback' 24 277 190 39
$applyRollback=Add-UpdateButton 'Rollback (confirmed)' 224 277 190 39
$showHistory=Add-UpdateButton 'Update history' 474 277 180 39
$null=Add-UpdateLabel 'Services on ports 3210, 3212 and 5173 must be STOPPED before installing or rolling back.' 24 340 748 30
$status=Add-UpdateLabel 'Ready. Always preview before applying.' 24 382 746 30
$output=New-Object Windows.Forms.TextBox
$output.SetBounds(24,418,748,204)
$output.Multiline=$true;$output.ScrollBars='Vertical';$output.ReadOnly=$true
$output.WordWrap=$false
$output.Font=New-Object Drawing.Font('Consolas',9)
$output.BackColor=[Drawing.Color]::FromArgb(2,6,23)
$output.ForeColor=[Drawing.Color]::FromArgb(226,232,240)
$form.Controls.Add($output)
$install.Enabled=$false
$applyRollback.Enabled=$false
$script:busy=$false
$script:proc=$null
$script:stdout=$null
$script:stderr=$null
$script:operation=''
$script:operationTarget=''
$script:previewedInstall=''
$script:previewedRollback=''
$script:started=[datetime]::MinValue
$script:warned=$false
$timer=New-Object Windows.Forms.Timer
$timer.Interval=250
function Refresh-Buttons {
    $browse.Enabled=-not $script:busy
    $preview.Enabled=-not $script:busy
    $previewRollback.Enabled=-not $script:busy
    $showHistory.Enabled=-not $script:busy
    $install.Enabled=(-not $script:busy -and $script:previewedInstall -ne '' -and $package.Text.Trim() -eq $script:previewedInstall)
    $applyRollback.Enabled=(-not $script:busy -and $script:previewedRollback -ne '' -and $rollbackId.Text.Trim() -eq $script:previewedRollback)
}
function Invoke-UpdateChild([string]$operation,[string]$scriptName,[string[]]$arguments,[string]$target) {
    if($script:busy){throw 'Another update operation is still running.'}
    $path=Join-Path $PSScriptRoot $scriptName
    # Quote only user-selected values; no shell evaluation and no execution of package content.
    $quoted=@('-NoProfile','-ExecutionPolicy','Bypass','-File',('"'+$path+'"'))
    foreach($arg in $arguments){
        if($arg -match '^-(Apply|ConfirmRollback)$'){$quoted+=$arg}
        else{$quoted+=('"'+$arg.Replace('"','')+'"')}
    }
    $si=New-Object Diagnostics.ProcessStartInfo
    $si.FileName="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $si.Arguments=$quoted -join ' '
    $si.WorkingDirectory=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
    $si.UseShellExecute=$false;$si.CreateNoWindow=$true
    $si.RedirectStandardOutput=$true;$si.RedirectStandardError=$true
    $p=New-Object Diagnostics.Process
    $p.StartInfo=$si
    try {
        [void]$p.Start()
        $script:stdout=$p.StandardOutput.ReadToEndAsync()
        $script:stderr=$p.StandardError.ReadToEndAsync()
        $script:proc=$p
        $script:operation=$operation
        $script:operationTarget=$target
        $script:started=[datetime]::UtcNow
        $script:warned=$false
        $script:busy=$true
        $status.Text="Running $operation (window remains responsive)..."
        $output.Text="Running $operation..."
        Refresh-Buttons
        $timer.Start()
    } catch {$p.Dispose();throw}
}
$timer.Add_Tick({
    if($null -eq $script:proc){$timer.Stop();return}
    if($script:proc.HasExited -and $script:stdout.IsCompleted -and $script:stderr.IsCompleted){
        $timer.Stop()
        try {
            $code=$script:proc.ExitCode
            $messages=($script:stdout.GetAwaiter().GetResult()+[Environment]::NewLine+$script:stderr.GetAwaiter().GetResult()).Trim()
            $output.Text=$messages
            if($code -eq 0){
                $status.Text="$($script:operation): completed successfully."
                if($script:operation -eq 'preview-install'){$script:previewedInstall=$script:operationTarget}
                if($script:operation -eq 'preview-rollback'){$script:previewedRollback=$script:operationTarget}
                if($script:operation -eq 'install' -or $script:operation -eq 'rollback'){
                    $script:previewedInstall='';$script:previewedRollback=''
                }
            }else{
                $status.Text="$($script:operation) FAILED (exit $code). See output."
                if($script:operation -like '*install*'){$script:previewedInstall=''}
                if($script:operation -like '*rollback*'){$script:previewedRollback=''}
            }
        }catch{$status.Text="Cannot read update result: $($_.Exception.Message)"}
        finally{$script:proc.Dispose();$script:proc=$null;$script:busy=$false;Refresh-Buttons}
    }elseif (([datetime]::UtcNow-$script:started).TotalSeconds -gt 60 -and -not $script:warned){
        $script:warned=$true
        $status.Text='Still running. Do not start another operation. Check logs if needed.'
    }
})
$browse.Add_Click({
    $dlg=New-Object Windows.Forms.FolderBrowserDialog
    $dlg.Description='Select extracted Ice Pack update package folder (with icepack-update.json)'
    if($dlg.ShowDialog($form) -eq 'OK'){$package.Text=$dlg.SelectedPath}
    $dlg.Dispose()
})
$package.Add_TextChanged({$script:previewedInstall='';Refresh-Buttons})
$rollbackId.Add_TextChanged({$script:previewedRollback='';Refresh-Buttons})
$preview.Add_Click({
    try {
        $dir=(Resolve-Path -LiteralPath $package.Text.Trim() -ErrorAction Stop).ProviderPath
        if(-not(Test-Path -LiteralPath (Join-Path $dir 'icepack-update.json') -PathType Leaf)){throw 'Choose the package folder containing icepack-update.json.'}
        Invoke-UpdateChild 'preview-install' 'Install-IcePackUpdate.ps1' @('-PackagePath',$dir) $dir
    }catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Preview unavailable','OK','Warning')|Out-Null}
})
$install.Add_Click({
    $dir=$package.Text.Trim()
    if($script:previewedInstall -ne $dir){return}
    if([Windows.Forms.MessageBox]::Show("Install the PREVIEWED local update?`n`nAll Companion services must be stopped. The installer will verify this again and create rollback files.",'Confirm code installation','YesNo','Warning') -ne 'Yes'){return}
    try {Invoke-UpdateChild 'install' 'Install-IcePackUpdate.ps1' @('-PackagePath',$dir,'-Apply') $dir}
    catch {[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Install unavailable','OK','Warning')|Out-Null}
})
$previewRollback.Add_Click({
    try {
        $id=$rollbackId.Text.Trim()
        if($id -notmatch '^\d{8}-\d{6}-[a-fA-F0-9]{8}$'){throw 'Enter an update ID from Update History.'}
        Invoke-UpdateChild 'preview-rollback' 'Restore-IcePackUpdate.ps1' @('-Id',$id) $id
    }catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Rollback preview unavailable','OK','Warning')|Out-Null}
})
$applyRollback.Add_Click({
    $id=$rollbackId.Text.Trim()
    if($script:previewedRollback -ne $id){return}
    if([Windows.Forms.MessageBox]::Show("ROLL BACK update $id?`n`nServices must be stopped. Files modified since installation are protected against overwrite.",'Confirm code rollback','YesNo','Warning') -ne 'Yes'){return}
    try {Invoke-UpdateChild 'rollback' 'Restore-IcePackUpdate.ps1' @('-Id',$id,'-ConfirmRollback') $id}
    catch {[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Rollback unavailable','OK','Warning')|Out-Null}
})
$showHistory.Add_Click({
    try{Invoke-UpdateChild 'history' 'Get-IcePackUpdateHistory.ps1' @() ''}
    catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Update history','OK','Warning')|Out-Null}
})
$form.Add_FormClosing({
    if($script:busy){
        [Windows.Forms.MessageBox]::Show('An update operation is running. Leave this window open until it finishes.','Update running','OK','Warning')|Out-Null
        $_.Cancel=$true
    }
})
$form.Add_FormClosed({$timer.Stop();$timer.Dispose()})
Refresh-Buttons
[void]$form.ShowDialog()
