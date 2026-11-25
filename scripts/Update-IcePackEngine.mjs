import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const updates = [
  {
    path: 'icepack-custom-rules.mjs',
    current: '7590d170e25389df277513301b503840406a2252fc6196df66cbf8fcadb6e927',
    original: [
      'b26538a9b27513f6b91274a2ec75877605a7f61091d40c408d637061a33fff46',
      '43b909e3bd02b22bac1ecef7f3adec2a97fc7ec2d457aa671d15c92ecfe9ad2d',
      '1e45f4e5af341c493f94b3351b5f1672e0cfe914e145268cb6a9d6a82d03645f',
      '93f509421899de3195c510e113713d8f480dad08494774daf7555368b5abecc6',
      '24258b8581f7e039973596c6eacf8e19871c8a233d1c3d3f1355afd481fc4feb',
    ],
  },
  {
    path: 'public/index.html',
    current: 'c3d2c8c652508af2de701fe11c52a7b50e5b56036fcd58e80558d22f2228da38',
    original: ['847d9f1014035f503211f7262fdfc9b74da25f1ded15746a27ae02d158226fe3', '1a2c0d9ee21742692c5eb3512ad44f83f3d250f1f2e686c36ed6749d7d95d63d', 'e28241100f40d76a91493ca52ec66fa03e8970b405621902346167da59b1e44b', '36c54c8b2c38e36beabdf8043b8c26e5e359e0c4a52ad1f031a11df6fad32b0b', '5bc4133b4c71a413db39acc9c129cf518e225bbbac593ec02f677ba9fcb19cf8'],
  },
];
const giftInputUpdate = {
  path: 'server.mjs',
  current: '595a25ea3fe972c662bfa0033e218b41dbac48298d92dcfd262611be9e77b041',
  original: ['4d48d81bb3d984513a1daae69aa266e580659ccf350259f8edda70165e9cb985',
    '59e8780acb206d4e7d2e4c5c1a36fc563efaef887b6e8dfaadd867f3685deeda',
    'fe05149327738297a566b473bab5df17e50b1faf201720681e82b818effab966',
    '83c633e4257304c7c25ed6d9b70adfb4eaea69c612a610d060f4c738446cdb33',
    'be5eac7a1d4cb9bb7f2e9af060c2dfc4ada72a33ccb1c44e22e08efdf12f2d03'],
};

const backupPrefix = '.icepack-engine-backup-';

async function regularFile(path) {
  const stat = await lstat(path);
  if (!stat.isFile()) throw new Error(`Expected a regular file: ${path}`);
  return stat;
}

