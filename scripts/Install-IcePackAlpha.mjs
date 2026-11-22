import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, rename, rm, rmdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { handleInterruption, installPackages, launchInstalled } from './Test-IcePackCleanInstall.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const windows = process.platform === 'win32';
const signal = handleInterruption();

async function verifyArchive(source, copy, expected, label) {
  if (!/^[a-f0-9]{64}$/i.test(expected ?? '')) {
    throw new Error(`Provide the verified SHA-256 for the ${label} ZIP`);
  }
  await copyFile(source, copy);
  const sha = createHash('sha256');
  for await (const chunk of createReadStream(copy)) sha.update(chunk);
  const hash = sha.digest('hex');
  if (hash !== expected.toLowerCase()) throw new Error(`${label} ZIP SHA-256 mismatch`);
  console.log(`PASS ${label} ZIP SHA-256`);
  return hash;
}

function extract(archive, destination) {
  signal.throwIfAborted();
  const command = windows
    ? ['powershell.exe', '-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath $env:ICEPACK_ARCHIVE -DestinationPath $env:ICEPACK_EXTRACT_TO"]
    : ['unzip', '-q', archive, '-d', destination];
  const [executable, ...args] = command;
  const result = spawnSync(executable, args, {
    encoding: 'utf8',
    env: { ...process.env, ICEPACK_ARCHIVE: archive, ICEPACK_EXTRACT_TO: destination },
    timeout: 60_000,
  });
  if (result.error) throw result.error;
  // Info-ZIP normalizes Windows path separators and returns a warning for these archives.
  const normalizedWindowsPaths = !windows && result.status === 1 &&
    /^warning: {2}[^\r\n]+ appears to use backslashes as path separators\s*$/.test(result.stderr);
  if (result.status !== 0 && !normalizedWindowsPaths) {
    throw new Error(`Could not extract ${archive}: ${result.stderr.trim()}`);
  }
}

async function assertAvailable(path) {
  try {
    await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`Installation already exists at ${path}`);
}

async function install(values) {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) {
    throw new Error('Use Node.js 22.12 or newer for these packages');
  }
  const appData = process.env.LOCALAPPDATA;
  const installRoot = values['install-root'] ??
    (appData && join(appData, 'IcePackCompanion', 'alpha-installs'));
  if (!installRoot || !values.companion || !values.engine) {
    throw new Error('Provide --companion <ZIP>, --companion-sha256 <hash>, --engine <ZIP>, --engine-sha256 <hash>, and --install-root <folder> if LOCALAPPDATA is unavailable');
  }
  const parent = resolve(installRoot);
  const destination = join(parent, 'v3.5');
  await assertAvailable(destination);
  await mkdir(parent, { recursive: true });

  const scratch = await mkdtemp(join(parent, '.v3.5-staging-'));
  try {
    const appZip = join(scratch, 'companion.zip');
    const engineZip = join(scratch, 'engine.zip');
    const companionHash = await verifyArchive(values.companion, appZip, values['companion-sha256'], 'Companion');
    const engineHash = await verifyArchive(values.engine, engineZip, values['engine-sha256'], 'ARK Engine');
    const appSource = join(scratch, 'app-source');
    const engineSource = join(scratch, 'engine-source');
    extract(appZip, appSource);
    extract(engineZip, engineSource);

    const staged = join(scratch, 'ready');
    await mkdir(staged);
    const companion = join(staged, 'companion');
    const engine = join(staged, 'engine');
    await rename(join(appSource, 'companion'), companion);
    await rename(join(engineSource, 'engine'), engine);
    installPackages(companion, engine, scratch);
    for (const file of [
      join(companion, 'dist', 'index.html'),
      join(companion, 'agent-bridge', 'bridge.mjs'),
      join(engine, 'server.mjs'),
    ]) {
      if (!(await lstat(file)).isFile()) throw new Error(`Expected installation file: ${file}`);
    }

    for (const name of ['Install-IcePackAlpha.mjs', 'Test-IcePackCleanInstall.mjs']) {
      await copyFile(join(here, name), join(staged, name));
    }
    await writeFile(join(staged, 'alpha-install.json'), JSON.stringify({
      version: '3.5-alpha',
      companionSha256: companionHash,
      engineSha256: engineHash,
    }, null, 2) + '\n');

    signal.throwIfAborted();
    const lock = join(parent, '.v3.5-publish-lock');
    await mkdir(lock);
    try {
      await assertAvailable(destination);
      await rename(staged, destination);
    } finally {
      await rmdir(lock);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  }
  console.log(`PASS installed Ice Pack Companion v3.5 Alpha at ${destination}`);
  console.log(`Start local preview: node "${join(destination, 'Install-IcePackAlpha.mjs')}" --start`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      companion: { type: 'string' },
      'companion-sha256': { type: 'string' },
      engine: { type: 'string' },
      'engine-sha256': { type: 'string' },
      'install-root': { type: 'string' },
      start: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log('Install-IcePackAlpha.mjs --companion <ZIP> --companion-sha256 <hash> --engine <ZIP> --engine-sha256 <hash> [--install-root <folder>]');
    console.log('Run the installed copy with --start to open a local preview session.');
    return;
  }
  if (values.start) {
    if (!(await lstat(join(here, 'alpha-install.json'))).isFile()) throw new Error('Run --start from the installed copy');
    await launchInstalled(here);
    return;
  }
  await install(values);
}

main().catch(error => {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
});
