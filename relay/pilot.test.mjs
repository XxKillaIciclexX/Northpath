import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createTcpServer } from 'node:net';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { readConfig } from './config.mjs';
import { connectRcon } from './rcon.mjs';
import { createRelay } from './relay.mjs';
import { createStore } from './supabase.mjs';

const owner = '238fc7ec-c121-4ee4-8a67-f9bed33eb901';
const streamer = '9f88f270-5f67-4ed9-b9f9-e068a46538b4';
const outsider = '81543bf4-4118-41fe-991b-fa537ed6434b';
const password = 'fixture-rcon-password';
const migration = new URL('../supabase/migrations/20261124000100_create_icepack_relay_pilot.sql', import.meta.url);
const desktopMigration = new URL('../supabase/migrations/20261125000100_create_companion_relay_tests.sql', import.meta.url);
const liveMigration = new URL('../supabase/migrations/20261125000200_create_companion_live_rose.sql', import.meta.url);
const site = 'https://northpath.test';
const fixtureKey = 'fixture-service-role';
const env = {
  ICEPACK_RELAY_OWNER_ID: owner, ICEPACK_RELAY_SITE_ORIGIN: site, ICEPACK_RELAY_TARGET_HOST: 'game.northpath.test',
  ICEPACK_RELAY_TARGET_IPV4: '8.8.4.4', ICEPACK_RELAY_TARGET_PORT: '27020', ICEPACK_RELAY_VAULT_KEY: 'ab'.repeat(32),
  SUPABASE_SERVICE_ROLE_KEY: fixtureKey, SUPABASE_URL: 'https://supabase.northpath.test',
};

async function listen(t, server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections?.();
    return new Promise(resolve => server.close(resolve));
  });
  return server.address().port;
}

function fakeRcon(commands, sessions) {
  return createTcpServer(socket => {
    sessions.push(socket);
    let bytes = Buffer.alloc(0);
    socket.on('data', chunk => {
      bytes = Buffer.concat([bytes, chunk]);
      while (bytes.length >= 4) {
        const size = bytes.readInt32LE() + 4;
        if (bytes.length < size) return;
        const packet = bytes.subarray(0, size);
        bytes = bytes.subarray(size);
        const id = packet.readInt32LE(4);
        const type = packet.readInt32LE(8);
        const text = packet.toString('utf8', 12, size - 2);
        assert.ok(type === 3 || type === 2);
        if (type === 2) commands.push(text);
        const reply = Buffer.alloc(14);
        reply.writeInt32LE(10);
        reply.writeInt32LE(type === 3 && text !== password ? -1 : id, 4);
        reply.writeInt32LE(type === 3 ? 2 : 0, 8);
        socket.write(reply);
      }
    });
  });
}

const actors = new Map([['owner-token', owner], ['streamer-token', streamer], ['outsider-token', outsider]]);
const argumentsFor = {
  dashboard: ['p_actor', 'p_search'],
  register: ['p_actor', 'p_name', 'p_listed', 'p_limit', 'p_envelope'],
  manage: ['p_actor', 'p_server', 'p_action', 'p_streamer', 'p_value'],
  delivery: ['p_actor', 'p_server', 'p_request', 'p_phase'],
  desktop_delivery: ['p_token_hash', 'p_owner', 'p_phase'],
  paired_delivery: ['p_token_hash', 'p_owner', 'p_phase', 'p_source'],
  live_rose_policy: ['p_actor', 'p_server', 'p_policy', 'p_enabled'],
  finish: ['p_actor', 'p_server', 'p_request', 'p_state'],
};

function fakeSupabase(db) {
  return createHttpServer(async (request, response) => {
    const send = (status, result) => response.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(result));
    try {
      assert.equal(request.headers.apikey, fixtureKey);
      if (request.url === '/auth/v1/user') {
        const actor = actors.get(request.headers.authorization?.slice(7));
        return actor ? send(200, { id: actor }) : send(401, {});
      }
      assert.equal(request.headers.authorization, 'Bearer ' + fixtureKey);
      const name = request.url.split('/icepack_relay_')[1];
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks));
      const keys = argumentsFor[name];
      const result = await db.transaction(async tx => {
        await tx.exec('set local role service_role');
        return tx.query('select public.icepack_relay_' + name + '(' + keys.map((_, i) => '$' + (i + 1)).join(',') + ') as result',
          keys.map(key => body[key]));
      });
      return send(200, result.rows[0].result);
    } catch (error) {
      console.error(error);
      return send(500, {});
    }
  });
}

