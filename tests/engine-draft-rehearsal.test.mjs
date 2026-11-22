import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { rehearseEngineConfiguration, rehearseEngineDraft } from '../scripts/Test-IcePackEngineDraft.mjs';

async function setup(t, failLoad = false) {
  const root = await mkdtemp(join(tmpdir(), 'icepack-rehearsal-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'engine'));
  const draft = join(root, 'draft.json');
  const catalog = join(root, 'catalog.json');
  const scratchRecord = join(root, 'scratch.txt');
  const original = JSON.stringify({ schemaVersion: 2, kits: [], rules: [
    { id: 'ready', giftName: 'Heart Me', enabled: true },
    { id: 'blocked', giftName: 'Wood Gift', enabled: true },
    { id: 'disabled', giftName: 'Disabled', enabled: false },
  ] });
  await writeFile(draft, original);
  await writeFile(catalog, JSON.stringify({ schemaVersion: 2, items: [], dinosaurs: [] }));
  // The fixture observes the actual loader input path, including on failure.
  await writeFile(join(root, 'engine', 'icepack-custom-rules.mjs'), `
    import { readFileSync, writeFileSync } from 'node:fs';
    import { join } from 'node:path';
    export function loadSavedRules(folder) {
      writeFileSync(${JSON.stringify(scratchRecord)}, folder);
      if (${failLoad}) throw new Error('Engine rejected draft');
      const config = JSON.parse(readFileSync(join(folder, 'streamer-config-v2.json'), 'utf8'));
      return { config };
    }
    export function buildPlanCommands(plan) {
      if (plan.ruleId === 'blocked') throw new Error('Unsupported item');
      return ['prepared in memory'];
    }
  `);
  await writeFile(join(root, 'engine', 'icepack-config-engine.mjs'), `
    export function planGift(config, catalog, gift) {
      const rule = config.rules.find(rule => rule.giftName === gift.name);
      return { matched: true, ruleId: rule.id };
    }
  `);
  return { root, draft, catalog, original, scratchRecord };
}

test('rehearses enabled rules from temporary copies and reports a blocked rule', async t => {
  const { root, draft, catalog, original, scratchRecord } = await setup(t);
  const result = await rehearseEngineDraft(root, { draft, catalog });
  assert.equal(result.ruleCount, 3);
  assert.deepEqual(result.results, [
    { ruleId: 'ready', gift: 'Heart Me', prepared: 1 },
    { ruleId: 'blocked', gift: 'Wood Gift', blocked: 'Unsupported item' },
  ]);
  const scratch = await readFile(scratchRecord, 'utf8');
  assert.notEqual(scratch, root);
  await assert.rejects(lstat(scratch), { code: 'ENOENT' });
  assert.equal(await readFile(draft, 'utf8'), original);
});

test('removes temporary files when the engine rejects the draft', async t => {
  const { root, draft, catalog, scratchRecord } = await setup(t, true);
  await assert.rejects(rehearseEngineDraft(root, { draft, catalog }), /Engine rejected draft/);
  const scratch = await readFile(scratchRecord, 'utf8');
  await assert.rejects(lstat(scratch), { code: 'ENOENT' });
});

test('runs the same rehearsal on reviewed dashboard data without source files', async t => {
  const { root, original } = await setup(t);
  const config = JSON.parse(original);
  const catalog = { schemaVersion: 2, dinosaurs: [], items: [] };
  const report = await rehearseEngineConfiguration(root, { config, catalog, catalogSource: 'selected' });
  assert.equal(report.catalogSource, 'selected');
  assert.equal(report.packSource, 'catalog defaults');
  assert.equal(report.results.length, 2);
  assert.equal(report.results[0].prepared, 1);
  assert.equal(report.results[1].blocked, 'Unsupported item');
  assert.equal(JSON.stringify(config), original);
});
