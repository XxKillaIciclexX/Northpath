import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// This smoke test verifies the v0.4 bridge includes a bounded activity relay and
// does not accidentally replace the read-only status route with an RCON endpoint.
const src=fs.readFileSync(new URL('../bridge.mjs',import.meta.url),'utf8');
test('bridge sanitizes and bounds engine log relay',()=>{
  assert.match(src,/function safeActivity\(logs\)/);
  assert.match(src,/logs\.slice\(0,40\)/);
  assert.match(src,/recentLogs:safeActivity\(state\?\.logs\)/);
  assert.match(src,/\[REDACTED\]/);
});
test('bridge retains read-only status and token-protected sync',()=>{
  assert.match(src,/req\.method==='GET'&&req\.url==='\/status'/);
  assert.match(src,/x-icepack-sync-token/);
  assert.doesNotMatch(src,/req\.url==='\/rcon'/);
});
