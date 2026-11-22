import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const ui=fs.readFileSync(new URL('../scripts/Open-IcePackControlCenter.ps1',import.meta.url),'utf8');
test('managed action never synchronously waits on UI thread',()=>{assert.doesNotMatch(ui,/\.WaitForExit\s*\(/);assert.match(ui,/managedActionTimer\.Add_Tick/);});
test('redirected output drained asynchronously',()=>{assert.match(ui,/StandardOutput\.ReadToEndAsync\(\)/);assert.match(ui,/StandardError\.ReadToEndAsync\(\)/);});
test('start and stop are disabled only during managed action',()=>{assert.match(ui,/quietStartButton\.Enabled\s*=\s*\$false/);assert.match(ui,/quietStopButton\.Enabled\s*=\s*\$false/);assert.match(ui,/quietStartButton\.Enabled\s*=\s*\$true/);assert.match(ui,/quietStopButton\.Enabled\s*=\s*\$true/);});
test('status refresh happens on completion and interval',()=>{assert.match(ui,/Finish-IcePackManagedAction/);assert.match(ui,/Refresh-IcePackStatus/);assert.match(ui,/\$timer\.Interval\s*=\s*10000/);});
test('timeout warns without retries, killing process or blocking UI',()=>{assert.match(ui,/elapsed -ge 45/);assert.doesNotMatch(ui,/\.Kill\s*\(/);assert.match(ui,/No retry or termination performed/);});
