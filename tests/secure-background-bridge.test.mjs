import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const bridge=read('companion/agent-bridge/bridge.mjs');
const shared=read('scripts/IcePack-ManagedCommon.ps1');
const launch=read('scripts/Start-IcePackBackground.ps1');
const stop=read('scripts/Stop-IcePackBackground.ps1');
const copy=read('scripts/Copy-IcePackBridgeToken.ps1');
const ui=read('scripts/Open-IcePackControlCenter.ps1');
test('managed bridge validates provided token and retains fresh token for manual startup',()=>{
 assert.match(bridge,/managedToken=process\.env\.ICEPACK_BRIDGE_PAIRING_TOKEN/);
 assert.match(bridge,/managedToken\?\?crypto\.randomBytes\(24\)/);
 assert.match(bridge,/\^\[0-9a-f\]\{48\}\$/);
});
test('managed bridge does not print token to logs',()=>{
 assert.match(bridge,/if\(managedToken\)\{console\.log\('Pairing token: use Copy bridge pairing token/);
 assert.match(bridge,/else\{console\.log\('Sync token for dashboard/);
});
test('token uses secure random bytes and DPAPI CurrentUser protection',()=>{
 assert.match(shared,/RandomNumberGenerator\]::Create\(\)/);
 assert.match(shared,/ProtectedData\]::Protect/);
 assert.match(shared,/DataProtectionScope\]::CurrentUser/);
 assert.doesNotMatch(shared,/Write-Host.*\$Token/);
});
test('bridge token is passed using process environment, not arguments',()=>{
 assert.match(launch,/SetEnvironmentVariable\('ICEPACK_BRIDGE_PAIRING_TOKEN',\$token,'Process'\)/);
 assert.match(launch,/SetEnvironmentVariable\('ICEPACK_BRIDGE_PAIRING_TOKEN',\$oldToken,'Process'\)/);
 assert.doesNotMatch(launch,/ArgumentList[^\n]*\$token/);
});
test('managed stop verifies process ownership and clears encrypted token',()=>{
 assert.match(stop,/Test-IcePackOwnedProcess \$rec \$def/);
 assert.match(stop,/Remove-Item -LiteralPath \(Get-IcePackBridgeTokenPath\)/);
 assert.match(shared,/CreationDate/);
 assert.match(shared,/ExecutablePath/);
 assert.match(shared,/CommandLine/);
});
test('copy button requires owned process and copies token only to clipboard',()=>{
 assert.match(copy,/Test-IcePackOwnedProcess \$rec \$def/);
 assert.match(copy,/Set-Clipboard -Value \$token/);
 assert.doesNotMatch(copy,/Write-Output.*\$token/);
 assert.match(ui,/Copy bridge pairing token/);
});
test('quiet launcher and stop retain opt-in skip-unowned behavior',()=>{
 assert.match(launch,/if\(Test-IcePackPort \$def.Port\)/);
 assert.match(launch,/if\(\$CheckOnly\)/);
 assert.match(stop,/if\(\$CheckOnly\)/);
 assert.match(shared,/if \(\$Definition.Name -eq 'bridge'\)/);
});
