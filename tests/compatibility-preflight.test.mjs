import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../scripts/Test-IcePackInstallCompatibility.ps1',import.meta.url),'utf8');
test('generic list is explicitly materialized before attaching to report',()=>{
  assert.match(source,/\$checkItems\s*=\s*\$checks\.ToArray\(\)/);
  assert.match(source,/Checks=\$checkItems/);
  assert.doesNotMatch(source,/Checks=@\(\$checks\)/);
});
test('preflight does not modify services or files',()=>{
  assert.doesNotMatch(source,/\b(?:Start-Process|Stop-Process|Copy-Item|Remove-Item|Set-Content|WriteAllText)\b/);
  assert.match(source,/if\(\$AsJson\)/);
});
