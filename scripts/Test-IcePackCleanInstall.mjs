import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { cp, lstat, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

const windows = process.platform === 'win32';
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(path|systemroot|windir|comspec|pathext|temp|tmp|tmpdir|home|userprofile|appdata|localappdata)$/i.test(key)
));
const npmNetworkEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
  /^(https?_proxy|no_proxy|node_extra_ca_certs|ssl_cert_file)$/i.test(key)
));
const excluded = /^(?:\.git|\.npmrc|\.env(?:\..*)?|node_modules|dist|\.northpath-sync-backups)$/i;
const interruption = new AbortController();
const stop = () => interruption.abort(new Error('Clean-install check interrupted'));

async function stage(source, destination) {
  if (!(await lstat(source)).isDirectory()) {
    throw new Error(`Expected an extracted source directory at ${source}`);
  }
  await cp(source, destination, {
    recursive: true,
    async filter(path) {
      if (path !== source && excluded.test(basename(path))) return false;
      const info = await lstat(path);
      if (!info.isDirectory() && !info.isFile()) {
        throw new Error(`Unsupported source entry: ${relative(source, path)}`);
      }
      return true;
    },
  });
}

function npm(args, cwd, scratch) {
  interruption.signal.throwIfAborted();
  const executable = windows ? (env.ComSpec ?? env.COMSPEC ?? 'cmd.exe') : 'npm';
  const command = windows ? ['/d', '/c', 'npm.cmd', ...args] : args;
  const result = spawnSync(executable, command, {
    cwd,
    env: {
      ...env,
      ...npmNetworkEnv,
      npm_config_cache: join(scratch, 'npm-cache'),
      npm_config_userconfig: join(scratch, 'empty-user-npmrc'),
      npm_config_globalconfig: join(scratch, 'empty-global-npmrc'),
    },
    stdio: 'inherit',
    timeout: 300_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm ${args.join(' ')} failed in ${cwd}`);
}

export function installPackages(companion, engine, scratch) {
  npm(['ci', '--no-audit', '--no-fund'], companion, scratch);
  npm(['ci', '--no-audit', '--no-fund'], engine, scratch);
  npm(['run', 'build'], companion, scratch);
}

function service(cwd, entry, address, label, args = []) {
  const url = new URL(address);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port ||
      url.username || url.password) {
    throw new Error(`${label} requires an HTTP probe URL on 127.0.0.1 with an explicit port`);
  }
  const file = resolve(cwd, entry);
  const location = relative(cwd, file);
  if (!location || isAbsolute(location) || location === '..' || location.startsWith(`..${sep}`)) {
    throw new Error(`${label} entry must be inside the staged source directory`);
  }
  return { cwd, file, url, label, args };
}

async function requireAvailablePort({ url, label }) {
  const socket = createServer();
  try {
    socket.listen({ host: url.hostname, port: Number(url.port), exclusive: true });
    await once(socket, 'listening');
  } catch (error) {
    throw new Error(`${label} probe port ${url.port} is unavailable: ${error.code}`);
  } finally {
    if (socket.listening) await new Promise(resolveClose => socket.close(resolveClose));
  }
}

async function start({ cwd, file, url, label, args, environment = env }, children) {
  await requireAvailablePort({ url, label });
  const child = spawn(process.execPath, [file, ...args], { cwd, env: environment, stdio: 'inherit' });
  const closed = new Promise(resolveClose => child.once('close', resolveClose));
  let startupError;
  child.on('error', error => { startupError = error; });
  children.push({ child, closed, label });

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    interruption.signal.throwIfAborted();
    if (startupError) throw startupError;
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`${label} exited before passing its HTTP probe`);
    }
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(750),
    }).catch(() => null);
    if (response) {
      await response.body?.cancel();
      if (response.ok && child.exitCode === null && child.signalCode === null) {
        console.log(`PASS ${label} HTTP probe (${response.status})`);
        return;
      }
    }
    await delay(200);
  }
  throw new Error(`${label} did not return a successful HTTP response at ${url}`);
}

export function handleInterruption() {
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  return interruption.signal;
}

async function launch(services, dashboard, checkProxy, onReady) {
  const children = [];
  try {
    for (const service of services) {
      if (!(await lstat(service.file)).isFile()) {
        throw new Error(`${service.label} entry is not a file`);
      }
      await requireAvailablePort(service);
    }
    for (const service of services) await start(service, children);
    if (checkProxy) {
      const response = await fetch(new URL('/api/agent/status', dashboard.url), {
        redirect: 'error',
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok || (await response.json()).engineOnline !== true) {
        throw new Error('Dashboard proxy did not report the ARK Engine online');
      }
      console.log('PASS Dashboard proxy reports the ARK Engine online');
    }
    if (children.some(({ child }) => child.exitCode !== null || child.signalCode !== null)) {
      throw new Error('A service stopped before the end of the startup check');
    }
    interruption.signal.throwIfAborted();
    if (onReady) {
      await onReady();
      interruption.signal.throwIfAborted();
      const stopped = once(interruption.signal, 'abort');
      const exited = children.map(({ closed, label }) => closed.then(() => label));
      const result = await Promise.race([stopped, ...exited]);
      if (!interruption.signal.aborted) throw new Error(`${result} stopped unexpectedly`);
    }
  } finally {
    for (const { child } of children.reverse()) child.kill('SIGKILL');
    await Promise.all(children.map(({ closed }) => closed));
  }
}

function pairingEnvironment() {
  return { ...env, ICEPACK_BRIDGE_PAIRING_TOKEN: randomBytes(24).toString('hex') };
}

async function prepareSample(engineUrl) {
  const origin = engineUrl.origin;
  const post = async (endpoint, body) => {
    const response = await fetch(new URL(endpoint, origin), {
      method: 'POST',
      headers: { Origin: origin, 'x-ice-pack': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(3000),
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true) throw new Error(`Could not prepare sample preview: ${data.error ?? response.status}`);
    return data.customRules;
  };
  const loaded = await post('/custom-rules-reload', {});
  if (!loaded.loaded || loaded.ruleCount !== 1 || loaded.mode !== 'off') {
    throw new Error('Expected one sample rule with the engine off');
  }
  const preview = await post('/custom-rules-mode', { mode: 'preview' });
  if (preview.mode !== 'preview') throw new Error('Engine did not enter Preview mode');
}

export function launchInstalled(root) {
  const companion = join(root, 'companion');
  const dashboard = service(companion, 'node_modules/vite/bin/vite.js', 'http://127.0.0.1:5174/first-run.html', 'Dashboard',
    ['preview', '--host', '127.0.0.1', '--port', '5174', '--strictPort']);
  const bridge = service(companion, 'agent-bridge/bridge.mjs', 'http://127.0.0.1:3212/status', 'Local Bridge');
  const pairing = pairingEnvironment();
  bridge.environment = { ...pairing, ICEPACK_ALPHA_PREVIEW: '1' };
  const engine = service(join(root, 'engine'), 'server.mjs', 'http://127.0.0.1:3210/state', 'ARK Engine');
  engine.environment = { ...env, ICEPACK_KIT_DIR: join(root, 'preview-rules') };
  return launch([engine, bridge, dashboard], dashboard, true, async () => {
    await prepareSample(engine.url);
    console.log('PASS sample Heart Me rule loaded in Preview mode');
    console.log(`First-run Dashboard: ${dashboard.url.href}`);
    console.log(`Pairing token (private, this session only): ${pairing.ICEPACK_BRIDGE_PAIRING_TOKEN}`);
    console.log('Press Ctrl+C here to stop.');
  });
}

async function main() {
  handleInterruption();
  const names = ['northpath', 'engine', 'dashboard-entry', 'dashboard-url',
    'bridge-entry', 'bridge-url', 'engine-entry', 'engine-url'];
  const { values } = parseArgs({
    options: {
      ...Object.fromEntries(names.map(name => [name, { type: 'string' }])),
      'dashboard-arg': { type: 'string', multiple: true },
      'bridge-arg': { type: 'string', multiple: true },
      'engine-arg': { type: 'string', multiple: true },
      'check-companion-proxy': { type: 'boolean' },
    },
  });
  if (names.some(name => !values[name])) {
    throw new Error(`Required arguments: ${names.map(name => `--${name} <value>`).join(' ')}`);
  }

  const scratch = await mkdtemp(join(tmpdir(), 'icepack-clean-install-'));
  try {
    const northpath = join(scratch, 'northpath');
    const engine = join(scratch, 'engine');
    const dashboard = service(northpath, values['dashboard-entry'], values['dashboard-url'], 'Dashboard', values['dashboard-arg']);
    const bridge = service(northpath, values['bridge-entry'], values['bridge-url'], 'Local Bridge', values['bridge-arg']);
    bridge.environment = pairingEnvironment();
    const services = [
      service(engine, values['engine-entry'], values['engine-url'], 'ARK Engine', values['engine-arg']),
      bridge,
      dashboard,
    ];
    if (new Set(services.map(({ url }) => url.port)).size !== services.length) {
      throw new Error('Each service needs a distinct probe port');
    }
    await stage(resolve(values.northpath), northpath);
    await stage(resolve(values.engine), engine);

    installPackages(northpath, engine, scratch);
    await launch(services, dashboard, values['check-companion-proxy']);
  } finally {
    await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  }
  console.log('PASS isolated dependency installation, dashboard build, and service startup');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  });
}
