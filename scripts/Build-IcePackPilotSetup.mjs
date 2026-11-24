import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { copyFile, cp, lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const companionSource = join(here, '..', 'companion');
const windows = process.platform === 'win32';
const nodeVersion = '24.22.3';
const nsisVersion = '3.11';
const hashes = {
  companion: '4b62baaf30c40db0edf4301aab577a86026b32336ee0ad384b21eac7c65588ad',
  engine: '127885ec1bf5e8f57823af7e32fcda4c8f59ed042523ca09e65c7ad9d71b565d',
  node: '86fc4785327db5f5c7558dc6156c543b433c313e813a222e088086222ab4afa6',
  license: '5888dbb9a1d2b18f2c3e6c5f6af1b39de658372b402a0577b002777f14c62ace',
  nsis: 'c7d27f780ddb6cffb4730138cd1591e841f4b7edb155856901cdf5f214394fa1',
};
const archives = {
  companion: 'IcePackCompanion-source-bundle-20261121-232035-21cf89ee.zip',
  engine: 'IcePackCompanion-engine-source-20261121-233053-1b0ec6a3.zip',
};

async function sha256(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function verifyFile(path, hash, label) {
  const info = await lstat(path).catch(error => {
    if (error.code === 'ENOENT') throw new Error(`Missing ${label} at ${path}`);
    throw error;
  });
  if (!info.isFile()) throw new Error(`Expected a regular file for ${label} at ${path}`);
  if (await sha256(path) !== hash) throw new Error(`${label} SHA-256 mismatch: ${path}`);
}

async function copyVerified(source, target, hash, label) {
  await copyFile(source, target);
  await verifyFile(target, hash, label);
}

function run(executable, args, options = {}, accept = result => result.status === 0) {
  const result = spawnSync(executable, args, { ...options, stdio: 'inherit', timeout: 300_000 });
  if (result.error) throw result.error;
  if (!accept(result)) throw new Error(`${basename(executable)} failed (${result.status ?? result.signal})`);
}

async function copyEntries(source, target, names) {
  for (const name of names) await cp(join(source, name), join(target, name), { recursive: true });
}

function installWindowsDependencies(target, cache, depth) {
  const args = ['ci', '--no-audit', '--no-fund', '--ignore-scripts', '--bin-links=false', '--os=win32', '--cpu=x64', depth];
  const executable = windows ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
  run(executable, windows ? ['/d', '/c', 'npm.cmd', ...args] : args, {
    cwd: target,
    env: {
      ...process.env,
      npm_config_cache: cache,
      npm_config_userconfig: join(cache, 'empty-user-npmrc'),
      npm_config_globalconfig: join(cache, 'empty-global-npmrc'),
    },
  });
}

async function stageStreamer(values, payload, scratch, version) {
  const archive = join(scratch, 'engine.zip');
  await copyVerified(resolve(values.engine), archive, hashes.engine, 'ARK Engine source ZIP');
  console.log('PASS ARK Engine ZIP SHA-256');
  const extracted = join(scratch, 'engine-source');
  if (windows) {
    run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath $env:ICEPACK_ARCHIVE -DestinationPath $env:ICEPACK_EXTRACT_TO"], {
      env: { ...process.env, ICEPACK_ARCHIVE: archive, ICEPACK_EXTRACT_TO: extracted },
    });
  } else {
    // Info-ZIP reports warning status 1 for the backslashes in this verified Windows archive.
    run('unzip', ['-q', archive, '-d', extracted], {}, result => [0, 1].includes(result.status));
  }
  const engine = join(payload, 'engine');
  await mkdir(engine);
  await copyEntries(join(extracted, 'engine'), engine, [
    'engine.mjs', 'icepack-config-engine.mjs', 'icepack-gift-rcon.mjs', 'icepack-spawn-rcon.mjs',
    'package.json', 'package-lock.json',
  ]);
  await copyEntries(join(here, 'engine-overlay'), engine, ['server.mjs', 'icepack-custom-rules.mjs']);
  installWindowsDependencies(engine, join(scratch, 'npm-cache'), '--omit=dev');

  const companion = join(payload, 'companion');
  const bridgeSource = join(companionSource, 'agent-bridge');
  const bridge = join(companion, 'agent-bridge');
  await mkdir(bridge, { recursive: true });
  const bridgeModules = (await readdir(bridgeSource, { withFileTypes: true }))
    .filter(entry => entry.isFile() && entry.name.endsWith('.mjs'));
  await copyEntries(bridgeSource, bridge, bridgeModules.map(entry => entry.name));
  await mkdir(join(companion, 'src'));
  await copyEntries(join(companionSource, 'src'), join(companion, 'src'), ['icepack-release.json', 'reviewed-catalog.json']);

  const scripts = join(payload, 'scripts');
  await mkdir(join(scripts, 'windows'), { recursive: true });
  await copyEntries(here, scripts, [
    'Common.ps1', 'IcePack-StreamerCommon.ps1', 'IcePack-ManagedCommon.ps1', 'IcePack-Health.ps1',
    'IcePack-OperationsTheme.cs', 'IcePack-Release.ps1', 'IcePack-ConfigCommon.ps1',
    'Open-IcePackControlCenter.ps1',
    'Start-IcePackCompanionManaged.ps1', 'Start-IcePackBackground.ps1',
    'Stop-IcePackCompanionManaged.ps1', 'Stop-IcePackBackground.ps1',
    'AutoBackup-IcePackConfiguration.ps1', 'Backup-IcePackConfiguration.ps1',
  ]);
  await copyEntries(join(here, 'windows'), join(scripts, 'windows'), ['WebsiteConnection.mjs']);
  await writeFile(join(payload, 'streamer-install.json'), JSON.stringify({ version }) + '\n');
}

