import test from 'node:test';
import assert from 'node:assert/strict';
import {getReconciliationGuide} from '../../src/reconciliation.mjs';
const base={draftMatchesApplied:true,appliedPresent:true,engineAgreement:'counts-match',engine:{online:true}};
test('matching counts are qualified and do not trigger writes',()=>{
 const v=getReconciliationGuide(base);assert.equal(v.key,'counts-agree');assert.equal(v.action,'none');assert.match(v.steps.join(' '),/do not prove/i);
});
test('unapplied browser changes use existing validation path',()=>{
 const v=getReconciliationGuide({...base,draftMatchesApplied:false,engineAgreement:'count-mismatch'});
 assert.equal(v.key,'draft-edits');assert.equal(v.action,'preview');assert.match(v.steps.join(' '),/manually/i);
});
test('missing applied file offers preview and recovery',()=>{
 const v=getReconciliationGuide({...base,appliedPresent:false,draftMatchesApplied:null});assert.equal(v.key,'not-applied');assert.equal(v.action,'preview');assert.equal(v.showRecovery,true);
});
test('engine count mismatch does not suggest destructive apply',()=>{
 const v=getReconciliationGuide({...base,engineAgreement:'count-mismatch'});assert.equal(v.key,'count-mismatch');assert.equal(v.action,'none');assert.equal(v.showRecovery,true);
});
test('engine not loaded suggests diagnosis, not enabling live',()=>{
 const v=getReconciliationGuide({...base,engineAgreement:'not-loaded'});assert.equal(v.key,'not-loaded');assert.equal(v.action,'none');
});
test('offline engine remains unverified',()=>{
 const v=getReconciliationGuide({...base,engine:{online:false},engineAgreement:'unknown'});assert.equal(v.key,'engine-offline');assert.equal(v.action,'none');
});
test('unknown result is safe and non-mutating',()=>{
 const v=getReconciliationGuide({...base,engineAgreement:'unknown'});assert.equal(v.action,'none');
});
