import assert from 'node:assert/strict';
import test from 'node:test';
import { compareLoadedMigration } from '../scripts/Verify-IcePackMigration.mjs';

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