async function stagePilot(values, payload, scratch, version) {
  const alphaRoot = join(scratch, 'alpha');
  run(process.execPath, [join(here, 'Install-IcePackAlpha.mjs'), '--install-root', alphaRoot,
    '--companion', resolve(values.companion), '--companion-sha256', hashes.companion,
    '--engine', resolve(values.engine), '--engine-sha256', hashes.engine]);
  const installed = join(alphaRoot, `v${version}`);
  await copyEntries(installed, payload, ['Test-IcePackCleanInstall.mjs', 'Test-IcePackEngineDraft.mjs', 'preview-rules', 'alpha-install.json']);
  await copyEntries(join(here, 'windows'), payload, ['Start-IcePackPilot.mjs', 'WebsiteConnection.mjs']);
  const companion = join(payload, 'companion');
  const engine = join(payload, 'engine');
  await mkdir(join(companion, 'src'), { recursive: true });
  await copyEntries(join(installed, 'companion'), companion, ['agent-bridge', 'dist', 'package.json', 'package-lock.json', 'vite.config.ts']);
  await copyFile(join(companionSource, 'src', 'reviewed-catalog.json'), join(companion, 'src', 'catalog.json'));
  await mkdir(engine);
  await copyEntries(join(installed, 'engine'), engine, ['engine.mjs', 'icepack-config-engine.mjs', 'icepack-custom-rules.mjs',
    'icepack-gift-rcon.mjs', 'icepack-spawn-rcon.mjs', 'package.json', 'package-lock.json', 'public', 'rules-v06.json', 'server.mjs']);
  await rm(alphaRoot, { recursive: true });
  const cache = join(scratch, 'npm-cache');
  installWindowsDependencies(companion, cache, '--include=dev');
  installWindowsDependencies(engine, cache, '--omit=dev');
  const rolldown = join(companion, 'node_modules', '@rolldown', 'binding-win32-x64-msvc', 'rolldown-binding.win32-x64-msvc.node');
  if (!(await lstat(rolldown)).isFile()) throw new Error('Windows x64 dashboard binding is missing');
}

async function build(values, nsisRoot) {
  const metadata = JSON.parse(await readFile(join(companionSource, 'src', 'icepack-release.json'), 'utf8'));
  const version = /^(\d+\.\d+)-alpha$/.exec(metadata.version)?.[1];
  if (!version) throw new Error('Invalid Companion version');
  const scratch = await mkdtemp(join(tmpdir(), 'icepack-pilot-build-'));
  try {
    const payload = join(scratch, 'payload');
    const runtime = join(payload, 'runtime');
    await mkdir(runtime, { recursive: true });
    await copyVerified(values.node, join(runtime, 'node.exe'), hashes.node, `Node.js v${nodeVersion} Windows x64`);
    await copyVerified(values['node-license'], join(runtime, 'LICENSE.txt'), hashes.license, 'Node.js license');
    console.log(`PASS bundled Node.js v${nodeVersion} Windows x64 SHA-256`);

    if (values.streamer) await stageStreamer(values, payload, scratch, version);
    else await stagePilot(values, payload, scratch, version);

    const edition = values.streamer ? 'Streamer' : 'Pilot';
    const artifact = `IcePackCompanion${edition}-${version}-win-x64-Setup.exe`;
    const setup = join(scratch, artifact);
    const define = (name, value) => `${windows ? '/D' : '-D'}${name}=${value}`;
    const compilerOptions = nsisRoot ? { env: { ...process.env, NSISDIR: nsisRoot } } : {};
    run(values.makensis ?? 'makensis', [windows ? '/WX' : '-WX', define('PILOT_VERSION', version), define('PAYLOAD_FILES', join(payload, '*')),
      define('SETUP_FILE', setup), ...(values.streamer ? [define('STREAMER_SETUP', '1')] : []),
      join(here, 'windows', 'IcePackPilotSetup.nsi')], compilerOptions);
    const digest = await sha256(setup);
    const output = resolve(values.out);
    await mkdir(output, { recursive: true });
    const destination = join(output, artifact);
    await copyFile(setup, destination, constants.COPYFILE_EXCL);
    try {
      await writeFile(`${destination}.sha256`, `${digest}  ${artifact}\n`, { flag: 'wx' });
    } catch (error) {
      await rm(destination);
      throw error;
    }
    console.log(`PASS Windows ${edition.toLowerCase()} setup: ${destination}`);
    console.log(`SHA-256: ${digest}`);
  } finally {
    await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  }
}

