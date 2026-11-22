import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const verifier=fs.readFileSync(path.join(import.meta.dirname,'..','scripts','Test-IcePackReleaseBundle.ps1'),'utf8');
test('canonicalize ZIP entry separators before manifest lookup',()=>{
  assert.ok(verifier.includes(String.raw`$name=$entry.FullName.Replace('\','/')`));
  assert.match(verifier, /\$byName\.ContainsKey\(\$name\)/);
  assert.match(verifier, /\$item=\$byName\[\$name\]/);
  assert.doesNotMatch(verifier, /\$zip\.GetEntry\(\$name\)/);
});
test('preserve ZIP safety and integrity checks after canonicalizing paths',()=>{
  for(const expected of ['Unsafe ZIP path:', 'Duplicate ZIP entry:', 'Duplicate manifest path:', 'SHA-256 mismatch:', 'Length mismatch:', 'Unexpected file in bundle:']){
    assert.ok(verifier.includes(expected),expected);
  }
  assert.match(verifier, /\$byName\.Keys/);
});
test('use Windows PowerShell compatible dictionary APIs',()=>{
  assert.match(verifier, /\$byName\.Add\(\$name,\$entry\)/);
  assert.doesNotMatch(verifier, /\$byName\.TryAdd\(/);
});
