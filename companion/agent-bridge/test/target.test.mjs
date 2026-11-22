import test from 'node:test';
import assert from 'node:assert/strict';
import {validateTargetId,getEngineTarget,assertTargetSaveSafe} from '../target.mjs';
test('accepts numeric specimen IDs at supported bounds',()=>{assert.equal(validateTargetId('537815134'),'537815134');assert.equal(validateTargetId('4294967295'),'4294967295');});
test('rejects invalid or non-string player IDs',()=>{for(const value of ['', '0', '-3', '4294967296', '1e3', '123abc', 537815134, ' 123'])assert.throws(()=>validateTargetId(value));});
test('reports actual saved engine ID, not browser draft',()=>{assert.deepEqual(getEngineTarget({settings:{playerId:'537815134'},customRules:{playerIdConfigured:true,mode:'off'}}),{playerId:'537815134',configured:true,laneConfigured:true,mode:'off'});});
test('reports missing ID without suggesting one',()=>{assert.equal(getEngineTarget({settings:{playerId:''},customRules:{mode:'off'}}).playerId,null);});
test('requires all live lanes off and queues empty before save',()=>{const safe={engineOnline:true,armState:false,giftRconMode:'off',customRulesMode:'off',pending:0,customQueued:0,customInflight:false};assert.doesNotThrow(()=>assertTargetSaveSafe(safe));for(const patch of [{customRulesMode:'preview'},{customRulesMode:'live'},{giftRconMode:'preview'},{armState:true},{customInflight:true},{pending:1},{customQueued:1},{engineOnline:false}])assert.throws(()=>assertTargetSaveSafe({...safe,...patch}));});
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {appendAudit,readAudit} from '../audit.mjs';
test('target audit records no player IDs or secrets',()=>{
 const dir=mkdtempSync(join(tmpdir(),'icepack-target-audit-'));
 try{
  appendAudit(join(dir,'backups'),{type:'target-update',status:'succeeded',operationId:'a'.repeat(24),snapshot:'20261121-101010-abcdef12',playerId:'537815134',token:'private-secret'});
  const data=readFileSync(join(dir,'activity.jsonl'),'utf8');
  assert.doesNotMatch(data,/537815134|private-secret/);
  assert.equal(readAudit(join(dir,'backups'))[0].type,'target-update');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