async function buildOnWindows(values) {
  if (!windows) throw new Error('Run --local on Windows or supply the toolchain and source paths explicitly.');
  if (values.node || values['node-license'] || values.makensis) {
    throw new Error('--local downloads the build tools. Omit --local when supplying your own toolchain.');
  }
  const localAppData = process.env.LOCALAPPDATA;
  const userProfile = process.env.USERPROFILE;
  if (!localAppData || !userProfile) throw new Error('Run --local from your Windows user session.');
  const released = join(localAppData, 'IcePackCompanion', 'releases');
  const companion = values.companion ?? join(released, archives.companion);
  const engine = values.engine ?? join(released, archives.engine);
  if (!values.streamer) await verifyFile(companion, hashes.companion, 'Companion source ZIP');
  await verifyFile(engine, hashes.engine, 'ARK Engine source ZIP');

  const scratch = await mkdtemp(join(tmpdir(), 'icepack-pilot-tools-'));
  try {
    const system = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
    const node = join(scratch, 'node.exe');
    const license = join(scratch, 'NODE-LICENSE.txt');
    const nsisZip = join(scratch, `nsis-${nsisVersion}.zip`);
    const downloads = [
      { name: `Node.js ${nodeVersion} Windows x64`, path: node, hash: hashes.node,
        url: `https://nodejs.org/dist/v${nodeVersion}/win-x64/node.exe` },
      { name: 'Node.js license', path: license, hash: hashes.license,
        url: `https://raw.githubusercontent.com/nodejs/node/v${nodeVersion}/LICENSE` },
      { name: `NSIS ${nsisVersion} portable`, path: nsisZip, hash: hashes.nsis,
        url: `https://downloads.sourceforge.net/project/nsis/NSIS%203/${nsisVersion}/nsis-${nsisVersion}.zip` },
    ];
    for (const { name, path, hash, url } of downloads) {
      console.log(`Downloading ${name}…`);
      run(join(system, 'curl.exe'), ['--disable', '--proto', '=https', '--proto-redir', '=https', '--fail', '--location',
        '--retry', '2', '--max-time', '180', '--output', path, url]);
      await verifyFile(path, hash, name);
    }

    const extracted = join(scratch, 'compiler');
    run(join(system, 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command',
      "$ErrorActionPreference = 'Stop'; Expand-Archive -LiteralPath $env:ICEPACK_NSIS_ZIP -DestinationPath $env:ICEPACK_NSIS_DIR"], {
      env: { ...process.env, ICEPACK_NSIS_ZIP: nsisZip, ICEPACK_NSIS_DIR: extracted },
    });
    const nsisRoot = join(extracted, `nsis-${nsisVersion}`);
    await build({
      companion, engine, node, 'node-license': license, makensis: join(nsisRoot, 'makensis.exe'),
      streamer: values.streamer,
      out: values.out ?? join(userProfile, 'Downloads', values.streamer ? 'IcePackCompanionStreamer' : 'IcePackCompanionPilot'),
    }, nsisRoot);
  } finally {
    await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  }
}

try {
  const required = ['companion', 'engine', 'node', 'node-license', 'out'];
  const { values } = parseArgs({ options: {
    ...Object.fromEntries([...required, 'makensis'].map(name => [name, { type: 'string' }])),
    local: { type: 'boolean' },
    streamer: { type: 'boolean' },
  } });
  if (values.local) await buildOnWindows(values);
  else {
    const needed = values.streamer ? required.filter(name => name !== 'companion') : required;
    if (needed.some(name => !values[name])) throw new Error(`Use --local on Windows or pass ${needed.map(name => `--${name} <path>`).join(' ')}`);
    await build(values);
  }
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
