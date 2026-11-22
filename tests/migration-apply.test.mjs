import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { readMigrationPackage } from '../scripts/Apply-IcePackMigration.mjs';

const exec = promisify(execFile);
const script = fileURLToPath(new URL('../scripts/Apply-IcePackMigration.mjs', import.meta.url));
const rulesName = 'streamer-config-v2.json';
const catalogName = 'ark-catalog-v2.json';
const sha256 = text => createHash('sha256').update(text).digest('hex');

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'icepack-apply-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const staged = join(root, 'stage');
  await mkdir(staged);
  const rules = JSON.stringify({ schemaVersion: 2, rules: [], kits: [] });
  const catalog = JSON.stringify({ schemaVersion: 2, items: [], dinosaurs: [] });
  await writeFile(join(staged, rulesName), rules);
  await writeFile(join(staged, catalogName), catalog);
  await writeFile(join(staged, 'migration-receipt.json'), JSON.stringify({
    schemaVersion: 1,
    baselineSha256: sha256(rules),
    catalogSha256: sha256(catalog),
    contentPrefsSha256: null,
    files: { [rulesName]: sha256(rules), [catalogName]: sha256(catalog) },
  }));
  return { root, staged };
}

test('reads intact staged files and detects a changed draft', async t => {
  const { staged } = await fixture(t);
  const migration = await readMigrationPackage(staged);
  assert.equal(migration.staged[rulesName].value.schemaVersion, 2);
  await writeFile(join(staged, rulesName), '{}');
  await assert.rejects(readMigrationPackage(staged), /Staged hash mismatch/);
});

test('apply refuses an unmarked folder without leaving a lock or backup', async t => {
  const { root, staged } = await fixture(t);
  const target = join(root, 'regular Kit Editor');
  await mkdir(target);
  await writeFile(join(target, rulesName), '{}');
  await assert.rejects(exec(process.execPath, [script, '--package', staged, '--spare', target, '--apply']), {
    stderr: /Create a spare copy with --create-from/,
  });
  assert.deepEqual(await readdir(target), [rulesName]);
});

test('regular migration refuses a Kit Editor path that differs from the engine path', async t => {
  const { root, staged } = await fixture(t);
  const appData = join(root, 'LocalAppData');
  const settings = join(appData, 'IcePackCompanion');
  const engine = join(root, 'regular engine');
  const defaultKit = join(engine, 'icepack-catalog-manager');
  const otherKit = join(root, 'different Kit Editor');
  await mkdir(defaultKit, { recursive: true });
  await mkdir(otherKit);
  await mkdir(settings, { recursive: true });
  await writeFile(join(settings, 'settings.json'), JSON.stringify({enginePath:engine,kitDir:otherKit}));
  const env = { ...process.env, LOCALAPPDATA: appData, ICEPACK_KIT_DIR: defaultKit };
  await assert.rejects(exec(process.execPath, [script, '--package', staged, '--regular', '--apply'], {env}), {
    stderr: /point to different Kit Editor folders/,
  });
  assert.deepEqual(await readdir(otherKit), []);
});
