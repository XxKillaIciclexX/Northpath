import assert from 'node:assert/strict';
import test from 'node:test';
import { assessReadiness, compareLoadedMigration } from '../scripts/Verify-IcePackMigration.mjs';

const receipt = {
  baselineSha256: 'a'.repeat(64),
  catalogSha256: 'b'.repeat(64),
  contentPrefsSha256: null,
  files: {
    'streamer-config-v2.json': 'c'.repeat(64),
    'ark-catalog-v2.json': 'd'.repeat(64),
  },
};

const loaded = {
  loaded: true,
  ruleCount: 4,
  kitCount: 1,
  loadedFingerprints: {
    rules: receipt.files['streamer-config-v2.json'],
    catalog: receipt.catalogSha256,
    contentPrefs: null,
  },
};

test('matches the staged rules with the original Kit Editor catalog', () => {
  assert.deepEqual(compareLoadedMigration(loaded, receipt), {
    status: 'match',
    checks: [
      { file: 'rules', matches: true },
      { file: 'catalog', matches: true },
      { file: 'contentPrefs', matches: true },
    ],
  });
});

test('detects stale rules with identical counts and can verify the restored baseline', () => {
  const baseline = {
    ...loaded,
    loadedFingerprints: { ...loaded.loadedFingerprints, rules: receipt.baselineSha256 },
  };
  assert.deepEqual(compareLoadedMigration(baseline, receipt), {
    status: 'mismatch',
    checks: [
      { file: 'rules', matches: false },
      { file: 'catalog', matches: true },
      { file: 'contentPrefs', matches: true },
    ],
  });
  assert.equal(compareLoadedMigration(baseline, receipt, true).status, 'match');
});

test('detects catalog and content preference differences independently of the rules', () => {
  const expectedPrefs = 'e'.repeat(64);
  const wrongContext = {
    ...loaded,
    loadedFingerprints: {
      ...loaded.loadedFingerprints,
      catalog: receipt.files['ark-catalog-v2.json'],
    },
  };
  assert.deepEqual(compareLoadedMigration(wrongContext, { ...receipt, contentPrefsSha256: expectedPrefs }), {
    status: 'mismatch',
    checks: [
      { file: 'rules', matches: true },
      { file: 'catalog', matches: false },
      { file: 'contentPrefs', matches: false },
    ],
  });
  const matchingContext = {
    ...loaded,
    loadedFingerprints: { ...loaded.loadedFingerprints, contentPrefs: expectedPrefs },
  };
  assert.equal(compareLoadedMigration(matchingContext, { ...receipt, contentPrefsSha256: expectedPrefs }).status, 'match');
  assert.equal(compareLoadedMigration(matchingContext, receipt).status, 'mismatch');
});

test('requires engine support and a successful load', () => {
  assert.deepEqual(compareLoadedMigration({ loaded: true }, receipt), { status: 'unsupported' });
  assert.deepEqual(compareLoadedMigration({ loaded: false, loadedFingerprints: null }, receipt), {
    status: 'not-loaded',
  });
});

function readyState() {
  return {
    armed: false,
    autoEnabled: false,
    pending: 0,
    active: null,
    rewardPending: 0,
    giftRcon: { mode: 'off', queued: 0, inflight: false },
    customRules: {
      ...loaded,
      mode: 'preview',
      playerIdConfigured: true,
      queued: 0,
      inflight: false,
      preparation: { prepared: 3, blocked: 0, disabled: 1, blockedExamples: [] },
    },
  };
}

const readiness = state => assessReadiness(state, compareLoadedMigration(state.customRules, receipt));

test('pre-Live readiness requires the matching load, prepared rules, and idle Preview mode', () => {
  const state = readyState();
  assert.equal(readiness(state).ready, true);
  state.customRules.loadedFingerprints = { ...loaded.loadedFingerprints, rules: receipt.baselineSha256 };
  assert.equal(readiness(state).ready, false);
  assert.equal(assessReadiness(state, compareLoadedMigration(state.customRules, receipt, true)).ready, true);
});

test('each unsafe lane or missing target blocks readiness', () => {
  const unsafe = [
    { customRules: { mode: 'live' } },
    { customRules: { mode: 'off' } },
    { customRules: { playerIdConfigured: false } },
    { customRules: { queued: 1 } },
    { customRules: { inflight: true } },
    { armed: true },
    { autoEnabled: true },
    { pending: 1 },
    { active: { mode: 'manual' } },
    { rewardPending: 1 },
    { giftRcon: { mode: 'preview' } },
    { giftRcon: { queued: 1 } },
    { giftRcon: { inflight: true } },
  ];
  for (const { customRules, giftRcon, ...flags } of unsafe) {
    const state = readyState();
    Object.assign(state, flags);
    Object.assign(state.customRules, customRules);
    Object.assign(state.giftRcon, giftRcon);
    const report = readiness(state);
    assert.equal(report.ready, false);
    assert.equal(report.safety.filter(check => !check.pass).length, 1);
  }
});

test('blocked, all-disabled, and unloaded rules prevent readiness', () => {
  const state = readyState();
  state.customRules.preparation = {
    prepared: 2, blocked: 1, disabled: 1,
    blockedExamples: [{ ruleId: 'rose', gift: 'Rose', reason: 'Unsupported item' }],
  };
  assert.equal(readiness(state).ready, false);
  state.customRules.preparation = { prepared: 0, blocked: 0, disabled: 4, blockedExamples: [] };
  assert.equal(readiness(state).ready, false);
  Object.assign(state.customRules, { loaded: false, loadedFingerprints: null, preparation: null });
  assert.equal(readiness(state).ready, false);
});

test('a pre-v5.5 engine or incomplete preparation data cannot pass readiness', () => {
  const state = readyState();
  state.customRules.preparation = { prepared: 1, blocked: 0, disabled: 0, blockedExamples: [] };
  assert.throws(() => readiness(state), /incomplete rule preparation/);
  delete state.customRules.preparation;
  assert.throws(() => readiness(state), /Apply the v5.5 engine update/);
});
