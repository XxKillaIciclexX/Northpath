import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appendAudit, newOperationId } from './audit.mjs';
import { resolveBackupPaths, snapshotBeforeApply } from './protected-apply.mjs';
import { atomicApply } from './sync.mjs';
import { getEngineTarget } from './target.mjs';
import { assertRewardLanesIdle, selectWebsiteRule } from './website-rule.mjs';

const reviewLifetime = 120_000;
const fingerprintKeys = ['rules', 'catalog', 'contentPrefs'];
const sameFiles = (actual, expected) => Boolean(actual && expected &&
  fingerprintKeys.every(key => Object.hasOwn(expected, key) && actual[key] === expected[key]));

export function createDesktopOperations({ kitDir, readWebsiteDraft, readEngineState, reloadEngine, enginePost }) {
  let review;

  async function localRules() {
    if (!kitDir) throw Error('Configure the local Kit Editor directory in Companion first.');
    const paths = resolveBackupPaths(kitDir);
    const planner = await import(pathToFileURL(join(paths.engineDir, 'icepack-custom-rules.mjs')).href);
    const saved = planner.loadSavedRules(kitDir);
    if (!saved.fingerprints) throw Error('Update the regular ARK Engine to a version that reports loaded rule fingerprints.');
    return { paths, planner, saved };
  }

  function verifyLoaded(state, fingerprints) {
    if (state?.loaded !== true || !sameFiles(state.loadedFingerprints, fingerprints)) {
      throw Error('The engine did not load the expected Kit Editor files. Check the engine and Kit Editor paths.');
    }
  }

  return async function run(action, input) {
    if (action === 'stop-live') {
      const result = await enginePost('/custom-rules-mode', { mode: 'off' });
      if (result.customRules?.mode !== 'off') throw Error('The engine did not confirm that Custom Gift Rules stopped.');
      return { mode: 'off' };
    }

    if (action === 'review-rule') {
      review = undefined;
      const { draft, revision } = await readWebsiteDraft();
      const { planner, saved } = await localRules();
      const { config, rule, previous } = selectWebsiteRule(draft, input?.gift, saved.config, saved.catalog);
      planner.buildPlanCommands({ actions: [rule.reward] }, saved.catalog, saved.enabledPacks, '1');
      let applyBlock = null;
      try { assertRewardLanesIdle(await readEngineState()); }
      catch (error) { applyBlock = error.message; }
      const reviewId = randomBytes(16).toString('hex');
      review = { reviewId, revision, before: saved.fingerprints, config, expiresAt: Date.now() + reviewLifetime };
      return { reviewId, rule, previous: previous ?? null, applyBlock };
    }

    if (action === 'apply-rule') {
      const approved = review;
      review = undefined;
      if (!approved || approved.reviewId !== input?.reviewId || approved.expiresAt <= Date.now()) {
        throw Error('Review the website rule again before applying it.');
      }
      if ((await readWebsiteDraft()).revision !== approved.revision) throw Error('The saved website draft changed. Review it again.');
      assertRewardLanesIdle(await readEngineState());
      const { paths, saved } = await localRules();
      if (!sameFiles(saved.fingerprints, approved.before)) throw Error('The local Kit Editor files changed. Review the rule again.');
      const snapshot = snapshotBeforeApply(paths);
      const operationId = newOperationId();
      appendAudit(paths.root, { type: 'config-apply', status: 'started', operationId, snapshot: snapshot.snapshot });
      try {
        const rules = createHash('sha256').update(JSON.stringify(approved.config, null, 2) + '\n').digest('hex');
        await atomicApply(kitDir, approved.config, reloadEngine, result => {
          verifyLoaded(result.customRules, { ...approved.before, rules });
        });
      } catch (error) {
        try { appendAudit(paths.root, { type: 'config-apply', status: 'failed', operationId, snapshot: snapshot.snapshot }); } catch {}
        throw error;
      }
      try { appendAudit(paths.root, { type: 'config-apply', status: 'succeeded', operationId, snapshot: snapshot.snapshot }); }
      catch (error) { console.error('Website rule applied but audit write failed:', error.message); }
      return { recoverySnapshot: snapshot.snapshot };
    }

    if (action === 'enable-live') {
      if (input?.confirmation !== 'ENABLE LIVE CUSTOM RULES') throw Error('Confirm before enabling Live Custom Rules.');
      const state = await readEngineState();
      if (state.customRules?.mode === 'live') return { mode: 'live' };
      assertRewardLanesIdle(state);
      const target = getEngineTarget(state);
      if (!target.configured || !target.laneConfigured) throw Error('Set your Survivor ID in Operations Center first.');
      const { saved } = await localRules();
      const loaded = state.customRules.loaded ? state.customRules : (await reloadEngine()).customRules;
      verifyLoaded(loaded, saved.fingerprints);
      if (!(loaded.preparation?.prepared > 0)) throw Error('The engine has no enabled Gift Rules ready for delivery.');
      assertRewardLanesIdle(await readEngineState());
      const result = await enginePost('/custom-rules-mode', { mode: 'live', confirmation: input.confirmation });
      if (result.customRules?.mode !== 'live') throw Error('The engine did not confirm Live Custom Rules.');
      return { mode: 'live' };
    }
    throw Error('Unknown Operations Center action.');
  };
}
