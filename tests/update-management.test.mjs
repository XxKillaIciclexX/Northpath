import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const base=path.resolve(import.meta.dirname,'..');
const read=(p)=>fs.readFileSync(path.join(base,p),'utf8');
const manifest=JSON.parse(read('example-update/icepack-update.json'));
test('update package declares supported schema and explicit version',()=>{
  assert.equal(manifest.schema,1);assert.equal(manifest.version,'2.4.0');
});
test('example package SHA-256 matches actual bytes',()=>{
 for(const f of manifest.files){const b=fs.readFileSync(path.join(base,'example-update',f.path));assert.equal(crypto.createHash('sha256').update(b).digest('hex'),f.sha256)}
});
test('installer defaults to no-write dry run',()=>{
 const s=read('scripts/Install-IcePackUpdate.ps1');assert.match(s,/if \(-not \$Apply\)/);assert.match(s,/DRY RUN ONLY/);assert.match(s,/Assert-IcePackServicesStopped/);
});
test('update validates allowed relative paths and rejects junctions',()=>{
 const s=read('scripts/IcePack-UpdateCommon.ps1');assert.match(s,/Get-IcePackSafeRelativePath/);assert.match(s,/ReparsePoint/);assert.match(s,/\$parts -contains '\.\.'/);
});
test('update validates SHA-256 before writes and again after writes',()=>{
 assert.match(read('scripts/IcePack-UpdateCommon.ps1'),/Update hash mismatch/);
 assert.match(read('scripts/Install-IcePackUpdate.ps1'),/Post-copy verification failed/);
});
test('installer protects prior files and records transaction state',()=>{
 const s=read('scripts/Install-IcePackUpdate.ps1');assert.match(s,/Backup verification failed/);assert.match(s,/reverted-after-failure/);assert.match(s,/recovery-required/);
});
test('rollback defaults to preview and checks current changes before overwrite',()=>{
 const s=read('scripts/Restore-IcePackUpdate.ps1');assert.match(s,/if\(-not \$ConfirmRollback\)/);assert.match(s,/Current file modified since update/);assert.match(s,/Backup hash mismatch/);
});
test('update system never applies executable code or touches secrets as data',()=>{
 const s=read('scripts/Install-IcePackUpdate.ps1');assert.doesNotMatch(s,/Invoke-Expression|\biex\b/i);
 const c=read('scripts/IcePack-UpdateCommon.ps1');assert.match(c,/code allowlist/);assert.doesNotMatch(c,/\.env\s*\|/);
});
