import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=join(dirname(fileURLToPath(import.meta.url)),'..','scripts');
const file=name=>readFileSync(join(root,name),'utf8');
const common=file('IcePack-ManagedCommon.ps1');
const start=file('Start-IcePackBackground.ps1');
const stop=file('Stop-IcePackBackground.ps1');
const ui=file('Open-IcePackControlCenter.ps1');
test('only engine and dashboard are managed',()=>{
 assert.match(common,/switch \(\$Name\)/);
 assert.match(common,/'engine'/);
 assert.match(common,/'dashboard'/);
 assert.doesNotMatch(start,/Run-Bridge|bridge\.mjs|21213/);
 assert.match(start,/Bridge stays visible/);
});
test('engine quiet start includes env file and protected backup',()=>{
 assert.match(common,/--env-file=\.env/);
 assert.match(start,/AutoBackup-IcePackConfiguration\.ps1/);
 assert.match(start,/refusing engine launch/);
});
test('port occupied prevents starting and adopting unowned processes',()=>{
 assert.match(start,/Test-IcePackPort \$def\.Port/);
 assert.match(start,/unowned process; will not start or adopt/);
});
test('owned PID requires start time, executable and command line match',()=>{
 for(const token of ['createdUtc','ExecutablePath','CommandLine','Win32_Process','CreationDate'])assert.ok(common.includes(token),token);
 assert.match(stop,/Test-IcePackOwnedProcess \$rec \$def/);
});
test('stop never kills unowned services or bridge',()=>{
 assert.match(stop,/ownership could not be verified; refusing to stop/);
 assert.match(stop,/Unowned processes and the visible bridge were not touched/);
 assert.doesNotMatch(stop,/taskkill|Stop-Process -Name|Get-Process node/);
});
test('managed logs never capture bridge pairing token',()=>{
 assert.match(start,/RedirectStandardOutput/);
 assert.match(start,/RedirectStandardError/);
 assert.doesNotMatch(start,/bridge\.stdout|bridge\.stderr|pairingToken/);
});
test('Operations Center has managed start, stop, logs, and recovery controls',()=>{
 for(const token of ['Start Companion','Stop Companion','Open logs','Backup now','Open backups','Run preflight','Recovery guide'])assert.ok(ui.includes(token), token);
 assert.match(ui,/Confirm managed stop/);
});
test('status only reports owned processes after verification',()=>{
 const status=file('Get-IcePackBackgroundStatus.ps1');
 assert.match(status,/Test-IcePackOwnedProcess/);
 assert.match(status,/Owned=\$owned/);
});
