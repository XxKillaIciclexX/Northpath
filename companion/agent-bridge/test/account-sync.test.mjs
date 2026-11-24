import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { configFileHash, createAccountSync, sameRuleFiles } from '../account-sync.mjs';
import { validateArkCatalog, validateConfiguration } from '../icepack-config-engine.mjs';
import { mergeWebsiteDraft } from '../website-batch.mjs';

const catalog = validateArkCatalog({ schemaVersion: 2, dinosaurs: [], items: [{ id: 'Stone', name: 'Stone' }] });
const reward = { type: 'item', itemId: 'Stone', quantity: 1, announcement: false };
const stone = { type: 'item', catalogId: 'Stone', quantity: 5, quality: 0, announcement: '' };
const baseline = validateConfiguration({
  schemaVersion: 2,
  kits: [{ id: 'local-kit', name: 'Local Kit', entries: [reward] }],
  rules: [
    { id: 'local-rose', giftName: 'Rose', giftId: '5655', cooldown: 40, reward },
    { id: 'local-lion', giftName: 'Lion', reward },
  ],
}, catalog);
const draft = { version: 1,
  rules: [
    { id: 'web-rose', giftName: 'Rose', giftId: '', enabled: true, action: stone },
    { id: 'web-heart', giftName: 'Heart Me', enabled: true, action: { type: 'kit', kitId: 'web-kit', announcement: '' } },
  ],
  kits: [{ id: 'web-kit', name: 'Web Kit', entries: [{ action: stone }] }],
};

test('batch sync preserves local-only entries and removes previously synced deletions', () => {
  const merged = mergeWebsiteDraft(draft, { config: baseline, catalog });
  assert.deepEqual(merged.config.rules[0], { ...baseline.rules[0], reward: { ...reward, quantity: 5 } });
  assert.deepEqual(merged.config.rules[1], baseline.rules[1]);
  assert.equal(merged.config.rules[2].reward.kitId, 'web-kit');
  assert.deepEqual(merged.config.kits[0], baseline.kits[0]);

  const empty = { version: 1, rules: [], kits: [] };
  const removed = mergeWebsiteDraft(empty, { config: merged.config, catalog }, merged.owned);
  assert.deepEqual(removed.config.rules, [baseline.rules[1]]);
  assert.deepEqual(removed.config.kits, baseline.kits);

  const locallyEdited = structuredClone(merged.config);
  locallyEdited.rules[0].reward.quantity = 99;
  assert.throws(() => mergeWebsiteDraft(draft, { config: locallyEdited, catalog }, merged.owned), /changed since account sync/);
});

test('sync waits during Live and recovers the committed batch after a crash without writing it twice', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'icepack-account-sync-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const kitDir = join(directory, 'kit');
  const status = [];
  let mode = 'live';
  let config = baseline;
  let writes = 0;
  let loaded;
  const fingerprints = () => ({ rules: configFileHash(config), catalog: 'test-catalog', contentPrefs: null });
  const options = {
    directory, kitDir,
    readEngineState: async () => ({
      customRules: { mode, queued: 0, inflight: false, loaded: Boolean(loaded), loadedFingerprints: loaded },
      giftRcon: { mode: 'off', queued: 0, inflight: false }, armed: false, autoEnabled: false, pending: 0, rewardPending: 0, active: null,
    }),
    localRules: async () => ({
      saved: { config, catalog, fingerprints: fingerprints() },
      planner: { buildPlanCommands: () => ['mock reward'], loadSavedRules: () => ({ fingerprints: fingerprints() }) },
    }),
    // Simulate power loss after the rules file was replaced and before the engine acknowledged it.
    applyProtected: async (_paths, _before, candidate) => { writes++; config = candidate; throw Error('Interrupted'); },
    reloadEngine: async () => ({ customRules: { loaded: true, loadedFingerprints: loaded = fingerprints() } }),
    verifyLoaded: (state, expected) => assert.ok(sameRuleFiles(state.loadedFingerprints, expected)),
  };
  const connection = {
    readSyncDraft: async known => ({ account: 'owner', revision: 'latest', draft: known === 'latest' ? null : draft }),
    reportSync: async result => { status.push(result.state); return true; },
  };
  const lock = () => () => {};
  const first = createAccountSync(options);
  await first.configure(connection, true);
  await first.tick(connection, lock);
  assert.equal(writes, 0);
  assert.equal(status.at(-1), 'pending');
  mode = 'off';
  await first.tick(connection, lock);
  assert.equal(writes, 1);
  assert.equal(status.at(-1), 'blocked');
  const syncFile = join(directory, 'account-sync.json');
  assert.ok(JSON.parse(await readFile(syncFile, 'utf8')).journal);

  const restarted = createAccountSync(options);
  await restarted.tick(connection, lock);
  assert.equal(status.at(-1), 'applied');
  assert.equal(writes, 1);
  assert.equal(config.rules[0].reward.quantity, 5);
  const stored = JSON.parse(await readFile(syncFile, 'utf8'));
  assert.equal(stored.applied.revision, 'latest');
  assert.equal(stored.journal, undefined);
});
