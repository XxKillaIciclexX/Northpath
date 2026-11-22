import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const gui=fs.readFileSync(path.join(root,'scripts/Open-IcePackUpdateManager.ps1'),'utf8');
const cc=fs.readFileSync(path.join(root,'scripts/Open-IcePackControlCenter.ps1'),'utf8');
test('uses existing vetted v2.4 installer, rollback and history',()=>{
  for(const s of ['Install-IcePackUpdate.ps1','Restore-IcePackUpdate.ps1','Get-IcePackUpdateHistory.ps1','IcePack-UpdateCommon.ps1']) assert.ok(gui.includes(s));
});
test('apply buttons disabled until successful dry run',()=>{
  assert.match(gui,/\$install\.Enabled=\$false/);
  assert.match(gui,/\$applyRollback\.Enabled=\$false/);
  assert.match(gui,/\$script:previewedInstall=\$script:operationTarget/);
  assert.match(gui,/\$script:previewedRollback=\$script:operationTarget/);
  assert.match(gui,/\$package\.Add_TextChanged\(\{\$script:previewedInstall=''/);
  assert.match(gui,/\$rollbackId\.Add_TextChanged\(\{\$script:previewedRollback=''/);
});
test('confirmed operations use explicit underlying switches',()=>{
  assert.match(gui,/Confirm code installation/);
  assert.match(gui,/Confirm code rollback/);
  assert.match(gui,/'-Apply'/);
  assert.match(gui,/'-ConfirmRollback'/);
});
test('background subprocess drains streams without WaitForExit on UI thread',()=>{
  assert.match(gui,/ReadToEndAsync\(\)/);
  assert.match(gui,/Windows\.Forms\.Timer/);
  assert.doesNotMatch(gui,/\.WaitForExit\(/);
  assert.match(gui,/\$script:busy/);
});
test('Control Center adds GUI entry without replacing management controls',()=>{
  assert.match(cc,/Open-IcePackUpdateManager\.ps1/);
  assert.match(cc,/Start-IcePackCompanionManaged\.ps1/);
  assert.match(cc,/Stop-IcePackCompanionManaged\.ps1/);
  assert.match(cc,/Copy-IcePackBridgeToken\.ps1/);
});
test('no direct changes to live engine or RCON paths',()=>{
  assert.doesNotMatch(gui,/(fetch\(|rcon-client|ScriptCommand IcePackSpawn|\/custom-rules-mode)/);
});
