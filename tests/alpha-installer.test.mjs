import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../scripts/Install-IcePackAlpha.mjs', import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'icepack-installer-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = join(root, 'unverified.zip');
  const installRoot = join(root, 'installs');
  await writeFile(input, 'test bytes with an intentionally incorrect expected hash');
  return {
    installRoot,
    run: () => spawnSync(process.execPath, [
      script,
      '--install-root', installRoot,
      '--companion', input,
      '--companion-sha256', '0'.repeat(64),
      '--engine', input,
      '--engine-sha256', '0'.repeat(64),
    ], { encoding: 'utf8', timeout: 10_000 }),
  };
}

test('a hash mismatch leaves no staged or installed files', async t => {
  const { installRoot, run } = await fixture(t);
  const result = run();
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Companion ZIP SHA-256 mismatch/);
  assert.deepEqual(await readdir(installRoot), []);
});

test('the installer preserves an existing version folder', async t => {
  const { installRoot, run } = await fixture(t);
  const installed = join(installRoot, 'v4.6');
  const marker = join(installed, 'keep.txt');
  await mkdir(installed, { recursive: true });
  await writeFile(marker, 'existing install');

  const result = run();
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Installation already exists/);
  assert.equal(await readFile(marker, 'utf8'), 'existing install');
  assert.deepEqual(await readdir(installRoot), ['v4.6']);
});
