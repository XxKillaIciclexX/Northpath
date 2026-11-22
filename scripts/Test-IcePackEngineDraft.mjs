import { readFile, lstat, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

export async function readJsonWithBytes(filename, label, maxBytes) {
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.size > maxBytes) {
    throw new Error(`${label} must be a regular JSON file of at most ${maxBytes} bytes.`);
  }
  try {
    const bytes = await readFile(filename);
    return { bytes, value: JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, '')) };
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${label} is not valid JSON.`);
    throw error;
  }
}

async function readJson(filename, label, maxBytes) {
  return (await readJsonWithBytes(filename, label, maxBytes)).value;
}

function requireEngineDraft(config) {
  if (config?.schemaVersion !== 2) throw new Error('Choose a version 2 engine draft from Download engine draft.');
}

export async function rehearseEngineDraft(root, { draft, catalog, prefs }) {
  const input = await readJson(draft, 'Engine draft', 400_000);
  requireEngineDraft(input);
  const bundled = join(root, 'companion', 'src', 'catalog.json');
  const sourceCatalog = await readJson(catalog ?? bundled, 'ARK catalog', 4_000_000);
  const preferences = prefs ? await readJson(prefs, 'Content preferences', 400_000) : undefined;
  return rehearseEngineConfiguration(root, {
    config: input, catalog: sourceCatalog, catalogSource: catalog ? 'selected' : 'bundled', preferences,
  });
}

export async function rehearseEngineConfiguration(root, { config, catalog, catalogSource, preferences }, engineDirectory = join(root, 'engine')) {
  requireEngineDraft(config);
  if (catalogSource === 'selected' && catalog?.schemaVersion !== 2) {
    throw new Error('Choose a version 2 Kit Editor catalog.');
  }
  if (preferences !== undefined && (!Array.isArray(preferences?.enabledPacks) || preferences.enabledPacks.some(pack => typeof pack !== 'string'))) {
    throw new Error('Content preferences must contain an enabledPacks array of pack IDs.');
  }
  const engineModule = name => import(pathToFileURL(join(engineDirectory, name)).href);
  const [{ loadSavedRules, buildPlanCommands }, { planGift }] = await Promise.all([
    engineModule('icepack-custom-rules.mjs'),
    engineModule('icepack-config-engine.mjs'),
  ]);

  const scratch = await mkdtemp(join(tmpdir(), 'icepack-rehearsal-'));
  try {
    await writeFile(join(scratch, 'streamer-config-v2.json'), JSON.stringify(config), { flag: 'wx' });
    await writeFile(join(scratch, 'ark-catalog-v2.json'), JSON.stringify(catalog), { flag: 'wx' });
    if (preferences) {
      await writeFile(join(scratch, 'content-prefs.json'), JSON.stringify(preferences), { flag: 'wx' });
    }

    const saved = loadSavedRules(scratch);
    const { rules, kits } = saved.config;
    const results = [];
    for (const rule of rules.filter(entry => entry.enabled)) {
      const gift = { id: rule.giftId, name: rule.giftName };
      try {
        const plan = planGift(saved.config, saved.catalog, gift);
        if (!plan.matched || plan.ruleId !== rule.id) throw new Error('The engine matched a different rule.');
        // The planner needs a numeric target. This placeholder is never sent to an engine or game server.
        const commands = buildPlanCommands(plan, saved.catalog, saved.enabledPacks, '1');
        results.push({ ruleId: rule.id, gift: rule.giftName ?? rule.giftId, prepared: commands.length });
      } catch (error) {
        results.push({ ruleId: rule.id, gift: rule.giftName ?? rule.giftId, blocked: error.message });
      }
    }
    return {
      ruleCount: rules.length,
      kitCount: kits.length,
      catalogSource,
      packSource: preferences ? 'selected content preferences' : 'catalog defaults',
      results,
    };
  } finally {
    await rm(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  }
}

const printable = value => value.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');

async function main() {
  const { values } = parseArgs({
    options: {
      draft: { type: 'string' },
      catalog: { type: 'string' },
      'content-prefs': { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log('Test-IcePackEngineDraft.mjs --draft <engine-draft.json> [--catalog <ark-catalog-v2.json>] [--content-prefs <content-prefs.json>]');
    return;
  }
  if (!values.draft) throw new Error('Provide --draft <icepack-engine-draft-v2.json>.');
  const root = dirname(fileURLToPath(import.meta.url));
  const report = await rehearseEngineDraft(root, { ...values, prefs: values['content-prefs'] });
  const blocked = report.results.filter(row => row.blocked !== undefined).length;
  console.log(`PASS Engine loaded ${report.ruleCount} rules and ${report.kitCount} Kits from temporary files.`);
  console.log(`Catalog: ${report.catalogSource}. Content packs: ${report.packSource}.`);
  for (const row of report.results) {
    console.log(row.blocked !== undefined ? `BLOCKED ${printable(row.gift)}: ${printable(row.blocked)}` :
      `PREPARED ${printable(row.gift)}: ${row.prepared} command(s)`);
  }
  console.log(`Rehearsal: ${report.results.length - blocked} prepared, ${blocked} blocked, ${report.ruleCount - report.results.length} disabled.`);
  console.log('Temporary files removed. No services started or game commands sent.');
  if (blocked) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`FAIL ${printable(error.message)}`);
    process.exitCode = 1;
  });
}
