import { realpath } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { readMigrationPackage } from './Apply-IcePackMigration.mjs';

export function compareLoadedMigration(customRules, receipt, baseline = false) {
  if (!customRules || !Object.hasOwn(customRules, 'loadedFingerprints')) {
    return { status: 'unsupported' };
  }
  if (customRules.loaded !== true || !customRules.loadedFingerprints) return { status: 'not-loaded' };

  const expected = {
    rules: baseline ? receipt.baselineSha256 : receipt.files['streamer-config-v2.json'],
    catalog: receipt.catalogSha256,
    contentPrefs: receipt.contentPrefsSha256,
  };
  const checks = Object.entries(expected).map(([file, hash]) => ({
    file, matches: customRules.loadedFingerprints[file] === hash,
  }));
  return { status: checks.every(check => check.matches) ? 'match' : 'mismatch', checks };
}

async function main() {
  const { values } = parseArgs({ options: {
    package: { type: 'string' },
    baseline: { type: 'boolean' },
    help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Verify-IcePackMigration.mjs --package <staged folder> [--baseline]');
    return;
  }
  if (!values.package) throw new Error('Provide --package with the v5.1 staging folder.');
  const { receipt } = await readMigrationPackage(await realpath(values.package));

  let state;
  try {
    const response = await fetch('http://127.0.0.1:3210/state', {
      redirect: 'error',
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state = await response.json();
  } catch (error) {
    throw new Error(`Could not read the local ARK Engine on port 3210: ${error.message}`);
  }

  const customRules = state?.customRules;
  const result = compareLoadedMigration(customRules, receipt, values.baseline);
  if (result.status === 'unsupported') {
    throw new Error('The running engine does not report loaded fingerprints. Update the engine for v5.4 and restart it.');
  }
  if (result.status === 'not-loaded') {
    throw new Error('The running engine has no loaded fingerprints. Use Reload saved Kits & rules, then retry.');
  }

  const expectation = values.baseline ? 'original baseline' : 'staged migration';
  console.log(`Expecting: ${expectation}`);
  if (['off', 'preview', 'live'].includes(customRules.mode)) console.log(`Custom Rules mode: ${customRules.mode}`);
  const labels = { rules: 'rules', catalog: 'catalog', contentPrefs: 'content preferences' };
  for (const check of result.checks) console.log(`${check.matches ? 'MATCH' : 'MISMATCH'} Loaded ${labels[check.file]}`);
  if (result.status === 'match') {
    console.log(`PASS Running engine loaded the exact ${expectation} inputs.`);
  } else {
    console.log('FAIL Loaded inputs differ from the receipt. Verify the configured folder and reload before enabling Live.');
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`FAIL ${error.message.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')}`);
    process.exitCode = 1;
  });
}
