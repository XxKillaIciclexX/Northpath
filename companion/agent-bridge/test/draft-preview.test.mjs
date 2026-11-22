import assert from 'node:assert/strict';
import test from 'node:test';
import { exportDashboardDraft, previewDashboardDraft } from '../draft-preview.mjs';

const catalog = {
  items: [{ id: 'Stone', name: 'Stone' }],
  dinosaurs: [{ id: 'Dodo', name: 'Dodo' }],
};
const gift = { id: '42', name: 'Example Gift' };
const draft = {
  version: 1,
  kits: [{
    id: 'starter',
    name: 'Starter Kit',
    entries: [
      { action: { type: 'item', catalogId: 'Stone', quantity: 25, quality: 0, announcement: '' } },
      { action: { type: 'dinosaur', catalogId: 'Dodo', quantity: 1, level: 20, tamed: false, announcement: '' } },
    ],
  }],
  rules: [{
    id: 'kit-rule',
    giftId: '42',
    giftName: 'Example Gift',
    enabled: true,
    action: { type: 'kit', kitId: 'starter', announcement: '' },
  }],
};

test('expands a Kit using the configured gift ID without modifying the export', () => {
  const input = structuredClone(draft);
  const plan = previewDashboardDraft({ draft: input, gift: { ...gift, name: 'Renamed Gift' } }, catalog);
  assert.equal(plan.ruleId, 'kit-rule');
  assert.deepEqual(plan.actions, [
    { type: 'item', itemId: 'Stone', quantity: 25, announcement: false },
    { type: 'dinosaur', creatureId: 'Dodo', quantity: 1, level: 20, status: 'wild', announcement: false },
  ]);
  assert.deepEqual(input, draft);
});

test('disabled rules and unknown gift IDs produce no actions', () => {
  const disabled = structuredClone(draft);
  disabled.rules[0].enabled = false;
  assert.deepEqual(previewDashboardDraft({ draft: disabled, gift }, catalog).actions, []);
  assert.equal(previewDashboardDraft({ draft, gift: { ...gift, id: '43' } }, catalog).matched, false);
});

test('rejects unsupported exports and missing catalog items', () => {
  assert.throws(() => previewDashboardDraft({ draft: { ...draft, version: 2 }, gift }, catalog), /version 1/);
  assert.throws(() => previewDashboardDraft({ draft, gift }, { ...catalog, items: [] }), /Stone is not in the engine catalog/);
});

test('a supplied Kit Editor catalog resolves entries absent from the bundled catalog', () => {
  const customDraft = structuredClone(draft);
  customDraft.kits[0].entries[0].action.catalogId = 'CustomStone';
  const provided = {
    ...catalog,
    schemaVersion: 2,
    items: [{ id: 'CustomStone', name: 'Custom Stone' }],
  };
  assert.throws(() => previewDashboardDraft({ draft: customDraft, gift }, catalog), /CustomStone/);
  const plan = previewDashboardDraft({ draft: customDraft, gift, catalog: provided }, catalog);
  assert.equal(plan.catalogSource, 'provided');
  assert.equal(plan.actions[0].itemId, 'CustomStone');
  assert.equal(previewDashboardDraft({ draft, gift }, catalog).catalogSource, 'bundled');
});

test('a selected catalog is validated and never silently replaced by the bundled catalog', () => {
  for (const invalid of [null, { ...catalog, schemaVersion: 1 }]) {
    assert.throws(() => previewDashboardDraft({ draft, gift, catalog: invalid }, catalog), /version 2 ARK catalog/);
  }
  assert.throws(() => previewDashboardDraft({
    draft, gift, catalog: { schemaVersion: 2, items: [], dinosaurs: [] },
  }, catalog), /Stone is not in the engine catalog/);
});

test('exports only engine rules and Kits, preserves disabled rules, and surfaces conversion warnings', () => {
  const source = structuredClone(draft);
  source.serverName = 'test server';
  source.playerId = '123';
  source.kits[0].entries[0].action.catalogId = 'Wood';
  source.rules.push({ ...source.rules[0], id: 'disabled', giftId: 'other', giftName: 'Other Gift', enabled: false });
  const selected = { ...catalog, schemaVersion: 2, items: [{ id: 'Wood', name: 'Wood' }] };
  const result = exportDashboardDraft({ draft: source, catalog: selected }, catalog);
  assert.equal(result.catalogSource, 'provided');
  assert.deepEqual(Object.keys(result.config), ['schemaVersion', 'kits', 'rules']);
  assert.equal(result.config.schemaVersion, 2);
  assert.equal(result.config.kits[0].entries[0].itemId, 'Wood');
  assert.equal(result.config.rules[0].reward.kitId, 'starter');
  assert.equal(result.config.rules[1].enabled, false);
  assert.equal(result.config.rules[0].cooldown, 0);
  assert.match(result.warnings.join(' '), /only Stone/);
});

test('failed validation cannot produce a downloadable configuration', () => {
  const invalid = structuredClone(draft);
  invalid.rules[0].action.kitId = 'missing';
  assert.throws(() => exportDashboardDraft({ draft: invalid }, catalog), /Missing Kit/);
});
