import { realpath } from 'node:fs/promises';
import { basename } from 'node:path';
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

export function assessReadiness(state, migration) {
  const { customRules, giftRcon } = state;
  if (!Object.hasOwn(customRules, 'preparation')) {
    throw new Error('The running engine does not report rule preparation. Apply the v5.5 engine update and restart.');
  }
  const { preparation } = customRules;
  if (customRules.loaded && (!preparation ||
      ![preparation.prepared, preparation.blocked, preparation.disabled].every(count => Number.isSafeInteger(count) && count >= 0) ||
      preparation.prepared + preparation.blocked + preparation.disabled !== customRules.ruleCount ||
      !Array.isArray(preparation.blockedExamples))) {
    throw new Error('The running engine returned incomplete rule preparation results.');
  }
  const safety = [
    { label: 'Custom Gift Rules in Preview', pass: customRules.mode === 'preview' },
    { label: 'Specimen Implant ID configured', pass: customRules.playerIdConfigured === true },
    { label: 'Custom Gift Rules idle', pass: customRules.queued === 0 && customRules.inflight === false },
    {
      label: 'Legacy lanes disarmed and idle',
      pass: state.armed === false && state.autoEnabled === false &&
        state.pending === 0 && state.active === null && state.rewardPending === 0,
    },
    {
      label: 'Experimental Dodo lane off and idle',
      pass: giftRcon?.mode === 'off' && giftRcon.queued === 0 && giftRcon.inflight === false,
    },
  ];
  const ready = migration.status === 'match' && preparation?.prepared > 0 &&
    preparation.blocked === 0 && safety.every(check => check.pass);
  return { ready, safety, preparation };
}

const printable = value => value.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ');

function printReadiness(state, migration) {
  const { ready, safety, preparation } = assessReadiness(state, migration);
  if (preparation) {
    console.log(`Preparation: ${preparation.prepared} prepared, ${preparation.blocked} blocked, ${preparation.disabled} disabled.`);
    if (preparation.prepared + preparation.blocked === 0) console.log('BLOCKED No enabled Gift Rules.');
    for (const { ruleId, gift, reason } of preparation.blockedExamples) {
      console.log(`BLOCKED ${printable(gift)} (${printable(ruleId)}): ${printable(reason)}`);
    }
    if (preparation.blocked > preparation.blockedExamples.length) {
      console.log(`Additional blocked rules: ${preparation.blocked - preparation.blockedExamples.length}.`);
    }
  } else {
    console.log('BLOCKED Use Reload saved Kits & rules to get preparation results.');
  }
  for (const { label, pass } of safety) console.log(`${pass ? 'PASS' : 'BLOCKED'} ${label}`);
  console.log(ready ? 'READY Pre-Live checks passed.' : 'NOT READY Resolve the checks above and rerun.');
  if (!ready) process.exitCode = 2;
}

async function main() {
  const { values } = parseArgs({ options: {
    package: { type: 'string' },
    baseline: { type: 'boolean' },
    readiness: { type: 'boolean' },
    help: { type: 'boolean' },
  } });
  if (values.help) {
    console.log('Verify-IcePackMigration.mjs --package <staged folder> [--baseline] [--readiness]');
    return;
  }
  if (!values.package) throw new Error('Provide --package with the v5.1 staging folder.');
  const receiptHint = 'Provide --package with the original staging folder containing migration-receipt.json.';
  if (/^\s*backup:/i.test(values.package)) throw new Error(receiptHint);
  const packageRoot = await realpath(values.package);
  const { receipt } = await readMigrationPackage(packageRoot).catch(error => {
    if (error.code === 'ENOENT' && basename(error.path ?? '') === 'migration-receipt.json') {
      throw new Error(receiptHint);
    }
    throw error;
  });

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
  if (result.status === 'not-loaded' && !values.readiness) {
    throw new Error('The running engine has no loaded fingerprints. Use Reload saved Kits & rules, then retry.');
  }

  const expectation = values.baseline ? 'original baseline' : 'staged migration';
  console.log(`Expecting: ${expectation}`);
  if (['off', 'preview', 'live'].includes(customRules.mode)) console.log(`Custom Rules mode: ${customRules.mode}`);
  const labels = { rules: 'rules', catalog: 'catalog', contentPrefs: 'content preferences' };
  for (const check of result.checks ?? []) console.log(`${check.matches ? 'MATCH' : 'MISMATCH'} Loaded ${labels[check.file]}`);
  if (values.readiness) {
    printReadiness(state, result);
  } else if (result.status === 'match') {
    console.log(`PASS Running engine loaded the exact ${expectation} inputs.`);
  } else {
    console.log('FAIL Loaded inputs differ from the receipt. Verify the configured folder and reload before enabling Live.');
    process.exitCode = 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`FAIL ${printable(error.message)}`);
    process.exitCode = 1;
  });
}
