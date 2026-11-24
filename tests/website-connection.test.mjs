import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { prepareWebsiteConnection } from '../scripts/windows/WebsiteConnection.mjs';

test('the pilot falls back to local preview when the website has no public relay config', async () => {
  const root = await mkdtemp(join(tmpdir(), 'website-unconfigured-'));
  try {
    for (const config of [
      { supabaseUrl: 'http://example.supabase.co', publishableKey: 'sb_publishable_fixture' },
      { supabaseUrl: 'https://example.supabase.co', publishableKey: 'sb_secret_fixture' },
    ]) {
      assert.equal(await prepareWebsiteConnection(root, () => Response.json(config)), null);
    }
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true });
  }
});

test('the website link uses a separate device key and runs only the fixed Heart Me preview', { timeout: 3000 }, async t => {
  t.mock.method(console, 'log', () => {});
  const root = await mkdtemp(join(tmpdir(), 'website-companion-'));
  const localToken = 'a'.repeat(48);
  const previewId = '11111111-0000-4000-8000-000000000001';
  const calls = [];
  let close;
  try {
    let recordResult;
    const result = new Promise(resolve => { recordResult = resolve; });
    const connection = await prepareWebsiteConnection(root, async (input, request) => {
      const url = new URL(input);
      if (url.href === 'https://northpath.ai/companion-agent.json') {
        return Response.json({ supabaseUrl: 'https://example.supabase.co', publishableKey: 'sb_publishable_fixture' });
      }
      calls.push({ url, request });
      switch (url.pathname) {
        case '/api/agent/status':
          return Response.json({ engineOnline: true, customRulesMode: 'preview', armState: false, giftRconMode: 'off', pending: 0, customQueued: 0, customInflight: false });
        case '/rest/v1/rpc/companion_device_heartbeat':
          return Response.json({ paired: true, preview_id: previewId });
        case '/api/agent/simulate/preview':
          return Response.json({ ok: true, previewOnly: true, message: 'The engine preview planned 25 Stone. No game command was sent.' });
        case '/rest/v1/rpc/finish_companion_preview':
          recordResult();
          return Response.json(true);
        default:
          throw Error(`Unexpected request: ${url.pathname}`);
      }
    });
    assert.match(connection.pairingCode, /^[0-9a-f]{64}$/);
    close = connection.start({ dashboardUrl: new URL('http://127.0.0.1:5176/first-run.html'), localToken });
    await result;

    const deviceKey = await readFile(join(root, 'website-device.key'), 'utf8');
    assert.deepEqual(calls.map(({ url }) => url.pathname), [
      '/api/agent/status', '/rest/v1/rpc/companion_device_heartbeat', '/api/agent/simulate/preview', '/rest/v1/rpc/finish_companion_preview',
    ]);
    const [, heartbeat, preview, finish] = calls;
    assert.deepEqual(JSON.parse(heartbeat.request.body), { p_device_secret: deviceKey, p_engine_online: true, p_preview_ready: true });
    assert.deepEqual(JSON.parse(finish.request.body), { p_device_secret: deviceKey, p_preview_id: previewId, p_passed: true });
    assert.equal(heartbeat.request.headers['x-icepack-sync-token'], undefined);
    assert.equal(finish.request.headers['x-icepack-sync-token'], undefined);
    assert.equal(preview.request.headers['x-icepack-sync-token'], localToken);
    assert.deepEqual(JSON.parse(preview.request.body), { id: '', name: 'Heart Me' });
  } finally {
    close?.();
    await rm(root, { recursive: true });
  }
});

test('Operations Center reports survivor readiness without sending an ID or taking preview requests', { timeout: 3000 }, async t => {
  t.mock.method(console, 'log', () => {});
  const root = await mkdtemp(join(tmpdir(), 'website-survivor-'));
  let close;
  try {
    const requests = [];
    const config = { supabaseUrl: 'https://example.supabase.co', publishableKey: 'sb_publishable_fixture' };
    let reportStatus;
    const reported = new Promise(resolve => { reportStatus = resolve; });
    const connection = await prepareWebsiteConnection(root, async (input, request) => {
      const url = new URL(input);
      if (url.hostname === 'northpath.ai') return Response.json(config);
      requests.push(url.pathname);
      reportStatus(JSON.parse(request.body));
      return Response.json({ paired: true, preview_id: 'unexpected-preview-request' });
    });
    close = connection.start({
      readSurvivorStatus: () => ({ engineOnline: true, survivorConfigured: true, playerId: '537815134' }),
    });
    const payload = await reported;
    await new Promise(resolve => setImmediate(resolve));
    const deviceKey = await readFile(join(root, 'website-device.key'), 'utf8');
    assert.deepEqual(payload, { p_device_secret: deviceKey, p_engine_online: true, p_survivor_configured: true });
    assert.deepEqual(requests, ['/rest/v1/rpc/report_companion_survivor']);
  } finally {
    close?.();
    await rm(root, { recursive: true });
  }
});
