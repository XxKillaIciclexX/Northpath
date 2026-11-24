import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validateArkCatalog, validateConfiguration } from '../icepack-config-engine.mjs';
import { createDesktopOperations } from '../operations.mjs';
import { assertRewardLanesIdle, selectWebsiteRule } from '../website-rule.mjs';

const catalog = validateArkCatalog({ schemaVersion: 2, dinosaurs: [], items: [{ id: 'Stone', name: 'Stone' }] });
const item = { type: 'item', itemId: 'Stone', quantity: 25, announcement: false };
const rule = { id: 'local-rose', giftName: 'Rose', giftId: '5655', cooldown: 30, reward: item };
const current = validateConfiguration({
  schemaVersion: 2,
  kits: [{ id: 'stone-kit', name: 'Stone kit', entries: [item] }],
  rules: [rule, { id: 'heart-me', giftName: 'Heart Me', reward: { type: 'kit', kitId: 'stone-kit', announcement: false } }],
}, catalog);
const selected = {
  id: 'website-rose', giftName: 'Rose', giftId: '', enabled: true,
  action: { type: 'item', catalogId: 'Stone', quantity: 5, quality: 0, announcement: '' },
};

test('approving one website rule preserves the local gift ID, cooldown, unrelated rules, and Kits', () => {
  const baseline = structuredClone(current);
  const draft = { version: 1, rules: [selected, { giftName: 'Other gift', action: {} }] };
  const result = selectWebsiteRule(draft, ' RoSE ', current, catalog);
  assert.deepEqual(result.previous, current.rules[0]);
  assert.deepEqual(result.rule, { ...current.rules[0], reward: { ...item, quantity: 5 } });
  assert.deepEqual(result.config.rules, [result.rule, current.rules[1]]);
  assert.deepEqual(result.config.kits, current.kits);
  assert.deepEqual(current, baseline);
});

test('rejects an ambiguous match and a website Kit reward without changing local rules', () => {
  const draft = { version: 1, rules: [selected, { ...selected, id: 'another-rose' }] };
  assert.throws(() => selectWebsiteRule(draft, 'Rose', current, catalog), /exactly one/);
  const local = { ...current, rules: [current.rules[0], { ...current.rules[1], giftId: '6000' }] };
  assert.throws(() => selectWebsiteRule({ version: 1, rules: [{ ...selected, giftId: '6000' }] }, 'Rose', local, catalog), /more than one local/);
  const kit = { ...selected, action: { ...selected.action, type: 'kit', kitId: 'stone-kit' } };
  assert.throws(() => selectWebsiteRule({ version: 1, rules: [kit] }, 'Rose', current, catalog), /direct item or dinosaur/);
});

test('a supported idle engine is required before applying a rule or enabling Live', () => {
  const state = {
    customRules: { mode: 'off', queued: 0, inflight: false }, giftRcon: { mode: 'off', queued: 0, inflight: false },
    armed: false, autoEnabled: false, pending: 0, rewardPending: 0, active: null,
  };
  assert.doesNotThrow(() => assertRewardLanesIdle(state));
  assert.throws(() => assertRewardLanesIdle({ ...state, active: {} }), /active deliveries/);
  assert.throws(() => assertRewardLanesIdle({ ...state, customRules: { ...state.customRules, mode: 'live' } }), /live gift lanes/);
});

test('a rule can be reviewed during Live but cannot be applied until rewards are idle', async t => {
  const root = await mkdtemp(join(tmpdir(), 'icepack-live-review-'));
  const appData = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = root;
  t.after(async () => {
    if (appData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = appData;
    await rm(root, { recursive: true });
  });
  const kit = join(root, 'kit');
  const engine = join(root, 'engine');
  const settings = join(root, 'IcePackCompanion');
  await Promise.all([mkdir(kit), mkdir(engine), mkdir(settings)]);
  await writeFile(join(settings, 'settings.json'), JSON.stringify({ enginePath: engine, kitDir: kit }));
  const saved = { catalog, config: current, fingerprints: { rules: 'old', catalog: 'catalog', contentPrefs: null } };
  await writeFile(join(engine, 'icepack-custom-rules.mjs'), `
    export const loadSavedRules = () => (${JSON.stringify(saved)});
    export const buildPlanCommands = () => ['one planned reward'];
  `);
  const run = createDesktopOperations({
    kitDir: kit,
    readWebsiteDraft: async () => ({ draft: { version: 1, rules: [selected] }, revision: 'latest' }),
    readEngineState: async () => ({ customRules: { mode: 'live' } }),
    reloadEngine: async () => assert.fail('Live review must not reload rules'),
  });
  const review = await run('review-rule', { gift: 'Rose' });
  assert.equal(review.rule.reward.quantity, 5);
  assert.match(review.applyBlock, /Turn off live gift lanes/);
  await assert.rejects(run('apply-rule', { reviewId: review.reviewId }), /Turn off live gift lanes/);
});
