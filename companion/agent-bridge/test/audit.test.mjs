import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {appendAudit,readAudit,newOperationId} from '../audit.mjs';
function withDir(run){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'icepack-audit-'));try{return run(path.join(dir,'backups'));}finally{fs.rmSync(dir,{recursive:true,force:true});}}
const SNAP='20261121-130000-abcdef12';
test('audit starts empty, appends, reads newest first',()=>withDir(root=>{
 assert.deepEqual(readAudit(root),[]);
 const id=newOperationId();appendAudit(root,{type:'config-apply',status:'started',operationId:id,snapshot:SNAP});appendAudit(root,{type:'config-apply',status:'succeeded',operationId:id,snapshot:SNAP});
 assert.deepEqual(readAudit(root).map(e=>e.status),['succeeded','started']);
 assert.equal(readAudit(root)[0].snapshot,SNAP);
}));
test('rejects unrecognized metadata without writing secrets',()=>withDir(root=>{
 const id=newOperationId();
 assert.throws(()=>appendAudit(root,{type:'config-apply',status:'succeeded',operationId:id,snapshot:'../../.env'}),/Invalid audit snapshot/);
 appendAudit(root,{type:'config-apply',status:'succeeded',operationId:id,snapshot:SNAP,password:'NEVER_WRITE_THIS',playerId:'12345678'});
 const content=fs.readFileSync(path.join(path.dirname(root),'activity.jsonl'),'utf8');
 assert.equal(content.includes('NEVER_WRITE_THIS'),false);assert.equal(content.includes('12345678'),false);
}));
test('rejects symlinked audit file',t=>withDir(root=>{
 fs.mkdirSync(root,{recursive:true});
 const target=path.join(path.dirname(root),'private.txt');
 const link=path.join(path.dirname(root),'activity.jsonl');
 fs.writeFileSync(target,'do not touch');
 try {
  fs.symlinkSync(target,link,'file');
 } catch (err) {
  // On Windows without Developer Mode or the SeCreateSymbolicLinkPrivilege,
  // creating a symlink is forbidden. Do not mark the security check as passed.
  if (process.platform==='win32' && (err?.code==='EPERM' || err?.code==='EACCES')) {
   t.skip('Windows denied symlink creation; verify this security test on a symlink-capable host');
   return;
  }
  throw err;
 }
 assert.throws(()=>appendAudit(root,{type:'config-restore',status:'started',operationId:newOperationId()}),/Invalid audit file/);
 assert.equal(fs.readFileSync(target,'utf8'),'do not touch');
}));
test('skips corrupted audit rows',()=>withDir(root=>{
 fs.mkdirSync(root,{recursive:true});const file=path.join(path.dirname(root),'activity.jsonl');fs.writeFileSync(file,'{broken\n');
 appendAudit(root,{type:'config-restore',status:'failed',operationId:newOperationId(),snapshot:SNAP});
 assert.equal(readAudit(root).length,1);
}));
