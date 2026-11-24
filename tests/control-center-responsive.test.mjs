import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const ui=fs.readFileSync(new URL('../scripts/Open-IcePackControlCenter.ps1',import.meta.url),'utf8');
test('managed action never synchronously waits on UI thread',()=>{assert.doesNotMatch(ui,/\.WaitForExit\s*\(/);assert.match(ui,/managedActionTimer\.Add_Tick/);});
test('redirected output drained asynchronously',()=>{assert.match(ui,/StandardOutput\.ReadToEndAsync\(\)/);assert.match(ui,/StandardError\.ReadToEndAsync\(\)/);});
test('the Companion toggle is disabled during a managed action and restored on completion',()=>{
 assert.match(ui,/Set-ActionToggle \$companionButton \$script:hasOwnedService 'Start Companion' 'Stop Companion'/);
 assert.match(ui,/\$companionButton\.Enabled\s*=\s*\$false/);
 assert.match(ui,/\$companionButton\.Enabled\s*=\s*\$true/);
});
test('status refresh happens on completion and interval',()=>{assert.match(ui,/Finish-IcePackManagedAction/);assert.match(ui,/Refresh-IcePackStatus/);assert.match(ui,/\$timer\.Interval\s*=\s*10000/);});
test('timeout warns without retries, killing process or blocking UI',()=>{assert.match(ui,/elapsed -ge 45/);assert.doesNotMatch(ui,/\.Kill\s*\(/);assert.match(ui,/No retry or termination performed/);});
