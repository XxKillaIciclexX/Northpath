import test from 'node:test';
import assert from 'node:assert/strict';
import {assessDrift} from '../drift.mjs';
const engine={engineOnline:true,customRulesLoaded:true,customRulesMode:'preview',customRuleCount:3,customKitCount:1};
const run=(overrides={})=>assessDrift({draftHash:'a',appliedHash:'a',appliedRuleCount:3,appliedKitCount:1,engine,...overrides});
test('reports count matches without claiming exact engine memory equality',()=>{const x=run();assert.equal(x.status,'counts-match');assert.equal(x.engineAgreement,'counts-match');assert.match(x.reason,/cannot be verified/);});
test('detects browser draft drift from applied file',()=>{const x=run({draftHash:'changed'});assert.equal(x.status,'draft-differs');assert.equal(x.draftMatchesApplied,false);});
test('flags engine count mismatch and unloaded state',()=>{assert.equal(run({engine:{...engine,customKitCount:0}}).engineAgreement,'count-mismatch');assert.equal(run({engine:{...engine,customRulesLoaded:false}}).status,'engine-attention');});
test('treats missing file or offline engine as unknown, never synced',()=>{assert.equal(run({appliedHash:null}).status,'not-applied');assert.equal(run({engine:null}).status,'unverified');assert.equal(run({engine:null}).engineAgreement,'unknown');});
