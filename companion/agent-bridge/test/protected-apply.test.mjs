import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {resolveBackupPaths,snapshotBeforeApply} from '../protected-apply.mjs';
const fixtures = () => {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'icepack-v14-'));
 const local=path.join(root,'local'),engine=path.join(root,'engine'),kit=path.join(engine,'icepack-catalog-manager');
 fs.mkdirSync(path.join(local,'IcePackCompanion'),{recursive:true});fs.mkdirSync(kit,{recursive:true});
 fs.writeFileSync(path.join(local,'IcePackCompanion','settings.json'),JSON.stringify({enginePath:engine,kitDir:kit}));
 fs.writeFileSync(path.join(engine,'rules-v06.json'),JSON.stringify({playerId:'537815134',rules:[]}));
 fs.writeFileSync(path.join(kit,'streamer-config-v2.json'),JSON.stringify({schemaVersion:2,rules:[],kits:[]}));
 return {root,local,engine,kit};
};
test('creates a verified v1.2-compatible backup of both configs without credentials',t=>{
 const f=fixtures();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(f.engine,'.env'),'RCON_PASSWORD=private');
 const paths=resolveBackupPaths(f.kit,{localAppData:f.local});const result=snapshotBeforeApply(paths);
 assert.match(result.snapshot,/^\d{8}-\d{6}-[0-9a-f]{8}$/);
 const manifest=JSON.parse(fs.readFileSync(path.join(result.directory,'manifest.json')));
 assert.equal(manifest.format,'icepack-config-backup');assert.equal(manifest.version,1);
 assert.deepEqual(manifest.entries.map(e=>e.key),['legacy-rules','streamer-config']);
 for(const entry of manifest.entries)assert.equal(entry.sha256, crypto.createHash('sha256').update(fs.readFileSync(path.join(result.directory,entry.filename))).digest('hex').toUpperCase());
 assert.equal(JSON.parse(fs.readFileSync(path.join(result.directory,'legacy-rules.json'))).playerId,'537815134');
 assert.equal(fs.existsSync(path.join(result.directory,'.env')),false);
});
import crypto from 'node:crypto';
test('rejects invalid JSON and does not create backup',t=>{
 const f=fixtures();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(f.kit,'streamer-config-v2.json'),'{bad');
 const paths=resolveBackupPaths(f.kit,{localAppData:f.local});assert.throws(()=>snapshotBeforeApply(paths),/Invalid JSON/);
 assert.equal(fs.existsSync(paths.root),false);
});
test('rejects an incorrectly paired Kit directory',t=>{
 const f=fixtures();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 const other=path.join(f.root,'other');fs.mkdirSync(other);
 assert.throws(()=>resolveBackupPaths(other,{localAppData:f.local}),/differs from installed settings/);
});
test('a streamer install loads planner code from the app and backs up rules from user data', t => {
  const f = fixtures();
  t.after(() => fs.rmSync(f.root, { recursive: true, force: true }));
  const data = path.join(f.local, 'IcePackCompanionStreamer', 'data');
  const engineData = path.join(data, 'engine');
  fs.mkdirSync(engineData, { recursive: true });
  fs.writeFileSync(path.join(engineData, 'rules-v06.json'), JSON.stringify({ playerId: '314159', rules: [] }));
  const settingsPath = path.join(data, 'settings.json');
  fs.writeFileSync(settingsPath, JSON.stringify({ enginePath: f.engine, engineDataPath: engineData, kitDir: f.kit }));

  const paths = resolveBackupPaths(f.kit, { localAppData: f.local, settingsPath });
  assert.equal(paths.engineCodeDir, fs.realpathSync(f.engine));
  const snapshot = snapshotBeforeApply(paths);
  assert.equal(paths.root, path.join(data, 'backups'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(snapshot.directory, 'legacy-rules.json'))).playerId, '314159');
});
test('no existing config blocks apply safely',t=>{
 const f=fixtures();t.after(()=>fs.rmSync(f.root,{recursive:true,force:true}));
 fs.rmSync(path.join(f.engine,'rules-v06.json'));fs.rmSync(path.join(f.kit,'streamer-config-v2.json'));
 assert.throws(()=>snapshotBeforeApply(resolveBackupPaths(f.kit,{localAppData:f.local})),/No existing configurations/);
});
