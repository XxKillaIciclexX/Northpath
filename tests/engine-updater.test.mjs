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

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'icepack-updater-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const engine = join(root, 'target engine');
  const updater = join(root, 'Update-IcePackEngine.mjs');
  await cp(script, updater);
  await cp(source, join(root, 'engine'), { recursive: true });
  await cp(source, engine, { recursive: true });
  await writeFile(join(engine, 'server.mjs'), '');
  return { engine, run: (...args) => exec(process.execPath, [updater, '--engine', engine, ...args]) };
}

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
