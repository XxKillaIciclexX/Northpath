import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
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

async function verifySpare(spare, migration, restore) {
  const { receipt, staged } = migration;
  const context = await readContext(spare, receipt);
  const current = await read(spare, rulesName);
  const currentHash = sha256(current.bytes);
  const expected = restore ? receipt.files[rulesName] : receipt.baselineSha256;
  const desired = restore ? receipt.baselineSha256 : receipt.files[rulesName];
  if (currentHash !== expected && currentHash !== desired) {
    throw new Error('Spare rules changed outside the migration. Create a fresh spare copy before proceeding.');
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

async function changeSpare(spare, migration, restore, apply, engineRoot) {
  await requireSpare(spare, migration);
  const lock = join(spare, '.icepack-migration.lock');
  if (apply) await mkdir(lock);
  try {
    const { current, currentHash, desired, context, candidate } = await verifySpare(spare, migration, restore);
    if (currentHash === desired) {
      console.log(restore ? 'PASS Spare rules already match the original bytes.' : 'PASS Spare rules already match the staged draft.');
      return;
    }
    const backupPath = join(spare, backupName);
    let replacement = candidate.bytes;
    if (restore) {
      replacement = (await read(spare, backupName)).bytes;
      if (sha256(replacement) !== desired) throw new Error('Backup hash differs from the original rules. Restore stopped.');
    } else {
      const report = await rehearseEngineConfiguration(engineRoot, {
        config: candidate.value, catalog: context.catalog.value, catalogSource: 'selected', preferences: context.prefs?.value,
      });
      const blocked = report.results.find(row => row.blocked !== undefined);
      if (blocked) throw new Error(`Bundled engine blocked ${blocked.gift}: ${blocked.blocked}`);
    }

    console.log(`Verified package and spare baseline: ${spare}`);
    if (!apply) {
      console.log(`Dry run complete. Use ${restore ? '--restore --apply' : '--apply'} to change only the spare rules file.`);
      return;
    }
    if (!restore) {
      try {
        await writeFile(backupPath, current.bytes, { flag: 'wx' });
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      if (sha256((await read(spare, backupName)).bytes) !== migration.receipt.baselineSha256) {
        throw new Error('Backup hash does not match the reviewed baseline. Apply stopped.');
      }
      console.log(`Backup: ${backupPath}`);
    }

    const target = join(spare, rulesName);
    await readContext(spare, migration.receipt);
    if (!(await readFile(target)).equals(current.bytes)) throw new Error('Spare rules changed during verification.');
    let replaced = false;
    try {
      await replaceFile(target, replacement);
      replaced = true;
      if (sha256(await readFile(target)) !== desired) throw new Error('Spare rules failed byte verification.');
      if (!restore) {
        const { loadSavedRules } = await import('./engine/icepack-custom-rules.mjs');
        const { config } = loadSavedRules(spare);
        console.log(`PASS Bundled engine loaded ${config.rules.length} rules and ${config.kits.length} Kits from the spare folder.`);
      }
    } catch (error) {
      if (replaced) {
        try {
          await replaceFile(target, current.bytes);
          if (!(await readFile(target)).equals(current.bytes)) throw new Error('Previous bytes do not match.');
        } catch (rollbackError) {
          throw new Error(`${error.message} Automatic rollback failed: ${rollbackError.message}. Backup: ${backupPath}`);
        }
        throw new Error(`${error.message} Previous spare rules restored.`);
      }
      throw error;
    }
    console.log(restore ? 'PASS Original spare rules restored byte for byte.' : 'PASS Applied and verified spare rules.');
  } finally {
    if (apply) await rm(lock, { recursive: true, force: true });
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      package: { type: 'string' }, spare: { type: 'string' }, 'create-from': { type: 'string' },
      apply: { type: 'boolean' }, restore: { type: 'boolean' }, help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log('Apply-IcePackMigration.mjs --package <staged folder> --spare <spare folder> [--create-from <Kit Editor folder> | [--restore] [--apply]]');
    return;
  }
  if (!values.package || !values.spare) throw new Error('Provide --package and --spare. Run --help for details.');
  if (values['create-from'] && (values.apply || values.restore)) throw new Error('Create the spare in a separate command.');
  const packageRoot = await realpath(values.package);
  const migration = await readMigrationPackage(packageRoot);
  if (values['create-from']) {
    await createSpare(values['create-from'], values.spare, packageRoot, migration);
    return;
  }
  const spare = await realpath(values.spare);
  if (isInside(packageRoot, spare)) throw new Error('Select a separate spare folder.');
  const engineRoot = dirname(fileURLToPath(import.meta.url));
  await changeSpare(spare, migration, values.restore, values.apply, engineRoot);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`FAIL ${error.message.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')}`);
    process.exitCode = 1;
  });
}
