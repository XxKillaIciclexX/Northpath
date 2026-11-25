import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appendAudit, newOperationId } from './audit.mjs';
import { resolveBackupPaths, snapshotBeforeApply } from './protected-apply.mjs';
import { atomicApply } from './sync.mjs';
import { getEngineTarget } from './target.mjs';
import { assertRewardLanesIdle, selectWebsiteRule } from './website-rule.mjs';
import { configFileHash, createAccountSync, sameRuleFiles } from './account-sync.mjs';

const reviewLifetime = 120_000;

export function createDesktopOperations({ kitDir, readWebsiteDraft, readEngineState, reloadEngine, enginePost, accountSyncDir, connectWebsite }) {
  let review;
  let hostedTest;
  let liveSession;
  let refreshingLive = false;

  async function localRules() {
    if (!kitDir) throw Error('Configure the local Kit Editor directory in Companion first.');
    const paths = resolveBackupPaths(kitDir);
    const planner = await import(pathToFileURL(join(paths.engineCodeDir, 'icepack-custom-rules.mjs')).href);
    const saved = planner.loadSavedRules(kitDir);
    if (!saved.fingerprints) throw Error('Update the regular ARK Engine to a version that reports loaded rule fingerprints.');
    return { paths, planner, saved };
  }

  function verifyLoaded(state, fingerprints) {
    if (state?.loaded !== true || !sameRuleFiles(state.loadedFingerprints, fingerprints)) {
      throw Error('The engine did not load the expected Kit Editor files. Check the engine and Kit Editor paths.');
    }
  }

  async function applyProtected(paths, before, config) {
    const snapshot = snapshotBeforeApply(paths);
    const operationId = newOperationId();
    appendAudit(paths.root, { type: 'config-apply', status: 'started', operationId, snapshot: snapshot.snapshot });
    try {
      await atomicApply(kitDir, config, reloadEngine, result => {
        verifyLoaded(result.customRules, { ...before, rules: configFileHash(config) });
      });
    } catch (error) {
      try { appendAudit(paths.root, { type: 'config-apply', status: 'failed', operationId, snapshot: snapshot.snapshot }); } catch {}
      throw error;
    }
    try { appendAudit(paths.root, { type: 'config-apply', status: 'succeeded', operationId, snapshot: snapshot.snapshot }); }
    catch (error) { console.error('Website rules applied but audit write failed:', error.message); }
    return { recoverySnapshot: snapshot.snapshot };
  }

  const accountSync = createAccountSync({ directory: accountSyncDir, kitDir, readEngineState, localRules, applyProtected, reloadEngine, verifyLoaded });

  async function run(action, input) {
    if (action === 'hosted-test-target') return (await connectWebsite()).hostedTestTarget();
    if (action === 'start-hosted-live') {
      if (input?.confirmation !== 'START HOSTED REWARDS') throw Error('Confirm before starting hosted Live Rewards.');
      const state = await readEngineState();
      if (!state.hostedLive) throw Error('Update the TikFinity engine first.');
      if (state.giftSource !== 'tikfinity') throw Error('Select direct TikFinity and restart Companion first.');
      assertRewardLanesIdle(state);
      const connection = await connectWebsite();
      const target = await connection.hostedTestTarget();
      if (!target.hostedGiftIds?.length || target.serverId !== input.serverId || target.survivorId !== input.survivorId) {
        throw Error('Check the approved survivor and save a supported Gift Rule with a TikFinity gift ID.');
      }
      const token = randomBytes(32).toString('hex');
      liveSession = { token, connection, target, giftIds: target.hostedGiftIds };
      try {
        await enginePost('/hosted-live-start', { token, giftIds: target.hostedGiftIds });
        hostedTest = undefined;
        return { mode: 'live' };
      } catch (error) {
        liveSession = undefined;
        throw error;
      }
    }
    if (action === 'arm-hosted-tikfinity-test') {
      if (input?.confirmation !== 'ARM HOSTED ROSE') throw Error('Confirm before arming the hosted Rose test.');
      const state = await readEngineState();
      if (state.hostedGiftTest !== true) throw Error('Install the latest TikFinity engine update first.');
      if (state.giftSource !== 'tikfinity') throw Error('Select direct TikFinity and restart Companion first.');
      assertRewardLanesIdle(state);
      const connection = await connectWebsite();
      const target = await connection.hostedTestTarget();
      if (!target.enabled || target.serverId !== input.serverId || target.survivorId !== input.survivorId) {
        throw Error('Server access or Survivor ID changed. Review the approved server and try again.');
      }
      const token = randomBytes(32).toString('hex');
      await connection.armHostedTest(target, token);
      hostedTest = { token, connection, expiresAt: Date.now() + 120000 };
      try {
        const result = await enginePost('/tikfinity-test-arm', { hostedToken: token, confirmation: 'ARM TIKFINITY TEST' });
        return { ...result.giftTest, message: 'Hosted Rose armed for ' + target.serverName + '. Trigger the TikFinity action within two minutes.' };
      } catch (error) {
        hostedTest = undefined;
        throw error;
      }
    }
    if (action === 'arm-tikfinity-test' || action === 'tikfinity-test-status') {
      const state = await readEngineState();
      if (!state.giftTest) throw Error('Install the latest direct TikFinity engine update first.');
      if (state.giftSource !== 'tikfinity') throw Error('Select direct TikFinity and restart Companion first.');
      if (action === 'tikfinity-test-status') return state.giftTest;
      const result = await enginePost('/tikfinity-test-arm', { gift: input?.gift, confirmation: input?.confirmation });
      hostedTest = undefined;
      return result.giftTest;
    }
    if (action === 'account-sync-status') return accountSync?.getStatus() ?? { enabled: false, message: 'Start Companion from Operations Center.' };
    if (action === 'enable-account-sync' || action === 'disable-account-sync') {
      if (!accountSync) throw Error('Start Companion from Operations Center to connect to Northpath.');
      if (action === 'enable-account-sync') return accountSync.configure(await connectWebsite(), true);
      return accountSync.configure(null, false);
    }
    if (action === 'stop-live') {
      const current = liveSession;
      liveSession = undefined;
      if (current || (await readEngineState()).hostedLive?.enabled) {
        try { await enginePost('/hosted-live-stop', {}); }
        finally {
          if (current) {
            try {
              if (await current.connection.authorizeLiveGift(current.target, null, null, null) !== 'stopped') {
                throw Error('Could not confirm cancellation of the pending relay reward.');
              }
            } catch {
              throw Error('Companion stopped accepting new gifts. Check delivery history for the last reward.');
            }
          }
        }
        return { mode: 'off' };
      }
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
      if (!sameRuleFiles(saved.fingerprints, approved.before)) throw Error('The local Kit Editor files changed. Review the rule again.');
      return applyProtected(paths, approved.before, approved.config);
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
  }
  run.consumeHostedTest = async token => {
    if (!hostedTest || hostedTest.expiresAt <= Date.now() || hostedTest.token !== token) {
      return { state: 'blocked', message: 'The hosted Rose test expired. Arm it again in Operations Center.' };
    }
    const { connection } = hostedTest;
    hostedTest = undefined;
    return connection.sendHostedTest(token);
  };
  run.forwardLiveGift = async (sessionToken, eventHash, giftId) => {
    const current = liveSession;
    if (!current || current.token !== sessionToken) return { state: 'stopped', message: 'Start hosted Live Rewards in Companion.' };
    if (typeof eventHash !== 'string' || !/^[a-f0-9]{64}$/.test(eventHash)) {
      return { state: 'blocked', message: 'Gift skipped because the event ID was invalid.' };
    }
    const token = randomBytes(32).toString('hex');
    const decision = await current.connection.authorizeLiveGift(current.target, token, eventHash, giftId);
    if (current !== liveSession) return { state: 'stopped', message: 'Hosted Live Rewards stopped.' };
    if (decision === 'ignored') return { state: 'blocked', message: 'Gift skipped. Check the saved Gift Rule and owner whitelist.' };
    if (decision !== 'ready') {
      liveSession = undefined;
      return { state: 'stopped', message: 'Hosted Live Rewards stopped because server approval or reward policy changed.' };
    }
    const result = await current.connection.sendLiveGift(token);
    if (result.state === 'stopped' && current === liveSession) liveSession = undefined;
    return result;
  };
  run.refreshLiveGiftIds = async connection => {
    const current = liveSession;
    if (!current || current.connection !== connection || refreshingLive) return;
    refreshingLive = true;
    try {
      const target = await connection.hostedTestTarget();
      if (current !== liveSession || target.serverId !== current.target.serverId || target.survivorId !== current.target.survivorId ||
          target.hostedGiftIds.join(',') === current.giftIds.join(',')) return;
      await enginePost('/hosted-live-gifts', { token: current.token, giftIds: target.hostedGiftIds });
      current.giftIds = target.hostedGiftIds;
    } catch {
      // The relay rechecks the saved draft and approval before each delivery.
    } finally { refreshingLive = false; }
  };
  run.tickAccountSync = (connection, tryLock) => accountSync?.tick(connection, tryLock);
  return run;
}