async function enginePath(override) {
  if (override) return realpath(override);
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA) {
    throw new Error('Provide --engine with the folder containing server.mjs.');
  }
  const settings = join(process.env.LOCALAPPDATA, 'IcePackCompanion', 'settings.json');
  let installed;
  try {
    installed = JSON.parse((await readFile(settings, 'utf8')).replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const configured = installed?.enginePath;
  return realpath(typeof configured === 'string' && configured.trim() ? configured : 'C:\\IcePackARK\\ice-pack-ark');
}

async function updateSource() {
  for (const folder of ['engine-overlay', 'engine']) {
    const candidate = join(here, folder);
    try {
      if (!(await lstat(candidate)).isDirectory()) {
        throw new Error(`Expected an update source directory: ${candidate}`);
      }
      return await realpath(candidate);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  throw new Error('Update files missing. Run the updater from the Northpath checkout or an installed alpha.');
}

async function readVersion(root, spec, currentOnly = false) {
  const path = join(root, spec.path);
  const { mode } = await regularFile(path);
  const bytes = await readFile(path);
  // The same Git source may use Windows line endings.
  const hash = createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
  if (hash !== spec.current && (currentOnly || !spec.original.includes(hash))) {
    throw new Error(`Unrecognized version of ${path}. Review any local changes before updating.`);
  }
  return { path, bytes, mode, hash };
}

async function planUpdate(engine, source, restoring, selected) {
  await regularFile(join(engine, 'server.mjs'));
  if (!(await lstat(join(engine, 'public'))).isDirectory()) {
    throw new Error('Expected a regular public directory in the target engine.');
  }
  if (!(await lstat(join(source, 'public'))).isDirectory()) {
    throw new Error('Expected a regular public directory in the update source.');
  }
  const plan = [];
  for (const spec of selected) {
    const before = await readVersion(engine, spec);
    const after = await readVersion(source, spec, !restoring);
    plan.push({ before, after });
  }
  const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], {
    input: plan[0].after.bytes,
    encoding: 'utf8',
    timeout: 5000,
  });
  if (syntax.error) throw syntax.error;
  if (syntax.status !== 0) throw new Error(`The proposed ${selected[0].path} failed its syntax check.`);
  return plan;
}

async function replaceFile(path, bytes, mode) {
  const staged = join(dirname(path), `.icepack-staged-${randomUUID()}`);
  try {
    await writeFile(staged, bytes, { flag: 'wx', mode });
    await rename(staged, path);
  } finally {
    await rm(staged, { force: true });
  }
}

async function applyPlan(engine, plan) {
  const changes = plan.filter(({ before, after }) => before.hash !== after.hash);
  if (!changes.length) {
    console.log('PASS Target files already match.');
    return;
  }
  const backup = await mkdtemp(join(engine, backupPrefix));
  await mkdir(join(backup, 'public'));
  for (const { before } of plan) {
    await writeFile(join(backup, relative(engine, before.path)), before.bytes, { flag: 'wx' });
  }
  console.log(`Backup: ${backup}`);

  const replaced = [];
  try {
    for (const row of changes) {
      if (!(await readFile(row.before.path)).equals(row.before.bytes)) {
        throw new Error(`The target changed during the update: ${row.before.path}`);
      }
      await replaceFile(row.before.path, row.after.bytes, row.before.mode);
      replaced.push(row);
      if (!(await readFile(row.before.path)).equals(row.after.bytes)) {
        throw new Error(`Verification failed for ${row.before.path}`);
      }
    }
  } catch (error) {
    const failures = [];
    for (const { before } of replaced.reverse()) {
      try {
        await replaceFile(before.path, before.bytes, before.mode);
      } catch (restoreError) {
        failures.push(restoreError.message);
      }
    }
    const status = failures.length ? `Automatic restore incomplete. Use the backup at ${backup}.` : 'Previous files restored.';
    throw new Error(`${error.message} ${status}`);
  }
  console.log('PASS Engine files updated and verified. Restart through the Control Center when ready.');
}

async function reserveEnginePort() {
  const server = createServer(socket => socket.destroy());
  server.listen({ host: '127.0.0.1', port: 3210, exclusive: true });
  try {
    await once(server, 'listening');
  } catch (error) {
    if (error.code === 'EADDRINUSE') throw new Error('Port 3210 is busy. Stop the engine through the Control Center first.');
    throw error;
  }
  return server;
}

async function main() {
  const { values } = parseArgs({
    options: {
      engine: { type: 'string' },
      'gift-input': { type: 'boolean' },
      apply: { type: 'boolean' },
      restore: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log('Update-IcePackEngine.mjs [--engine <engine-folder>] [--gift-input] [--restore <backup-folder>] [--apply]');
    return;
  }
  const engine = await enginePath(values.engine);
  const bundledSource = await updateSource();
  if (engine === bundledSource) throw new Error('Choose a target engine folder separate from the update source.');
  let source = bundledSource;
  if (values.restore !== undefined) {
    source = await realpath(resolve(values.restore));
    if (dirname(source) !== engine || !basename(source).startsWith(backupPrefix)) {
      throw new Error('Select a backup folder created by this updater inside the target engine.');
    }
  }
  const reservation = values.apply ? await reserveEnginePort() : null;
  try {
    const plan = await planUpdate(engine, source, values.restore !== undefined, values['gift-input'] ? [giftInputUpdate] : updates);
    console.log(`Target engine: ${engine}`);
    console.log(`${values.restore === undefined ? 'Update' : 'Restore'} source: ${source}`);
    for (const { before, after } of plan) {
      console.log(`${before.hash === after.hash ? 'CURRENT' : 'UPDATE'} ${before.path}`);
    }
    if (values.apply) await applyPlan(engine, plan);
    else console.log('Dry run complete. Run again with --apply after stopping the engine to make changes.');
  } finally {
    if (reservation) await new Promise(done => reservation.close(done));
  }
}

main().catch(error => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