test('relay pins a public target and rejects local, shared, and reserved RCON addresses', () => {
  for (const address of ['127.0.0.1', '169.254.169.254', '10.1.0.2', '100.64.0.1', '192.0.2.1', '224.0.0.1', '::ffff:127.0.0.1']) {
    assert.throws(() => readConfig({ ...env, ICEPACK_RELAY_TARGET_IPV4: address }), /verified test server/);
  }
  assert.equal(readConfig(env).address, env.ICEPACK_RELAY_TARGET_IPV4);
});

test('owner registration, discovery, one Rose delivery, history, and revoke across HTTP, SQL and RCON', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key, email text);');
  await db.exec('create table public.companion_devices (user_id uuid primary key, pairing_hash text not null unique);');
  await db.query("insert into auth.users values ($1,'owner@example.test'),($2,'streamer@example.test'),($3,'outsider@example.test')", [owner, streamer, outsider]);
  await db.exec(await readFile(migration, 'utf8'));
  await db.exec(await readFile(desktopMigration, 'utf8'));
  await db.exec(await readFile(liveMigration, 'utf8'));
  for (const role of ['anon', 'authenticated', 'service_role']) {
    await assert.rejects(db.transaction(async tx => {
      await tx.exec('set local role ' + role);
      await tx.query('select * from public.icepack_relay_vault');
    }), /permission denied/);
  }
  await assert.rejects(db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select public.icepack_relay_dashboard($1,'test')", [owner]);
  }), /permission denied/);

  const commands = [];
  const rconSessions = [];
  const rconPort = await listen(t, fakeRcon(commands, rconSessions));
  const backendPort = await listen(t, fakeSupabase(db));
  const config = readConfig({ ...env, SUPABASE_URL: 'http://127.0.0.1:' + backendPort });
  let pauseConnection;
  let releaseConnection;
  t.after(() => releaseConnection?.());
  const port = await listen(t, createRelay({
    config, store: createStore(config),
    async connect(details) {
      assert.equal(details.address, env.ICEPACK_RELAY_TARGET_IPV4);
      assert.equal(details.port, Number(env.ICEPACK_RELAY_TARGET_PORT));
      const connection = await connectRcon({ ...details, address: '127.0.0.1', port: rconPort });
      if (pauseConnection) await pauseConnection();
      return connection;
    },
  }));

  async function api(token, action, payload = {}, origin = site) {
    const response = await fetch('http://127.0.0.1:' + port + '/v1/pilot', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload }), signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, body: await response.json() };
  }

  assert.equal((await api('invalid-token', 'dashboard')).status, 401);
  assert.equal((await api('owner-token', 'dashboard', {}, 'https://other.test')).status, 403);
  const registration = {
    name: 'Northpath test ARK', host: config.host, port: config.rconPort, password, listed: true, hourlyLimit: 1,
  };
  assert.equal((await api('outsider-token', 'register', registration)).status, 403);
  assert.equal((await api('owner-token', 'register', { ...registration, host: 'localhost' })).status, 400);
  assert.equal(rconSessions.length, 0);
  assert.equal((await api('owner-token', 'register', { ...registration, password: 'wrong' })).status, 502);
  const registered = await api('owner-token', 'register', registration);
  assert.equal(registered.status, 200, JSON.stringify(registered.body));
  const serverId = registered.body.id;
  const stored = await db.query('select envelope from public.icepack_relay_vault');
  assert.ok(stored.rows[0].envelope.length > 50);
  assert.ok(!Buffer.from(stored.rows[0].envelope, 'base64url').includes(Buffer.from(password)));
  const found = await api('streamer-token', 'dashboard', { search: 'test ark' });
  assert.deepEqual(found.body.results, [{ id: serverId, name: registration.name }]);
  assert.equal(found.body.owned, null);
  const testRequest = { serverId, requestId: crypto.randomUUID() };
  assert.equal((await api('streamer-token', 'simulate', testRequest)).status, 403);
  assert.equal((await api('streamer-token', 'request', { serverId, survivorId: '17;other' })).status, 400);
  assert.equal((await api('streamer-token', 'request', { serverId, survivorId: '12345' })).status, 200);
  const approval = { serverId, streamerId: streamer, survivorId: '12345' };
  assert.equal((await api('outsider-token', 'approve', approval)).status, 403);
  assert.equal((await api('owner-token', 'approve', { ...approval, survivorId: '56789' })).status, 409);
  assert.equal((await api('owner-token', 'approve', approval)).status, 200);
  assert.deepEqual(await api('streamer-token', 'simulate', { ...testRequest, survivorId: '99999', quantity: 500 }),
    { status: 200, body: { state: 'acknowledged' } });
  assert.deepEqual(commands, [
    "GiveItemToPlayer 12345 \"Blueprint'/Game/PrimalEarth/CoreBlueprints/Resources/PrimalItemResource_Stone.PrimalItemResource_Stone'\" 5 0 0",
  ]);
  assert.equal((await api('streamer-token', 'simulate', testRequest)).status, 409);
  await db.exec("update public.icepack_relay_deliveries set created_at = clock_timestamp() - interval '20 seconds'");
  assert.equal((await api('streamer-token', 'simulate', { serverId, requestId: crypto.randomUUID() })).status, 429);
  const dashboard = await api('owner-token', 'dashboard');
  assert.equal(dashboard.body.owned.history[0].state, 'acknowledged');
  assert.equal(dashboard.body.owned.history[0].streamer, 'streamer@example.test');
  for (const value of [password, config.host, stored.rows[0].envelope]) assert.ok(!JSON.stringify(dashboard.body).includes(value));

  assert.equal((await api('owner-token', 'limit', { serverId, hourlyLimit: 3 })).status, 200);
  const waiting = new Promise(resolve => {
    pauseConnection = () => new Promise(release => { releaseConnection = release; resolve(); });
  });
  const pending = api('streamer-token', 'simulate', { serverId, requestId: crypto.randomUUID() });
  await Promise.race([waiting, pending.then(() => assert.fail('Second test did not reach RCON authentication.'))]);
  try {
    assert.equal((await api('owner-token', 'revoke', approval)).status, 200);
  } finally {
    releaseConnection();
  }
  assert.equal((await pending).status, 403);
  assert.equal((await api('streamer-token', 'simulate', { serverId, requestId: crypto.randomUUID() })).status, 403);
  assert.equal(commands.length, 1);
  assert.deepEqual((await api('owner-token', 'dashboard')).body.owned.history.map(entry => entry.state), ['cancelled','acknowledged']);

  pauseConnection = undefined;
  await db.exec("update public.icepack_relay_deliveries set created_at = clock_timestamp() - interval '16 seconds'");
  async function desktop(token, path = '/v1/desktop-test') {
    return fetch('http://127.0.0.1:' + port + path, {
      method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: '{}',
      signal: AbortSignal.timeout(5000),
    });
  }
  const hash = value => createHash('sha256').update(value).digest('hex');
  const pairingSecret = randomBytes(32).toString('hex');
  const token = randomBytes(32).toString('hex');
  const arm = async secret => db.transaction(async tx => {
    await tx.exec('set local role anon');
    return (await tx.query('select public.arm_companion_relay_test($1,$2,$3,$4) as armed',
      [pairingSecret, serverId, '12345', hash(secret)])).rows[0].armed;
  });
  await db.query('insert into public.companion_devices values ($1,$2)', [streamer, hash(pairingSecret)]);
  assert.equal(await arm(token), false);
  assert.equal((await api('streamer-token', 'request', { serverId, survivorId: '12345' })).status, 200);
  assert.equal((await api('owner-token', 'approve', approval)).status, 200);
  assert.equal(await arm(token), true);
  await assert.rejects(db.transaction(async tx => {
    await tx.exec('set local role anon');
    await tx.query('select * from public.companion_relay_tests');
  }), /permission denied/);
  assert.equal((await desktop(pairingSecret)).status, 403);
  const desktopResult = await desktop(token);
  assert.equal(desktopResult.status, 200);
  assert.deepEqual(await desktopResult.json(), { state: 'acknowledged' });
  assert.equal((await desktop(token)).status, 409);
  assert.equal(commands.length, 2);
  assert.equal(commands[0], commands[1]);

  const stale = randomBytes(32).toString('hex');
  assert.equal(await arm(stale), true);
  assert.equal((await api('owner-token', 'revoke', approval)).status, 200);
  assert.equal((await api('streamer-token', 'request', { serverId, survivorId: '12345' })).status, 200);
  assert.equal((await api('owner-token', 'approve', approval)).status, 200);
  assert.equal((await desktop(stale)).status, 403);
  const disconnected = randomBytes(32).toString('hex');
  assert.equal(await arm(disconnected), true);
  await db.query('delete from public.companion_devices where user_id = $1', [streamer]);
  assert.equal((await desktop(disconnected)).status, 403);
  await db.query('insert into public.companion_devices values ($1,$2)', [streamer, hash(pairingSecret)]);
  assert.equal((await desktop(disconnected)).status, 403);
  assert.equal(commands.length, 2);

  const ownerDashboard = () => api('owner-token', 'dashboard').then(result => result.body.owned);
  assert.equal((await ownerDashboard()).rewardPolicy, 'all_supported');
  assert.equal((await ownerDashboard()).roseWhitelisted, false);
  const policy = (mode, allowed, actor = 'owner-token') =>
    api(actor, 'reward-policy', { serverId, policy: mode, roseWhitelisted: allowed });
  const live = (secret, hashOfEvent) => db.transaction(async tx => {
    await tx.exec('set local role anon');
    return (await tx.query('select public.authorize_companion_live_rose($1,$2,$3,$4,$5) as allowed',
      [pairingSecret, serverId, '12345', secret ? hash(secret) : null, hashOfEvent])).rows[0].allowed;
  });
  const realGift = (secret) => desktop(secret, '/v1/live-rose');
  const event = hash('one stable finalized Rose streak');
  assert.equal((await api('owner-token', 'limit', { serverId, hourlyLimit: 10 })).status, 200);
  await db.exec("update public.icepack_relay_deliveries set created_at = clock_timestamp() - interval '16 seconds'");
  const liveToken = randomBytes(32).toString('hex');
  assert.equal(await live(liveToken, event), true);
  assert.equal((await desktop(liveToken)).status, 403);
  const liveResult = await realGift(liveToken);
  assert.equal(liveResult.status, 200);
  assert.deepEqual(await liveResult.json(), { state: 'acknowledged' });
  assert.equal((await ownerDashboard()).history[0].source, 'live_rose');
  const replay = randomBytes(32).toString('hex');
  assert.equal(await live(replay, event), true);
  assert.equal((await realGift(replay)).status, 409);
  assert.equal((await policy('whitelist', false, 'outsider-token')).status, 403);
  assert.equal((await policy('whitelist', false)).status, 200);
  assert.equal(await live(randomBytes(32).toString('hex'), hash('second event')), false);
  assert.equal(await arm(randomBytes(32).toString('hex')), false);
  assert.equal((await api('streamer-token', 'simulate', { serverId, requestId: crypto.randomUUID() })).status, 403);
  assert.equal((await policy('whitelist', true)).status, 200);

  const testToken = randomBytes(32).toString('hex');
  assert.equal(await arm(testToken), true);
  assert.equal((await realGift(testToken)).status, 403);
  await db.exec("update public.icepack_relay_deliveries set created_at = clock_timestamp() - interval '16 seconds'");
  const inFlight = randomBytes(32).toString('hex');
  assert.equal(await live(inFlight, hash('second event')), true);
  const reachedRcon = new Promise(resolve => {
    pauseConnection = () => new Promise(release => { releaseConnection = release; resolve(); });
  });
  const sending = realGift(inFlight);
  await Promise.race([reachedRcon, sending.then(() => assert.fail('Live gift did not reach RCON authentication.'))]);
  try { assert.equal((await policy('whitelist', false)).status, 200); } finally { releaseConnection(); }
  assert.equal((await sending).status, 403);
  assert.equal(commands.length, 3);

  assert.equal((await policy('whitelist', true)).status, 200);
  const stopped = randomBytes(32).toString('hex');
  assert.equal(await live(stopped, hash('another event')), true);
  assert.equal(await live(null, null), true);
  assert.equal((await realGift(stopped)).status, 403);
  assert.equal(commands.length, 3);
});
