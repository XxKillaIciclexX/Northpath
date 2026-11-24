import fs from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { hashConfig } from './sync.mjs';
import { assertRewardLanesIdle } from './website-rule.mjs';
import { mergeWebsiteDraft, rehearseChanges } from './website-batch.mjs';

export const configFileHash = config => createHash('sha256').update(JSON.stringify(config, null, 2) + '\n').digest('hex');
export const sameRuleFiles = (actual, expected) => Boolean(actual && expected && ['rules', 'catalog', 'contentPrefs']
  .every(key => Object.hasOwn(expected, key) && actual[key] === expected[key]));

export function createAccountSync({ directory, kitDir, readEngineState, localRules, applyProtected, reloadEngine, verifyLoaded }) {
  if (!directory) return null;
  const filename = join(directory, 'account-sync.json');
  let status = { state: 'pending', message: 'Checking the saved website draft.' };
  let latestDraft;
  let retryAfter = 0;
  let blockedRevision;
  let reported;

  function load() {
    try { return JSON.parse(fs.readFileSync(filename, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; return null; }
  }

  function store(settings) {
    const staging = `${filename}.${randomBytes(8).toString('hex')}.tmp`;
    try {
      fs.writeFileSync(staging, JSON.stringify(settings), { flag: 'wx', mode: 0o600 });
      fs.renameSync(staging, filename);
    } finally { fs.rmSync(staging, { force: true }); }
  }

  function getStatus() {
    const settings = load();
    if (!settings?.enabled) return { enabled: false, message: 'Automatic account sync is off.' };
    return { enabled: true, ...status };
  }

  async function configure(connection, enabled) {
    const existing = load();
    if (!enabled) {
      if (!existing) return getStatus();
      store({ ...existing, enabled: false });
      reported = undefined;
      if (connection) await connection.reportSync({ account: existing.account, enabled: false }).catch(() => {});
      return getStatus();
    }
    const remote = await connection.readSyncDraft();
    if (!remote?.account) throw Error('Pair Operations Center on the website and wait for it to connect.');
    if (!kitDir) throw Error('Configure the local Kit Editor directory in Companion first.');
    if (existing?.journal && (existing.account !== remote.account || existing.kitDir !== kitDir)) {
      throw Error('Finish the previous account sync on its original Kit Editor before switching accounts.');
    }
    const sameAccount = existing?.account === remote.account && existing.kitDir === kitDir;
    store({ ...(sameAccount ? existing : {}), account: remote.account, kitDir, enabled: true });
    latestDraft = undefined;
    reported = undefined;
    retryAfter = 0;
    status = { state: 'pending', message: 'Automatic account sync is on. Checking the saved draft.' };
    return getStatus();
  }

  async function tick(connection, tryLock) {
    const settings = load();
    if (!settings) return;
    const { enabled, account } = settings;
    let serverStatus;
    let unlock;
    let revision;
    const setStatus = (state, message, revision) => {
      status = { state, message };
      serverStatus = { account, enabled, revision, state };
    };
    try {
      if (!enabled) {
        serverStatus = { account, enabled };
        return;
      }
      if (settings.kitDir !== kitDir) throw Error('Kit Editor changed. Enable account sync for the new directory.');
      const remote = await connection.readSyncDraft(latestDraft?.revision ?? settings.applied?.revision);
      if (remote?.account !== account) throw Error('The paired account changed. Enable account sync again for that account.');
      revision = remote.revision;
      if (remote.draft) latestDraft = remote;
      if (!remote.revision) {
        setStatus(null, 'Save your first draft on the website.', null);
        return;
      }
      if (status.state === 'blocked' && blockedRevision === revision && Date.now() < retryAfter) {
        setStatus('blocked', status.message, revision);
        return;
      }
      setStatus('pending', 'Waiting for the engine and gift lanes to be idle.', remote.revision);
      try {
        const state = await readEngineState();
        if (!settings.journal && settings.applied?.revision === revision &&
            state.customRules?.loaded && sameRuleFiles(state.customRules.loadedFingerprints, settings.applied.files)) {
          setStatus('applied', 'The engine loaded the latest saved account draft.', revision);
          return;
        }
        assertRewardLanesIdle(state);
      } catch { return; }
      unlock = tryLock();
      if (!unlock || JSON.stringify(load()) !== JSON.stringify(settings)) return;

      const { paths, planner, saved } = await localRules();
      const { journal } = settings;
      if (journal) {
        if (sameRuleFiles(saved.fingerprints, journal.after)) {
          const loaded = (await reloadEngine()).customRules;
          verifyLoaded(loaded, saved.fingerprints);
          settings.applied = journal.applied;
        } else if (!sameRuleFiles(saved.fingerprints, journal.before)) {
          throw Error('Local rules changed during sync. Inspect the Kit Editor files before retrying.');
        }
        delete settings.journal;
        store(settings);
      }

      if (settings.applied?.revision !== remote.revision) {
        if (latestDraft?.revision !== remote.revision) return;
        const { config, owned } = mergeWebsiteDraft(latestDraft.draft, saved, settings.applied?.owned);
        rehearseChanges(planner, saved, config);
        const fresh = await connection.readSyncDraft(remote.revision);
        if (fresh.account !== account || fresh.revision !== remote.revision) return;
        assertRewardLanesIdle(await readEngineState());
        const current = planner.loadSavedRules(kitDir);
        if (!sameRuleFiles(current.fingerprints, saved.fingerprints)) throw Error('The local Kit Editor files changed during sync.');
        const changed = hashConfig(config) !== hashConfig(saved.config);
        const files = changed ? { ...saved.fingerprints, rules: configFileHash(config) } : saved.fingerprints;
        const applied = { revision: remote.revision, owned, files };
        if (changed) {
          settings.journal = { before: saved.fingerprints, after: files, applied };
          store(settings);
          await applyProtected(paths, saved.fingerprints, config);
        } else {
          const loaded = (await reloadEngine()).customRules;
          verifyLoaded(loaded, saved.fingerprints);
        }
        settings.applied = applied;
        delete settings.journal;
        store(settings);
      } else {
        if (!sameRuleFiles(saved.fingerprints, settings.applied.files)) throw Error('Local Kit Editor files have changed. Save a new website draft to sync nonconflicting changes.');
        const loaded = (await reloadEngine()).customRules;
        verifyLoaded(loaded, saved.fingerprints);
      }
      setStatus('applied', 'The engine loaded the latest saved account draft.', remote.revision);
    } catch (error) {
      setStatus('blocked', String(error.message).slice(0, 250), revision ?? null);
      blockedRevision = revision;
      retryAfter = Date.now() + 30_000;
    } finally {
      unlock?.();
      if (serverStatus && load()?.enabled === serverStatus.enabled && JSON.stringify(serverStatus) !== reported) {
        try { if (await connection.reportSync(serverStatus)) reported = JSON.stringify(serverStatus); }
        catch { /* The next heartbeat retries the status. */ }
      }
    }
  }

  return { configure, getStatus, tick };
}
