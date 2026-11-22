import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load = name => readFileSync(new URL(`../scripts/${name}`,import.meta.url),'utf8');
test('baseline tracks fixed allowlisted application code, not credentials or player data',()=>{
 const source=load('IcePack-BaselineCommon.ps1');
 assert.match(source,/IcePackBaselinePaths/);
 assert.match(source,/Get-FileHash -LiteralPath \$dest -Algorithm SHA256/);
 assert.doesNotMatch(source,/['"](?:\.env|rules-v06\.json|settings\.json)['"]\s*,/);
 assert.match(source,/Linked application path refused/);
});
test('baseline registration is opt-in and preserves old baseline when replacing',()=>{
 const s=load('Register-IcePackInstallationBaseline.ps1');
 assert.match(s,/if\(-not \$ConfirmBaseline\)/);
 assert.match(s,/if\(\$existing -and -not \$Replace\)/);
 assert.match(s,/\[IO\.File\]::Replace\(\$tmp,\$script:IcePackBaselineFile,\$prior\)/);
 assert.match(s,/source='observed-local-files'/);
});
test('status report is read-only and explicitly refuses to infer verified version',()=>{
 const s=load('Get-IcePackVersionStatus.ps1');
 assert.match(s,/Unverified \(manual overlays not identifiable by version\)/);
 assert.match(s,/Read-IcePackBaseline/);
 assert.doesNotMatch(s,/\b(WriteAllText|Copy-Item|Remove-Item|Start-Process|Stop-Process)\b/);
});
test('preflight reads prerequisites only and does not start or stop services',()=>{
 const s=load('Test-IcePackInstallCompatibility.ps1');
 assert.match(s,/Node\.js 20\+/);
 assert.match(s,/npm available/);
 assert.doesNotMatch(s,/\b(WriteAllText|Copy-Item|Remove-Item|Start-Process|Stop-Process)\b/);
});
test('Control Center opens version report outside its responsive UI loop',()=>{
 const s=load('Open-IcePackControlCenter.ps1');
 assert.match(s,/Version \/ baseline status/);
 assert.match(s,/Open-PowerShellScript \$script/);
 assert.doesNotMatch(s,/WaitForExit\(/);
});
