import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { writeMigrationPackage } from '../scripts/Stage-IcePackMigration.mjs';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'icepack-migration-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return join(root, 'new package');
}

test('staged receipt records the baseline and hashes the exact staged bytes', async t => {
  const destination = await fixture(t);
  const config = { schemaVersion: 2, kits: [], rules: [] };
  await writeMigrationPackage(destination, { 'streamer-config-v2.json': config }, { baselineSha256: 'baseline' });
  const receipt = JSON.parse(await readFile(join(destination, 'migration-receipt.json'), 'utf8'));
  const data = await readFile(join(destination, 'streamer-config-v2.json'));
  assert.equal(receipt.schemaVersion, 1);
  assert.equal(receipt.baselineSha256, 'baseline');
  assert.equal(receipt.files['streamer-config-v2.json'], createHash('sha256').update(data).digest('hex'));
  assert.deepEqual(JSON.parse(data), config);
});

test('a staging folder that already exists is left alone', async t => {
  const destination = await fixture(t);
  await mkdir(destination);
  await writeFile(join(destination, 'keep.txt'), 'existing contents');
  await assert.rejects(writeMigrationPackage(destination, { 'new.json': {} }, {}), { code: 'EEXIST' });
  assert.deepEqual(await readdir(destination), ['keep.txt']);
});
