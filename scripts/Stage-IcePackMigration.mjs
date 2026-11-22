import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { readJsonWithBytes, rehearseEngineConfiguration } from './Test-IcePackEngineDraft.mjs';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const formatJson = value => JSON.stringify(value, null, 2) + '\n';

async function destinationPath(requested, currentFile) {
  const requestedPath = resolve(requested);
  const parent = await realpath(dirname(requestedPath));
  const destination = join(parent, basename(requestedPath));
  const kitFolder = dirname(await realpath(currentFile));
  const fromKitFolder = relative(kitFolder, destination);
  if (!fromKitFolder || (!isAbsolute(fromKitFolder) && fromKitFolder !== '..' && !fromKitFolder.startsWith(`..${sep}`))) {
    throw new Error('Choose a staging folder outside your current Kit Editor folder.');
  }
  return destination;
}

export async function writeMigrationPackage(destination, files, receipt) {
  await mkdir(destination);
  try {
    const hashes = {};
    for (const [name, value] of Object.entries(files)) {
      const data = formatJson(value);
      const output = join(destination, name);
      await writeFile(output, data, { flag: 'wx' });
      const expected = sha256(data);
      if (sha256(await readFile(output)) !== expected) throw new Error(`Staged file failed verification: ${name}`);
      hashes[name] = expected;
    }
    await writeFile(join(destination, 'migration-receipt.json'), formatJson({
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      ...receipt,
      files: hashes,
    }), { flag: 'wx' });
  } catch (error) {
    await rm(destination, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
    throw error;
  }
}

function printComparison(comparison) {
  for (const [kind, group] of [['Rules', comparison.rules], ['Kits', comparison.kits]]) {
    const count = status => group.changes.filter(change => change.status === status).length;
    console.log(`${kind}: ${count('added')} added, ${count('changed')} changed, ${count('removed')} removed, ${group.unchanged} unchanged.`);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      draft: { type: 'string' },
      current: { type: 'string' },
      catalog: { type: 'string' },
      'content-prefs': { type: 'string' },
      stage: { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log('Stage-IcePackMigration.mjs --draft <engine-draft.json> --current <streamer-config-v2.json> --catalog <ark-catalog-v2.json> [--content-prefs <content-prefs.json>] [--stage <new folder>]');
    return;
  }
  if (!values.draft || !values.current || !values.catalog) {
    throw new Error('Provide --draft, --current, and --catalog. Run --help for the expected files.');
  }

  const root = dirname(fileURLToPath(import.meta.url));
  const [draft, current, catalog] = await Promise.all([
    readJsonWithBytes(values.draft, 'Engine draft', 400_000),
    readJsonWithBytes(values.current, 'Current configuration', 400_000),
    readJsonWithBytes(values.catalog, 'Kit Editor catalog', 4_000_000),
  ]);
  const preferences = values['content-prefs']
    ? await readJsonWithBytes(values['content-prefs'], 'Content preferences', 400_000) : undefined;
  const [{ compareEngineDraft }, { validateArkCatalog, validateConfiguration }] = await Promise.all([
    import('./companion/agent-bridge/draft-preview.mjs'),
    import('./engine/icepack-config-engine.mjs'),
  ]);
  const comparison = compareEngineDraft({
    config: draft.value, current: current.value, catalog: catalog.value,
  });
  const validatedCatalog = validateArkCatalog(catalog.value);
  const config = validateConfiguration(draft.value, validatedCatalog);
  const report = await rehearseEngineConfiguration(root, {
    config, catalog: validatedCatalog, catalogSource: 'selected', preferences: preferences?.value,
  });
  printComparison(comparison);
  const blocked = report.results.filter(row => row.blocked !== undefined);
  for (const row of blocked) {
    console.log(`BLOCKED ${JSON.stringify(row.gift)}: ${JSON.stringify(row.blocked)}`);
  }
  console.log(`Rehearsal: ${report.results.length - blocked.length} prepared, ${blocked.length} blocked, ${report.ruleCount - report.results.length} disabled.`);
  if (blocked.length) {
    console.log('No package staged. Resolve blocked rules before staging.');
    process.exitCode = 2;
    return;
  }
  if (!values.stage) {
    console.log('Dry run complete. Add --stage with a new folder to save a migration package.');
    return;
  }

  const destination = await destinationPath(values.stage, values.current);
  const inputs = [
    ['Current configuration', values.current, current],
    ['Kit Editor catalog', values.catalog, catalog],
  ];
  if (preferences) inputs.push(['Content preferences', values['content-prefs'], preferences]);
  for (const [label, path, snapshot] of inputs) {
    if (!(await readFile(path)).equals(snapshot.bytes)) {
      throw new Error(`${label} changed during review. Run the preflight again.`);
    }
  }
  const files = { 'streamer-config-v2.json': config, 'ark-catalog-v2.json': validatedCatalog };
  if (preferences) files['content-prefs.json'] = { enabledPacks: preferences.value.enabledPacks };
  await writeMigrationPackage(destination, files, {
    baselineSha256: sha256(current.bytes),
    catalogSha256: sha256(catalog.bytes),
    contentPrefsSha256: preferences ? sha256(preferences.bytes) : null,
    comparison,
    rehearsal: report,
  });
  console.log(`PASS Staged migration package: ${destination}`);
  console.log('Review migration-receipt.json. Your live configuration was not changed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    const message = error.code === 'EEXIST'
      ? 'The staging folder already exists. Choose a different folder.'
      : error.message;
    console.error(`FAIL ${message.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')}`);
    process.exitCode = 1;
  });
}
