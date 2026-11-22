import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs, parseEnv } from 'node:util';
import { readJsonWithBytes, rehearseEngineConfiguration } from './Test-IcePackEngineDraft.mjs';

const rulesName = 'streamer-config-v2.json';
const catalogName = 'ark-catalog-v2.json';
const prefsName = 'content-prefs.json';
const markerName = '.icepack-migration-spare.json';
const backupName = '.icepack-migration-backup.json';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const read = (root, name) => readJsonWithBytes(join(root, name), name, name === catalogName ? 4_000_000 : 400_000);

export async function readMigrationPackage(root) {
  const { bytes, value: receipt } = await read(root, 'migration-receipt.json');
  if (receipt?.schemaVersion !== 1 || !validHash(receipt.baselineSha256) ||
      !validHash(receipt.catalogSha256) ||
      (receipt.contentPrefsSha256 !== null && !validHash(receipt.contentPrefsSha256))) {
    throw new Error('Invalid version 1 migration receipt.');
  }
  const names = [rulesName, catalogName];
  if (receipt.contentPrefsSha256 !== null) names.push(prefsName);
  const files = receipt.files;
  if (!files || Object.keys(files).length !== names.length || names.some(name => !validHash(files[name]))) {
    throw new Error('The migration receipt does not list the expected staged files.');
  }
  const staged = {};
  for (const name of names) {
    const file = await read(root, name);
    if (sha256(file.bytes) !== files[name]) throw new Error(`Staged hash mismatch: ${name}`);
    staged[name] = file;
  }
  return { receipt, receiptHash: sha256(bytes), staged };
}

