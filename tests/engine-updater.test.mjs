import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const source = fileURLToPath(new URL('../scripts/engine-overlay', import.meta.url));
const script = fileURLToPath(new URL('../scripts/Update-IcePackEngine.mjs', import.meta.url));

async function fixture(t, sourceFolder = 'engine') {
  const root = await mkdtemp(join(tmpdir(), 'icepack-updater-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const engine = join(root, 'target engine');
  const updater = join(root, 'Update-IcePackEngine.mjs');
  await cp(script, updater);
  await cp(source, join(root, sourceFolder), { recursive: true });
  await cp(source, engine, { recursive: true });
  await writeFile(join(engine, 'server.mjs'), '');
  return { engine, run: (...args) => exec(process.execPath, [updater, '--engine', engine, ...args]) };
}

test('the checkout updater uses the checked-in engine overlay without an alpha installation', async t => {
  const { engine, run } = await fixture(t, 'engine-overlay');
  const { stdout } = await run();
  assert.match(stdout, /Update source: .*engine-overlay/);
  assert.equal((stdout.match(/^CURRENT /gm) ?? []).length, 2);
  assert.deepEqual((await readdir(engine)).sort(), ['icepack-custom-rules.mjs', 'public', 'server.mjs']);
});

test('the updater defaults to a dry run and accepts Windows line endings', async t => {
  const { engine, run } = await fixture(t);
  const target = join(engine, 'icepack-custom-rules.mjs');
  const content = (await readFile(target, 'utf8')).replace(/\r?\n/g, '\r\n');
  await writeFile(target, content);
  const result = await run();
  assert.match(result.stdout, /CURRENT/);
  assert.match(result.stdout, /Dry run complete/);
  assert.equal(await readFile(target, 'utf8'), content);
  assert.deepEqual((await readdir(engine)).sort(), ['icepack-custom-rules.mjs', 'public', 'server.mjs']);
});

test('a locally modified file or untrusted backup is refused before writes', async t => {
  const { engine, run } = await fixture(t);
  await assert.rejects(run('--restore', engine), { stderr: /Select a backup folder/ });
  const target = join(engine, 'public', 'index.html');
  await writeFile(target, '<p>Local customization</p>');
  await assert.rejects(run(), { stderr: /Unrecognized version/ });
  assert.equal(await readFile(target, 'utf8'), '<p>Local customization</p>');
  assert.deepEqual((await readdir(engine)).sort(), ['icepack-custom-rules.mjs', 'public', 'server.mjs']);
});

test('the gift input update checks only the engine entry point', async t => {
  const { engine, run } = await fixture(t, 'engine-overlay');
  const entry = join(engine, 'server.mjs');
  const current = await readFile(join(source, 'server.mjs'), 'utf8');
  await writeFile(entry, current.replace(/\n/g, '\r\n'));
  await writeFile(join(engine, 'public', 'index.html'), '<p>Local dashboard</p>');
  const { stdout } = await run('--gift-input');
  assert.deepEqual(stdout.match(/^CURRENT .*$/gm), [`CURRENT ${entry}`]);
  await writeFile(entry, `${current}\n// Local customization\n`);
  await assert.rejects(run('--gift-input'), { stderr: /Unrecognized version/ });
});
