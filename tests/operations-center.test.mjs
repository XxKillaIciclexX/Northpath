// Portable source invariants; Windows GUI and HTTP integration still require a Windows test.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../scripts');
const health=fs.readFileSync(path.join(base,'IcePack-Health.ps1'),'utf8');
const ui=fs.readFileSync(path.join(base,'Open-IcePackControlCenter.ps1'),'utf8');
const preflight=fs.readFileSync(path.join(base,'Test-IcePackReadiness.ps1'),'utf8');
const inventory=fs.readFileSync(path.join(base,'Get-IcePackInstallationReport.ps1'),'utf8');
const builder=fs.readFileSync(path.join(base,'New-IcePackReleaseBundle.ps1'),'utf8');
const dashboard=fs.readFileSync(new URL('../companion/src/App.tsx', import.meta.url), 'utf8');
test('readiness only requests approved local status URLs',()=>{
  assert.match(health,/127\.0\.0\.1:3210\/state/);
  assert.match(health,/127\.0\.0\.1:3212\/status/);
  assert.match(health,/127\.0\.0\.1:5173\//);
  assert.match(health,/\$request\.Method = 'GET'/);
  assert.match(health,/\$uri\.Host -ne '127\.0\.0\.1'/);
  assert.doesNotMatch(health,/(?:\$request\.Method\s*=\s*'POST'|RCON_PASSWORD|Enable LIVE|custom-rules-mode)/i);
});
test('preflight returns boolean health with no raw secrets',()=>{
  assert.match(health,/TargetSaved/);
  assert.match(health,/TargetLoaded/);
  assert.match(health,/RewardLanesOff/);
  assert.match(preflight,/Get-IcePackHealth/);
  assert.doesNotMatch(preflight,/(?:\.playerId|\.password|\.token|\.env)/i);
});
test('operations center preserves protected startup and recovery controls',()=>{
  for(const name of ['Start-IcePackCompanion.ps1','Backup-IcePackConfiguration.ps1','IcePack-ConfigCommon.ps1','Test-IcePackReadiness.ps1'])assert.ok(ui.includes(name),name);
  assert.match(ui,/Ready|readiness/i);
  assert.match(ui,/Get-IcePackHealth/);
  assert.match(ui,/Run preflight/);
});
test('rounded Operations Center buttons retain native button behavior and ship in the source bundle', () => {
  const theme = fs.readFileSync(path.join(base, 'IcePack-OperationsTheme.cs'), 'utf8');
  assert.match(ui, /Add-Type -Path \(Join-Path \$PSScriptRoot 'IcePack-OperationsTheme\.cs'\)/);
  assert.match(ui, /\[IcePack\.Operations\.RoundedButton\]::new\(\)/);
  assert.match(theme, /class RoundedButton\s*:\s*Button\b/);
  assert.match(builder, /\$fixed=.*'scripts\/IcePack-OperationsTheme\.cs'/);
});
test('Operations Center applies the card surface behind button corners and measures action strips at their current width', () => {
  const theme = fs.readFileSync(path.join(base, 'IcePack-OperationsTheme.cs'), 'utf8');
  assert.match(ui, /\$card\.FillStart = \$card\.FillEnd = \$theme\.Surface/);
  assert.match(ui, /\$button\.BackColor = \$theme\.Surface/);
  assert.match(theme, /ControlStyles\.Opaque/);
  assert.match(theme, /FillRectangle\(background, e\.ClipRectangle\)/);
  assert.match(ui, /\[IcePack\.Operations\.ActionStrip\]::new\(\)/);
  assert.match(theme, /GetPreferredSize\(new Size\(ClientSize\.Width, 0\)\)\.Height/);
});
test('operations center, dashboard, and inventory share the packaged release metadata', () => {
  for (const source of [ui, inventory]) {
    assert.match(source, /Get-IcePackReleaseLabel/);
    assert.match(source, /'companion\/src\/icepack-release\.json'/);
    assert.doesNotMatch(source, /\bv2\.\d+(?:\.\d+)? Alpha\b/);
  }
  assert.match(dashboard, /import release from '\.\/icepack-release\.json'/);
  assert.match(dashboard, /\{releaseLabel\}/);
  assert.match(builder, /\$required=.*'companion\/src\/icepack-release\.json'/);
});
test('no live mode or RCON writes added by new scripts',()=>{
  for(const source of [health,preflight]){
    assert.doesNotMatch(source,/(?:Invoke-RestMethod\s+-Method\s+Post|Invoke-WebRequest\s+-Method\s+Post|GiveItemToPlayer|ScriptCommand|Start-Process)/i);
  }
});

test('preview mode has a separate classification from live or armed',()=>{
  assert.match(health,/\$previewSafe = /);
  assert.match(health,/\$liveActive = /);
  assert.match(health,/\$modesKnown = /);
  assert.match(health,/PREVIEW \(NO RCON FROM PREVIEW\)/);
  assert.match(health,/LiveOrArmed/);
  assert.match(ui,/\$health\.RewardState/);
  assert.match(ui,/\$health\.PreviewSafe/);
  assert.match(preflight,/PREVIEW READY/);
  assert.match(preflight,/LIVE\/ARMED DETECTED/);
});
test('preflight remains read-only and does not treat unknown modes as safe',()=>{
  assert.match(health,/\$modesKnown -and -not \$liveActive/);
  assert.match(health,/RewardState = \$rewardState/);
  assert.match(health,/ReadyForPreview =/);
  assert.doesNotMatch(preflight,/(?:POST|SetMode|Invoke-RestMethod|Start-Process)/i);
});
