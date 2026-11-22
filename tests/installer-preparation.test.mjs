import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const scripts=path.resolve(import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),'../scripts');
const readiness=fs.readFileSync(path.join(scripts,'Get-IcePackMigrationReadiness.ps1'),'utf8');
const plan=fs.readFileSync(path.join(scripts,'Export-IcePackMigrationPlan.ps1'),'utf8');
test('readiness script does not mutate files or processes',()=>{
  for(const forbidden of [/Stop-Process\b/i,/Start-Process\b/i,/Remove-Item\b/i,/Set-Content\b/i,/WriteAllText\s*\(/i,/\bInvoke-RestMethod\b/i]) assert.doesNotMatch(readiness,forbidden);
});
test('readiness checks all three components and existing update protections',()=>{
  for(const expected of ['server.mjs','bridge.mjs','companion\\package.json','Start-IcePackCompanionManaged.ps1','Restore-IcePackUpdate.ps1','rules-v06.json']) assert.ok(readiness.includes(expected),expected);
});
test('readiness never reads secrets or player-target file contents',()=>{
  assert.doesNotMatch(readiness,/ReadAllText\([^\n]*\.env/i);
  assert.doesNotMatch(readiness,/Get-Content\s+[^\n]*(rules-v06|\.env)/i);
  assert.ok(readiness.includes('Never migrate automatically'));
});
test('report is opt-in and preserves dry run',()=>{
  assert.match(plan,/\[switch\]\$SaveReport/);
  assert.match(plan,/if \(-not \$SaveReport\)/);
  assert.match(plan,/WriteAllText\(\$destination/);
  assert.doesNotMatch(plan,/Start-Process|Stop-Process|Copy-Item|Move-Item/i);
});
test('both scripts identify JSON schema and BOM-safe settings reader',()=>{
  assert.match(readiness,/Schema=1/);
  assert.match(readiness,/TrimStart\(\[char\]0xFEFF\)/);
  assert.match(plan,/report.Schema -ne 1/);
});
