import test from 'node:test';
import assert from 'node:assert/strict';
import {validateGiftRequest,assertPreviewOnly} from '../preview-safety.mjs';
const safe={engineOnline:true,customRulesMode:'preview',customRulesLoaded:true,armState:false,giftRconMode:'off',customInflight:false,customQueued:0,pending:0};
test('valid preview gift request is normalized',()=>assert.deepEqual(validateGiftRequest({id:'  ',name:' Heart Me '}),{id:'',name:'Heart Me'}));
test('reject empty, oversized, and malformed gifts',()=>{for(const g of [{id:'',name:''},{id:'x'.repeat(101),name:'Rose'},{id:1,name:'Rose'},{id:'',name:'A\nB'}])assert.throws(()=>validateGiftRequest(g));});
test('preview mode and inactive lanes are required',()=>assert.doesNotThrow(()=>assertPreviewOnly(safe)));
test('live, off, armed, queued and in-flight are blocked',()=>{for(const delta of [{customRulesMode:'live'},{customRulesMode:'off'},{armState:true},{giftRconMode:'live'},{customInflight:true},{customQueued:1},{pending:1},{customRulesLoaded:false},{engineOnline:false}])assert.throws(()=>assertPreviewOnly({...safe,...delta}));});