async function readContext(kit, receipt) {
  const catalog = await read(kit, catalogName);
  if (sha256(catalog.bytes) !== receipt.catalogSha256) {
    throw new Error('Kit Editor catalog changed since staging. Review and stage a new package.');
  }
  let prefs;
  try {
    prefs = await read(kit, prefsName);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if ((prefs ? sha256(prefs.bytes) : null) !== receipt.contentPrefsSha256) {
    throw new Error('Kit Editor content preferences changed or were omitted during staging.');
  }
  return { catalog, prefs };
}

function isInside(parent, path) {
  const remainder = relative(parent, path);
  return !remainder || (!isAbsolute(remainder) && remainder !== '..' && !remainder.startsWith(`..${sep}`));
}

async function createSpare(sourceKit, destination, packageRoot, migration) {
  const source = await realpath(sourceKit);
  const output = join(await realpath(dirname(resolve(destination))), basename(resolve(destination)));
  if (isInside(source, output) || isInside(packageRoot, output)) {
    throw new Error('Choose a new spare folder outside Kit Editor and the staged package.');
  }
  const { receipt, receiptHash } = migration;
  const base = await read(source, rulesName);
  if (sha256(base.bytes) !== receipt.baselineSha256) {
    throw new Error('Current rules changed since staging. Review and stage a new package.');
  }
  const { catalog, prefs } = await readContext(source, receipt);
  await mkdir(output);
  try {
    await writeFile(join(output, rulesName), base.bytes, { flag: 'wx' });
    await writeFile(join(output, catalogName), catalog.bytes, { flag: 'wx' });
    if (prefs) await writeFile(join(output, prefsName), prefs.bytes, { flag: 'wx' });
    await writeFile(join(output, markerName), JSON.stringify({
      schemaVersion: 1, path: await realpath(output), receiptHash,
    }), { flag: 'wx' });
  } catch (error) {
    await rm(output, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
    throw error;
  }
  console.log(`PASS Created spare Kit Editor: ${output}`);
}

async function requireSpare(spare, migration) {
  let marker;
  try {
    marker = (await read(spare, markerName)).value;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    throw new Error('Create a spare copy with --create-from before applying or restoring.');
  }
  if (marker?.schemaVersion !== 1 || marker.path !== spare || marker.receiptHash !== migration.receiptHash) {
    throw new Error('This spare folder belongs to a different path or migration package.');
  }
}

async function verifyKit(kit, migration, restore, regular) {
  const { receipt, staged } = migration;
  const context = await readContext(kit, receipt);
  const current = await read(kit, rulesName);
  const currentHash = sha256(current.bytes);
  const expected = restore ? receipt.files[rulesName] : receipt.baselineSha256;
  const desired = restore ? receipt.baselineSha256 : receipt.files[rulesName];
  if (currentHash !== expected && currentHash !== desired) {
    throw new Error(regular
      ? 'Regular rules changed outside this migration. Review the current file and stage a new package.'
      : 'Spare rules changed outside the migration. Create a fresh spare copy before proceeding.');
  }
  return { current, currentHash, desired, context, candidate: staged[rulesName] };
}

async function replaceFile(path, bytes) {
  const temp = join(dirname(path), `.icepack-migration-${randomUUID()}.tmp`);
  try {
    await writeFile(temp, bytes, { flag: 'wx' });
    await rename(temp, path);
  } finally {
    await rm(temp, { force: true });
  }
}

async function changeKit(kit, migration, { restore, apply, engineRoot, engineDirectory, regular = false }) {
  const targetName = regular ? 'regular' : 'spare';
  const engineName = regular ? 'Control Center engine' : 'Bundled engine';
  const backupFile = regular ? `.icepack-migration-backup-${migration.receiptHash}.json` : backupName;
  const lock = join(kit, '.icepack-migration.lock');
  if (apply) await mkdir(lock);
  try {
    const { current, currentHash, desired, context, candidate } = await verifyKit(kit, migration, restore, regular);
    if (currentHash === desired) {
      console.log(`PASS Rules already match the ${restore ? 'original bytes' : 'staged draft'}.`);
      return;
    }
    const backupPath = join(kit, backupFile);
    let replacement = candidate.bytes;
    if (restore) {
      replacement = (await read(kit, backupFile)).bytes;
      if (sha256(replacement) !== desired) throw new Error('Backup hash differs from the original rules. Restore stopped.');
    } else {
      const report = await rehearseEngineConfiguration(engineRoot, {
        config: candidate.value, catalog: context.catalog.value, catalogSource: 'selected', preferences: context.prefs?.value,
      }, engineDirectory);
      const blocked = report.results.find(row => row.blocked !== undefined);
      if (blocked) throw new Error(`${engineName} blocked ${blocked.gift}: ${blocked.blocked}`);
    }

    console.log(`Verified package and ${targetName} baseline: ${kit}`);
    if (!apply) {
      console.log(`Dry run complete. Use ${restore ? '--restore --apply' : '--apply'} to change only the ${targetName} rules file.`);
      return;
    }
    if (!restore) {
      try {
        await writeFile(backupPath, current.bytes, { flag: 'wx' });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      if (sha256((await read(kit, backupFile)).bytes) !== migration.receipt.baselineSha256) {
        throw new Error('Backup hash does not match the reviewed baseline. Apply stopped.');
      }
      console.log(`Backup: ${backupPath}`);
    }

    const target = join(kit, rulesName);
    await readContext(kit, migration.receipt);
    if (!(await readFile(target)).equals(current.bytes)) throw new Error('Rules changed during verification.');
    let replaced = false;
    try {
      await replaceFile(target, replacement);
      replaced = true;
      if (sha256(await readFile(target)) !== desired) throw new Error('Rules failed byte verification.');
      if (!restore) {
        const { loadSavedRules } = await import(pathToFileURL(join(engineDirectory, 'icepack-custom-rules.mjs')).href);
        const { config } = loadSavedRules(kit);
        console.log(`PASS ${engineName} loaded ${config.rules.length} rules and ${config.kits.length} Kits from the ${targetName} folder.`);
      }
    } catch (error) {
      if (replaced) {
        try {
          await replaceFile(target, current.bytes);
          if (!(await readFile(target)).equals(current.bytes)) throw new Error('Previous bytes do not match.');
        } catch (rollbackError) {
          throw new Error(`${error.message} Automatic rollback failed: ${rollbackError.message}. Backup: ${backupPath}`);
        }
        throw new Error(`${error.message} Previous ${targetName} rules restored.`);
      }
      throw error;
    }
    console.log(restore ? `PASS Original ${targetName} rules restored byte for byte.` : `PASS Applied and verified ${targetName} rules.`);
  } finally {
    if (apply) await rm(lock, { recursive: true, force: true });
  }
}

async function regularPaths() {
  const appData = process.env.LOCALAPPDATA;
  if (!appData) throw new Error('Run regular migration from the Windows user session that runs Control Center.');
  let settings = {};
  try {
    settings = (await read(join(appData, 'IcePackCompanion'), 'settings.json')).value;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const configured = value => typeof value === 'string' && value.trim();
  const engine = await realpath(configured(settings?.enginePath) || 'C:\\IcePackARK\\ice-pack-ark');
  const defaultKit = join(engine, 'icepack-catalog-manager');
  const kit = await realpath(configured(settings?.kitDir) || defaultKit);
  // Read only the path setting used by the engine launcher. Do not log or export .env values.
  let envFile = {};
  try {
    envFile = parseEnv(await readFile(join(engine, '.env'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const engineKit = configured(process.env.ICEPACK_KIT_DIR ?? envFile.ICEPACK_KIT_DIR);
  const actualKit = await realpath(engineKit ? resolve(engine, engineKit) : defaultKit);
  if (kit !== actualKit) {
    throw new Error('Control Center and ARK Engine point to different Kit Editor folders. Align their paths before applying.');
  }
  return { kit, engine };
}

async function withRegularPortsReserved(action) {
  const kitPort = Number(process.env.KIT_EDITOR_PORT || 3211);
  if (!Number.isInteger(kitPort) || kitPort < 1024 || kitPort > 65535) {
    throw new Error('Invalid KIT_EDITOR_PORT.');
  }
  const reserved = [];
  try {
    for (const port of new Set([3210, 3211, 3212, 5173, kitPort])) {
      const server = createServer(socket => socket.destroy());
      server.listen({ host: '127.0.0.1', port, exclusive: true });
      try {
        await once(server, 'listening');
      } catch (error) {
        if (error.code === 'EADDRINUSE') {
          throw new Error(`Port ${port} is busy. Stop Companion and close Kit Editor before applying or restoring.`);
        }
        throw error;
      }
      reserved.push(server);
    }
    await action();
  } finally {
    await Promise.all(reserved.map(server => new Promise(done => server.close(done))));
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      package: { type: 'string' }, spare: { type: 'string' }, regular: { type: 'boolean' }, 'create-from': { type: 'string' },
      apply: { type: 'boolean' }, restore: { type: 'boolean' }, help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log('Apply-IcePackMigration.mjs --package <staged folder> --spare <spare folder> [--create-from <Kit Editor folder> | [--restore] [--apply]]');
    console.log('Apply-IcePackMigration.mjs --package <staged folder> --regular [--restore] [--apply]');
    return;
  }
  if (!values.package || Boolean(values.regular) === Boolean(values.spare)) {
    throw new Error('Provide --package and either --spare or --regular. Run --help for details.');
  }
  if (values['create-from'] && (values.regular || values.apply || values.restore)) {
    throw new Error('Create the spare in a separate command.');
  }
  const packageRoot = await realpath(values.package);
  const migration = await readMigrationPackage(packageRoot);
  if (values['create-from']) {
    await createSpare(values['create-from'], values.spare, packageRoot, migration);
    return;
  }
  const engineRoot = dirname(fileURLToPath(import.meta.url));
  if (values.regular) {
    const { kit, engine } = await regularPaths();
    if (isInside(packageRoot, kit) || isInside(kit, packageRoot)) {
      throw new Error('The staged package must be outside the regular Kit Editor folder.');
    }
    console.log(`Target Kit Editor: ${kit}`);
    console.log(`Control Center engine: ${engine}`);
    const run = () => changeKit(kit, migration, { ...values, engineRoot, engineDirectory: engine });
    if (values.apply) await withRegularPortsReserved(run);
    else await run();
    return;
  }
  const spare = await realpath(values.spare);
  if (isInside(packageRoot, spare)) throw new Error('Select a separate spare folder.');
  await requireSpare(spare, migration);
  await changeKit(spare, migration, { ...values, engineRoot, engineDirectory: join(engineRoot, 'engine') });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`FAIL ${error.message.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')}`);
    process.exitCode = 1;
  });
}
