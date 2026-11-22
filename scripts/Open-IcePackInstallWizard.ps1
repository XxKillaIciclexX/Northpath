# Ice Pack Companion v2.9 Alpha — guided installation assessment.
# No code installation, services manipulation, or configuration mutation occurs here.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
if ([Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') {
  & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -ExecutionPolicy Bypass -File $PSCommandPath
  exit $LASTEXITCODE
}
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$readinessScript=Join-Path $PSScriptRoot 'Get-IcePackMigrationReadiness.ps1'
$compatibilityScript=Join-Path $PSScriptRoot 'Test-IcePackInstallCompatibility.ps1'
$exportScript=Join-Path $PSScriptRoot 'Export-IcePackMigrationPlan.ps1'
$managerScript=Join-Path $PSScriptRoot 'Open-IcePackUpdateManager.ps1'
foreach($path in @($readinessScript,$compatibilityScript,$exportScript,$managerScript)) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Missing required v2.4-v2.8 script: $path" }
}
$form=New-Object Windows.Forms.Form
$form.Text='Ice Pack Companion — Guided Installation (v2.9 Alpha)'
$form.Size=New-Object Drawing.Size(840,720)
$form.MinimumSize=New-Object Drawing.Size(780,650)
$form.StartPosition='CenterScreen'
$form.BackColor=[Drawing.Color]::FromArgb(15,23,42)
$form.ForeColor=[Drawing.Color]::White
$form.Font=New-Object Drawing.Font('Segoe UI',10)
$header=New-Object Windows.Forms.Label
$header.Text='INSTALLATION & MIGRATION READINESS'
$header.ForeColor=[Drawing.Color]::FromArgb(125,211,252)
$header.Font=New-Object Drawing.Font('Segoe UI',17,[Drawing.FontStyle]::Bold)
$header.SetBounds(18,16,790,44);$form.Controls.Add($header)
$note=New-Object Windows.Forms.Label
$note.Text='For existing installations: assess prerequisites, review protected data, then use the verified Update Manager.'
$note.SetBounds(20,65,790,50);$form.Controls.Add($note)
function New-ActionButton([string]$title,[int]$x,[int]$y,[int]$width) {
  $b=New-Object Windows.Forms.Button;$b.Text=$title;$b.SetBounds($x,$y,$width,41)
  $b.BackColor=[Drawing.Color]::FromArgb(30,64,85);$b.ForeColor=[Drawing.Color]::White
  $b.FlatStyle='Flat';$form.Controls.Add($b);return $b
}
$checkButton=New-ActionButton '1. Check readiness' 20 130 190
$compatButton=New-ActionButton '2. Check prerequisites' 222 130 190
$saveButton=New-ActionButton '3. Export report' 424 130 180
$updateButton=New-ActionButton 'Open Update Manager' 616 130 185
$updateButton.Enabled=$false
$status=New-Object Windows.Forms.Label
$status.SetBounds(20,184,780,46);$status.Text='No assessment completed. Run steps 1 and 2.'
$form.Controls.Add($status)
$output=New-Object Windows.Forms.TextBox
$output.Multiline=$true;$output.ReadOnly=$true;$output.ScrollBars='Both';$output.WordWrap=$false
$output.Font=New-Object Drawing.Font('Consolas',9)
$output.BackColor=[Drawing.Color]::FromArgb(11,26,42)
$output.ForeColor=[Drawing.Color]::FromArgb(226,232,240)
$output.SetBounds(20,237,780,365)
$output.Anchor=[Windows.Forms.AnchorStyles]'Top,Left,Right,Bottom';$form.Controls.Add($output)
$footer=New-Object Windows.Forms.Label
$footer.Text='Preview only. No service stops, code replacement, credential access, or Live activation. Export explicitly saves only non-secret paths and status.'
$footer.SetBounds(20,612,780,38)
$footer.Anchor=[Windows.Forms.AnchorStyles]'Bottom,Left,Right';$form.Controls.Add($footer)
$script:readinessOk=$false
$script:compatOk=$false
$script:operation=$null
$timer=New-Object Windows.Forms.Timer;$timer.Interval=200
function Begin-Assessment([string]$path,[string]$args,[string]$kind) {
  if ($null -ne $script:operation) { throw 'An assessment is already running' }
  $si=New-Object Diagnostics.ProcessStartInfo
  $si.FileName="$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $si.Arguments='-NoProfile -ExecutionPolicy Bypass -File "'+$path+'" '+$args
  $si.WorkingDirectory=(Split-Path -Parent $PSScriptRoot)
  $si.UseShellExecute=$false;$si.CreateNoWindow=$true
  $si.RedirectStandardOutput=$true;$si.RedirectStandardError=$true
  $proc=New-Object Diagnostics.Process;$proc.StartInfo=$si
  [void]$proc.Start()
  $script:operation=[pscustomobject]@{Process=$proc;Output=$proc.StandardOutput.ReadToEndAsync();Error=$proc.StandardError.ReadToEndAsync();Kind=$kind;Started=[datetime]::UtcNow}
  $checkButton.Enabled=$false;$compatButton.Enabled=$false;$saveButton.Enabled=$false;$updateButton.Enabled=$false
  $status.Text="Running $kind ...";$timer.Start()
}
$timer.Add_Tick({
  if ($null -eq $script:operation) { return }
  $op=$script:operation
  if (-not $op.Process.HasExited) {
    if (([datetime]::UtcNow - $op.Started).TotalSeconds -gt 60) { $status.Text='Still running. Do not launch another check.' }
    return
  }
  # Do not block the Windows Forms UI waiting for descendants' inherited handles.
  if (-not $op.Output.IsCompleted -or -not $op.Error.IsCompleted) {
    if (([datetime]::UtcNow - $op.Started).TotalSeconds -lt 10) { return }
    $output.AppendText("`r`nOutput stream has not closed; status may be incomplete.`r`n")
  }
  $code=$op.Process.ExitCode
  $content=if($op.Output.IsCompleted){$op.Output.Result}else{''}
  $err=if($op.Error.IsCompleted){$op.Error.Result}else{''}
  $output.Text="--- $($op.Kind) ---`r`n$content`r`n$err"
  if ($op.Kind -eq 'readiness') {
    $script:readinessOk=($code -eq 0 -and $content -match 'Ready for installer planning:\s*True')
  }
  if ($op.Kind -eq 'compatibility') { $script:compatOk=($code -eq 0 -and $err.Trim().Length -eq 0) }
  $status.Text=if($code -ne 0){"$($op.Kind) failed (exit $code); inspect details."}elseif($op.Kind -eq 'readiness' -and -not $script:readinessOk){'Installation has missing components; inspect readiness findings.'}else{"$($op.Kind) completed. Read the results before proceeding."}
  $op.Process.Dispose();$script:operation=$null;$timer.Stop()
  $checkButton.Enabled=$true;$compatButton.Enabled=$true;$saveButton.Enabled=$true
  $updateButton.Enabled=($script:readinessOk -and $script:compatOk)
})
$checkButton.Add_Click({try{Begin-Assessment $readinessScript '' 'readiness'}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message)|Out-Null}})
$compatButton.Add_Click({try{Begin-Assessment $compatibilityScript '' 'compatibility'}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message)|Out-Null}})
$saveButton.Add_Click({
  if ([Windows.Forms.MessageBox]::Show('Export a migration assessment containing local directory paths? It excludes credential contents.','Confirm report export','YesNo','Question') -ne 'Yes') {return}
  try{Begin-Assessment $exportScript '-SaveReport' 'report export'}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message)|Out-Null}
})
$updateButton.Add_Click({
  if (-not ($script:readinessOk -and $script:compatOk)) {return}
  if ([Windows.Forms.MessageBox]::Show('This opens the existing Update Manager. It will still require a validated package, preview, stopped services, and explicit install confirmation. Continue?','Open Update Manager','YesNo','Question') -ne 'Yes') {return}
  Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -ArgumentList @('-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',('"'+$managerScript+'"')) -WorkingDirectory (Split-Path -Parent $PSScriptRoot)
})
$form.Add_FormClosed({$timer.Stop();$timer.Dispose();if($null -ne $script:operation){$script:operation.Process.Dispose()}})
[void]$form.ShowDialog()
