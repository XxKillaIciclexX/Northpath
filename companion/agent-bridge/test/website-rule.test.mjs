import assert from 'node:assert/strict';
import test from 'node:test';
import { validateArkCatalog, validateConfiguration } from '../icepack-config-engine.mjs';
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
