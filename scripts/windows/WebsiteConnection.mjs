import { createHash, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const website = 'https://northpath.ai';
const secretPattern = /^[0-9a-f]{64}$/;

function isPublicKey(key) {
  if (typeof key !== 'string' || key.length > 2048) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return false;
  try {
    return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role === 'anon';
  } catch {
    return false;
  }
}

async function deviceSecret(root) {
  const path = join(root, 'website-device.key');
  try {
    await writeFile(path, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const secret = (await readFile(path, 'utf8')).trim();
  if (!secretPattern.test(secret)) throw Error('Windows website connection key is invalid');
  return secret;
}

export async function prepareWebsiteConnection(root, fetcher = fetch) {
  let config;
  try {
    const response = await fetcher(`${website}/companion-agent.json`, { redirect: 'error', signal: AbortSignal.timeout(3000) });
    if (!response.ok) return null;
    config = await response.json();
  } catch {
    return null;
  }

  const url = URL.canParse(config?.supabaseUrl) ? new URL(config.supabaseUrl) : null;
  const key = config?.publishableKey;
  if (!url || url.protocol !== 'https:' || url.href !== `${url.origin}/` || !isPublicKey(key)) return null;
  const secret = await deviceSecret(root);
  const pairingCode = createHash('sha256').update(secret).digest('hex');

  return function start({ dashboardUrl, localToken }) {
    const controller = new AbortController();
    const { signal } = controller;
    let timeout;
    let paired = false;
    let offline = false;
    let result;
    const requestSignal = () => AbortSignal.any([signal, AbortSignal.timeout(5000)]);

    async function rpc(name, body) {
      const response = await fetcher(new URL(`/rest/v1/rpc/${name}`, url), {
        method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, p_device_secret: secret }),
        redirect: 'error', signal: requestSignal(),
      });
      if (!response.ok) throw Error('Website connection request failed');
      return response.json();
    }

    async function localStatus() {
      const response = await fetcher(new URL('/api/agent/status', dashboardUrl), { redirect: 'error', signal: requestSignal() });
      return response.ok ? response.json() : {};
    }

    async function preview() {
      const response = await fetcher(new URL('/api/agent/simulate/preview', dashboardUrl), {
        method: 'POST', headers: {
          Origin: dashboardUrl.origin, 'Content-Type': 'application/json', 'x-icepack-sync-token': localToken,
        },
        body: JSON.stringify({ id: '', name: 'Heart Me' }), redirect: 'error', signal: requestSignal(),
      });
      const data = await response.json();
      return response.ok && data.ok === true && data.previewOnly === true && data.message === 'The engine preview planned 25 Stone. No game command was sent.';
    }

    async function heartbeat() {
      try {
        if (result) {
          await rpc('finish_companion_preview', result);
          result = undefined;
        }
        const state = await localStatus().catch(() => ({}));
        const ready = state.engineOnline === true && state.customRulesMode === 'preview' && state.armState === false &&
          state.giftRconMode === 'off' && state.pending === 0 && state.customQueued === 0 && state.customInflight === false;
        const data = await rpc('companion_device_heartbeat', { p_engine_online: state.engineOnline === true, p_preview_ready: ready });
        if (data.paired === true && !paired) console.log('Website connected. Use Connections in the Northpath dashboard.');
        if (data.paired !== true && paired) console.log('Website disconnected. Pair again from the Northpath dashboard.');
        paired = data.paired === true;
        offline = false;
        if (paired && typeof data.preview_id === 'string') {
          result = { p_preview_id: data.preview_id, p_passed: await preview().catch(() => false) };
          await rpc('finish_companion_preview', result);
          result = undefined;
        }
      } catch {
        if (!signal.aborted && !offline) console.log('Website connection unavailable. Retrying…');
        offline = true;
      } finally {
        if (!signal.aborted) {
          timeout = setTimeout(() => void heartbeat(), 4000);
          timeout.unref();
        }
      }
    }

    console.log(`Website pairing code: ${pairingCode}`);
    void heartbeat();
    return () => { controller.abort(); clearTimeout(timeout); };
  };
}
