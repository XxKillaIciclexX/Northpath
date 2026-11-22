import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const load = p => readFileSync(new URL(p,root),'utf8');
test('report never reads credential or player targeting files',()=>{
  const s=load('scripts/Get-IcePackInstallationReport.ps1');
  assert.doesNotMatch(s, /ReadAllText\([^\n]*(\.env|rules-v06\.json|pairing-token)/i);
  assert.match(s,/TrimStart\(\[char\]0xFEFF\)/);
});
test('package version is not presented as application version',()=>{
  const s=load('scripts/Get-IcePackInstallationReport.ps1');
  assert.match(s,/NOT the overall installed application version/);
  assert.match(s,/manual overlays not tracked/);
});
test('read-only report does not invoke updates, restarts or writes',()=>{
  const s=load('scripts/Get-IcePackInstallationReport.ps1');
  assert.doesNotMatch(s,/\b(Copy-Item|Remove-Item|Set-Content|WriteAllText|Start-Process|Invoke-RestMethod|Stop-Process)\b/);
});
test('Control Center opens report separately without blocking UI',()=>{
  const s=load('scripts/Open-IcePackControlCenter.ps1');
  assert.match(s,/View installation report/);
  assert.match(s,/Open-PowerShellScript \$script/);
  assert.doesNotMatch(s,/WaitForExit\(/);
});
