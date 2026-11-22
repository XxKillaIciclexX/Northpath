[CmdletBinding()]param()
$root=Join-Path $env:LOCALAPPDATA 'IcePackCompanion\updates'
if(-not(Test-Path -LiteralPath $root)){Write-Host 'No local code updates recorded.';exit 0}
Get-ChildItem -LiteralPath $root -Directory | ForEach-Object {
    $p=Join-Path $_.FullName 'record.json'
    if(Test-Path -LiteralPath $p){
        try {$r=[IO.File]::ReadAllText($p,[Text.Encoding]::UTF8).TrimStart([char]0xFEFF)|ConvertFrom-Json
        [pscustomobject]@{Id=$r.id;Version=$r.version;State=$r.state;Files=@($r.files).Count}}
        catch {Write-Warning "Cannot read update record $($_.Name)"}
    }
} | Format-Table -AutoSize
