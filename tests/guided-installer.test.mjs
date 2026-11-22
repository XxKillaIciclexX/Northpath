import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const source=fs.readFileSync(path.resolve(import.meta.dirname,'../scripts/Open-IcePackInstallWizard.ps1'),'utf8');
test('uses existing, tested v2.8 readiness, preflight, and update manager',()=>{
 for(const name of ['Get-IcePackMigrationReadiness.ps1','Test-IcePackInstallCompatibility.ps1','Export-IcePackMigrationPlan.ps1','Open-IcePackUpdateManager.ps1']) assert.ok(source.includes(name));
});
test('does not install or modify runtime files',()=>{
 for(const unsafe of ['Copy-Item','Remove-Item','Stop-Process','Set-Content','WriteAllBytes','/custom-rules-mode','RCON_PASSWORD']) assert.ok(!source.includes(unsafe),unsafe);
});
test('requires both verified checks to open the updater',()=>{
 assert.match(source,/\$updateButton.Enabled=\(\$script:readinessOk -and \$script:compatOk\)/);
 assert.match(source,/Ready for installer planning:/);
});
test('report export requires consent',()=>{
 assert.match(source,/Confirm report export/);
 assert.match(source,/'-SaveReport'/);
});
test('does not wait synchronously for service commands',()=>{
 assert.doesNotMatch(source,/WaitForExit\s*\(/);
 assert.match(source,/HasExited/);
});
