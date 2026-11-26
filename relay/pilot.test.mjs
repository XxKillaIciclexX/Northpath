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
import rewardCatalog from './reward-catalog.json' with { type: 'json' };

const owner = '238fc7ec-c121-4ee4-8a67-f9bed33eb901';
const streamer = '9f88f270-5f67-4ed9-b9f9-e068a46538b4';
const outsider = '81543bf4-4118-41fe-991b-fa537ed6434b';
const password = 'fixture-rcon-password';
const migration = new URL('../supabase/migrations/20261124000100_create_icepack_relay_pilot.sql', import.meta.url);
const desktopMigration = new URL('../supabase/migrations/20261125000100_create_companion_relay_tests.sql', import.meta.url);
const liveMigration = new URL('../supabase/migrations/20261125000200_create_companion_live_rose.sql', import.meta.url);
const catalogMigration = new URL('../supabase/migrations/20261125000300_add_hosted_reward_catalog.sql', import.meta.url);
const draftsMigration = new URL('../supabase/migrations/20261123000200_create_companion_drafts.sql', import.meta.url);
const giftRulesMigration = new URL('../supabase/migrations/20261125000400_add_streamer_hosted_gift_rules.sql', import.meta.url);
const expandedCatalogMigration = new URL('../supabase/migrations/20261125000500_expand_hosted_reward_catalog.sql', import.meta.url);
const customKitsMigration = new URL('../supabase/migrations/20261125000600_add_custom_hosted_kits.sql', import.meta.url);
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
  catalog_policy: ['p_actor', 'p_server', 'p_policy', 'p_rewards'],
  catalog_delivery: ['p_actor', 'p_server', 'p_request', 'p_phase', 'p_reward'],
  finish_catalog: ['p_actor', 'p_server', 'p_request', 'p_reward', 'p_state', 'p_acknowledged'],
  saved_kit_delivery: ['p_actor', 'p_server', 'p_request', 'p_phase', 'p_kit_id', 'p_revision'],
  hosted_gift_delivery: ['p_token_hash', 'p_owner', 'p_phase', 'p_request'],
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

test('server registration, policies, saved Gift Rules and Kit delivery across HTTP, SQL and RCON', async t => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key, email text);');
  await db.exec('create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;');
  await db.exec(await readFile(draftsMigration, 'utf8'));
  await db.exec('create table public.companion_devices (user_id uuid primary key, pairing_hash text not null unique);');
  await db.query("insert into auth.users values ($1,'owner@example.test'),($2,'streamer@example.test'),($3,'outsider@example.test')", [owner, streamer, outsider]);
  await db.exec(await readFile(migration, 'utf8'));
  await db.exec(await readFile(desktopMigration, 'utf8'));
  await db.exec(await readFile(liveMigration, 'utf8'));
  await db.query("insert into public.icepack_relay_servers (owner_id, name, listed, hourly_limit, reward_policy, rose_whitelisted) values ($1,'Existing whitelist',false,1,'whitelist',true)", [outsider]);
  await db.exec(await readFile(catalogMigration, 'utf8'));
  await db.exec(await readFile(giftRulesMigration, 'utf8'));
  await db.exec(await readFile(expandedCatalogMigration, 'utf8'));
  await db.exec(await readFile(customKitsMigration, 'utf8'));
  const supported = await db.query('select public.icepack_hosted_reward_ids() as ids');
  assert.deepEqual(supported.rows[0].ids, rewardCatalog.map(entry => entry.id));
  const upgraded = await db.query('select allowed_reward_ids from public.icepack_relay_servers where owner_id = $1', [outsider]);
  assert.deepEqual(upgraded.rows[0].allowed_reward_ids, ['rose-stone']);
  await db.query('delete from public.icepack_relay_servers where owner_id = $1', [outsider]);
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
  let pauseAfterCommand;
  let releaseCommand;
  t.after(() => releaseConnection?.());
  t.after(() => releaseCommand?.());
  const port = await listen(t, createRelay({
    config, store: createStore(config),
    async connect(details) {
      assert.equal(details.address, env.ICEPACK_RELAY_TARGET_IPV4);
      assert.equal(details.port, Number(env.ICEPACK_RELAY_TARGET_PORT));
      const connection = await connectRcon({ ...details, address: '127.0.0.1', port: rconPort });
      if (pauseConnection) await pauseConnection();
      return { ...connection, async send(command) {
        const result = await connection.send(command);
        if (pauseAfterCommand) await pauseAfterCommand();
        return result;
      } };
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

  pauseConnection = undefined;
  const saveWhitelist = ids => api('owner-token', 'reward-policy', {
    serverId, policy: 'whitelist', allowedRewardIds: ids,
  });
  const reward = id => ({ serverId, requestId: crypto.randomUUID(), rewardId: id });
  const deliver = input => api('streamer-token', 'simulate', input);
  const liftCooldown = () => db.exec(`
    update public.icepack_relay_deliveries set created_at = clock_timestamp() - interval '16 seconds'
    where created_at > clock_timestamp() - interval '16 seconds'
  `);
  assert.equal((await saveWhitelist(['starter-kit', 'unapproved'])).status, 400);
  assert.equal((await saveWhitelist(['wild-dodo', 'wild-dodo'])).status, 400);
  assert.equal((await saveWhitelist(['wild-dodo', 'starter-kit'])).status, 200);
  assert.deepEqual((await ownerDashboard()).allowedRewardIds, ['wild-dodo', 'starter-kit']);
  assert.equal((await deliver(reward('rose-stone'))).status, 403);
  assert.equal((await deliver(reward('starter-kit'))).status, 403);
  assert.equal((await deliver(reward('rex-level-9000'))).status, 400);
  await liftCooldown();
  const spawn = reward('wild-dodo');
  assert.deepEqual(await deliver({ ...spawn, survivorId: '99999', command: 'arbitrary' }), {
    status: 200, body: { state: 'acknowledged', rewardId: 'wild-dodo', acknowledged: 1, total: 1 },
  });
  assert.equal(commands.at(-1), 'ScriptCommand IcePackSpawn,Dodo,25,12345');
  assert.equal((await deliver(spawn)).status, 409);
  const allComponents = ['rose-stone', 'wild-dodo', 'starter-kit'];
  assert.equal((await saveWhitelist(allComponents)).status, 200);
  assert.equal((await deliver(reward('starter-kit'))).status, 429);
  await liftCooldown();
  assert.deepEqual(await deliver(reward('starter-kit')), {
    status: 200, body: { state: 'acknowledged', rewardId: 'starter-kit', acknowledged: 2, total: 2 },
  });
  assert.deepEqual(commands.slice(-2), [commands[0], 'ScriptCommand IcePackSpawn,Dodo,25,12345']);
  await liftCooldown();
  const firstStep = new Promise(resolve => {
    pauseAfterCommand = () => new Promise(release => { releaseCommand = release; resolve(); });
  });
  const partial = deliver(reward('starter-kit'));
  await Promise.race([firstStep, partial.then(() => assert.fail('Kit did not reach its first RCON step.'))]);
  try {
    assert.equal((await saveWhitelist(['rose-stone', 'starter-kit'])).status, 200);
    assert.equal((await saveWhitelist(allComponents)).status, 200);
  } finally { releaseCommand(); }
  assert.deepEqual(await partial, {
    status: 200, body: { state: 'unconfirmed', rewardId: 'starter-kit', acknowledged: 1, total: 2 },
  });
  const newest = (await ownerDashboard()).history[0];
  assert.equal(newest.rewardId, 'starter-kit');
  assert.equal(newest.acknowledgedCommands, 1);
  assert.equal(commands.length, 7);
  assert.equal(commands.at(-1), commands[0]);

  pauseAfterCommand = undefined;
  const dodo = { type: 'dinosaur', catalogId: 'Dodo', quantity: 1, level: 25, tamed: false, announcement: '' };
  const stone = { type: 'item', catalogId: 'Stone', quantity: 5, quality: 0, announcement: '' };
  const kit = { type: 'kit', kitId: 'private-kit', announcement: '' };
  const draft = {
    version: 1,
    rules: [{ giftId: '8811', enabled: true, action: dodo }, { giftId: '8812', enabled: true, action: kit }],
    kits: [{ id: 'private-kit', name: 'First wipe supplies', entries: [{ action: stone }, { action: dodo }] }],
  };
  await db.query('insert into public.companion_drafts(user_id, draft) values ($1,$2::jsonb)', [streamer, JSON.stringify(draft)]);
  const authorizeSaved = (secret, gift, eventKey) => db.transaction(async tx => {
    await tx.exec('set local role anon');
    return (await tx.query('select public.authorize_companion_draft_gift($1,$2,$3,$4,$5,$6) as decision',
      [pairingSecret, serverId, '12345', gift, hash(secret), hash(eventKey)])).rows[0].decision;
  });
  const eligibleIds = await db.query('select public.get_companion_relay_test_target($1) as status', [pairingSecret]);
  assert.deepEqual(eligibleIds.rows[0].status.targets[0].hostedGiftIds, ['8811','8812']);
  const sendSaved = secret => desktop(secret, '/v1/live-reward');
  const giftGrant = randomBytes(32).toString('hex');
  assert.equal(await authorizeSaved(giftGrant, '5655', 'rose has no mapping'), 'ignored');
  assert.equal(await authorizeSaved(giftGrant, '8811', 'assigned Dodo'), 'ready');
  assert.equal((await desktop(giftGrant)).status, 403);
  await liftCooldown();
  const newGift = await sendSaved(giftGrant);
  assert.equal(newGift.status, 200);
  assert.equal((await newGift.json()).rewardId, 'wild-dodo');
  assert.equal(commands.at(-1), 'ScriptCommand IcePackSpawn,Dodo,25,12345');
  assert.equal(await authorizeSaved(giftGrant, '8811', 'assigned Dodo'), 'ready');
  assert.equal((await sendSaved(giftGrant)).status, 409);
  assert.equal(await authorizeSaved(giftGrant, '8812', 'old revision'), 'ready');
  await db.query('update public.companion_drafts set draft = $2::jsonb where user_id = $1', [streamer, JSON.stringify(draft)]);
  assert.equal((await sendSaved(giftGrant)).status, 409);
  assert.equal((await saveWhitelist(['rose-stone', 'starter-kit'])).status, 200);
  assert.equal(await authorizeSaved(giftGrant, '8812', 'Dodo restricted'), 'ignored');
  assert.equal((await saveWhitelist(allComponents)).status, 200);
  assert.equal(await authorizeSaved(giftGrant, '8812', 'assigned Kit'), 'ready');
  await liftCooldown();
  const newKit = await sendSaved(giftGrant);
  assert.equal(newKit.status, 200);
  assert.deepEqual(await newKit.json(), { state: 'acknowledged', rewardId: 'starter-kit', acknowledged: 2, total: 2 });
  assert.equal((await ownerDashboard()).history[0].source, 'live_draft');

  const reviewed = JSON.parse(await readFile(new URL('../companion/src/reviewed-catalog.json', import.meta.url), 'utf8'));
  const extra = [
    ['wood-5', '8813', { ...stone, catalogId: 'Wood' }],
    ['thatch-5', '8814', { ...stone, catalogId: 'Thatch' }],
    ['wild-raptor', '8815', { ...dodo, catalogId: 'Raptor' }],
    ['wild-rex', '8816', { ...dodo, catalogId: 'Rex' }],
  ];
  draft.rules.push(...extra.map(([, giftId, action]) => ({ giftId, action, enabled: true })));
  await db.query('update public.companion_drafts set draft = $2::jsonb where user_id = $1', [streamer, JSON.stringify(draft)]);
  await db.exec("update public.icepack_relay_deliveries set created_at = clock_timestamp() - interval '2 hours'");
  assert.equal((await saveWhitelist(['wood-5', 'wild-raptor'])).status, 200);
  assert.equal((await deliver(reward('thatch-5'))).status, 403);
  assert.equal(await authorizeSaved(giftGrant, '8816', 'Rex restricted'), 'ignored');
  assert.equal((await api('owner-token', 'reward-policy', { serverId, policy: 'all_supported', allowedRewardIds: ['wood-5', 'wild-raptor'] })).status, 200);
  const linked = (await api('streamer-token', 'dashboard')).body.linked[0];
  assert.deepEqual(linked.allowedRewardIds, rewardCatalog.map(entry => entry.id));
  for (const [rewardId, giftId, action] of extra) {
    let expected;
    if (action.type === 'item') {
      const item = reviewed.items.find(entry => entry.id === action.catalogId);
      assert.equal(item.verified, true);
      const blueprint = item.blueprint.replace(/_C$/, '');
      expected = `GiveItemToPlayer 12345 "Blueprint'${blueprint}'" 5 0 0`;
    } else {
      expected = `ScriptCommand IcePackSpawn,${action.catalogId},25,12345`;
    }
    assert.equal(await authorizeSaved(giftGrant, giftId, 'expanded catalogue ' + giftId), 'ready');
    const liveResponse = await sendSaved(giftGrant);
    assert.equal(liveResponse.status, 200);
    assert.deepEqual(await liveResponse.json(), { state: 'acknowledged', rewardId, acknowledged: 1, total: 1 });
    assert.equal(commands.at(-1), expected);
    await db.exec("update public.icepack_relay_deliveries set created_at = clock_timestamp() - interval '2 hours'");
    assert.equal((await deliver(reward(rewardId))).status, 200);
    assert.equal(commands.at(-1), expected);
    await db.exec("update public.icepack_relay_deliveries set created_at = clock_timestamp() - interval '2 hours'");
  }

  const wood = extra[0][2];
  const thatch = extra[1][2];
  const raptor = extra[2][2];
  const rex = extra[3][2];
  const bundle = (id, name, actions) => ({ id, name, entries: actions.map(action => ({ action })) });
  const custom = bundle('wipe-supplies', 'Wipe Supplies', [wood, stone, thatch, raptor]);
  const bundleIds = ['wood-5', 'rose-stone', 'thatch-5', 'wild-raptor'];
  const allowedKit = ['custom-kit', ...bundleIds];
  function assignKit(kitId, giftId) {
    draft.rules.push({ giftId, enabled: true, action: { ...kit, kitId } });
  }
  async function saveDraft() {
    const saved = await db.query('update public.companion_drafts set draft = $2::jsonb where user_id = $1 returning revision',
      [streamer, JSON.stringify(draft)]);
    return saved.rows[0].revision;
  }
  draft.kits.push(custom, bundle('two-creatures', 'Two creatures', [raptor, rex]),
    bundle('duplicate-material', 'Duplicate material', [wood, wood]),
    bundle('oversized-stack', 'Oversized stack', [{ ...wood, quantity: 10 }, raptor]),
    bundle('duplicate-id', 'One', [wood, raptor]), bundle('duplicate-id', 'Two', [stone, raptor]),
    bundle('nested', 'Nested', [kit, raptor]));
  assignKit(custom.id, '8817');
  assignKit('two-creatures', '8818');
  assignKit('duplicate-material', '8819');
  assignKit('oversized-stack', '8820');
  assignKit('duplicate-id', '8821');
  assignKit('nested', '8822');
  assignKit(custom.id, '8823');
  assignKit('nested', '8823');
  let revision = await saveDraft();
  const knownKits = async (token = 'streamer-token') => (await api(token, 'dashboard')).body.savedKits;
  const giftIds = async () => (await db.query('select public.get_companion_relay_test_target($1) as status',
    [pairingSecret])).rows[0].status.targets[0].hostedGiftIds;
  const testKit = () => ({ serverId, requestId: crypto.randomUUID(), kitId: custom.id, kitRevision: revision });
  assert.deepEqual(await knownKits(), [{ id: custom.id, name: custom.name, rewardIds: bundleIds, revision }]);
  assert.deepEqual(await knownKits('owner-token'), []);
  assert.deepEqual(await knownKits('outsider-token'), []);
  assert.deepEqual(await giftIds(), ['8811','8812','8813','8814','8815','8816','8817']);
  for (const invalid of ['8818','8819','8820','8821','8822','8823']) {
    assert.equal(await authorizeSaved(giftGrant, invalid, 'invalid Kit ' + invalid), 'ignored');
  }
  assert.equal((await deliver(reward('custom-kit'))).status, 400);
  assert.equal((await deliver({ ...testKit(), kitId: 'bad-kit' })).status, 409);
  assert.equal((await api('outsider-token', 'simulate', testKit())).status, 409);
  assert.equal((await deliver({ ...testKit(), kitRevision: crypto.randomUUID() })).status, 409);
  assert.equal((await saveWhitelist(bundleIds)).status, 200);
  assert.deepEqual(await knownKits(), []);
  assert.equal((await deliver(testKit())).status, 403);
  assert.equal(await authorizeSaved(giftGrant, '8817', 'custom Kits disabled'), 'ignored');
  assert.equal((await saveWhitelist(allowedKit.filter(id => id !== 'wild-raptor'))).status, 200);
  assert.deepEqual(await knownKits(), []);
  assert.equal((await deliver(testKit())).status, 403);
  assert.equal(await authorizeSaved(giftGrant, '8817', 'one component disabled'), 'ignored');
  assert.equal((await saveWhitelist(allowedKit)).status, 200);
  const allowedTest = testKit();
  const completed = { state: 'acknowledged', rewardId: 'custom-kit', acknowledged: 4, total: 4, kitName: custom.name };
  assert.deepEqual(await deliver({ ...allowedTest, kitRewardIds: ['wild-rex'], survivorId: '9' }), { status: 200, body: completed });
  const customCommands = commands.slice(-4);
  assert.deepEqual(customCommands, [
    'GiveItemToPlayer 12345 "Blueprint\'/Game/PrimalEarth/CoreBlueprints/Resources/PrimalItemResource_Wood.PrimalItemResource_Wood\'" 5 0 0',
    commands[0],
    'GiveItemToPlayer 12345 "Blueprint\'/Game/PrimalEarth/CoreBlueprints/Resources/PrimalItemResource_Thatch.PrimalItemResource_Thatch\'" 5 0 0',
    'ScriptCommand IcePackSpawn,Raptor,25,12345',
  ]);
  const testedHistory = (await ownerDashboard()).history[0];
  assert.equal(testedHistory.kitName, custom.name);
  assert.deepEqual(testedHistory.kitRewardIds, bundleIds);
  assert.equal(testedHistory.acknowledgedCommands, 4);
  assert.equal(testedHistory.totalCommands, 4);
  assert.equal(testedHistory.source, 'test');
  assert.equal((await deliver(allowedTest)).status, 409);
  assert.equal((await deliver(testKit())).status, 429);
  await liftCooldown();
  assert.equal(await authorizeSaved(giftGrant, '8817', 'successful live custom Kit'), 'ready');
  const liveKit = await sendSaved(giftGrant);
  assert.equal(liveKit.status, 200);
  assert.deepEqual(await liveKit.json(), completed);
  assert.deepEqual(commands.slice(-4), customCommands);
  assert.equal((await ownerDashboard()).history[0].source, 'live_draft');

  async function stopAfterFirst(send, stop) {
    await liftCooldown();
    const before = commands.length;
    const sentFirst = new Promise(resolve => {
      pauseAfterCommand = () => new Promise(release => { releaseCommand = release; resolve(); });
    });
    const delivering = send();
    await Promise.race([sentFirst, delivering.then(() => assert.fail('Custom Kit did not reach its first step.'))]);
    try { await stop(); } finally { pauseAfterCommand = undefined; releaseCommand(); }
    const response = await delivering;
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { ...completed, state: 'unconfirmed', acknowledged: 1 });
    assert.deepEqual(commands.slice(before), customCommands.slice(0, 1));
    const latest = (await ownerDashboard()).history[0];
    assert.equal(latest.state, 'unconfirmed');
    assert.equal(latest.acknowledgedCommands, 1);
    assert.equal(latest.totalCommands, 4);
  }

  await stopAfterFirst(() => deliver(testKit()), async () => {
    assert.equal((await saveWhitelist(allowedKit.filter(id => id !== 'thatch-5'))).status, 200);
    assert.equal((await saveWhitelist(allowedKit)).status, 200);
  });
  await stopAfterFirst(() => deliver(testKit()), async () => { revision = await saveDraft(); });
  assert.equal(await authorizeSaved(giftGrant, '8817', 'paused live custom Kit'), 'ready');
  await stopAfterFirst(async () => {
    const response = await sendSaved(giftGrant);
    return { status: response.status, body: await response.json() };
  }, async () => {
    assert.equal(await authorizeSaved(giftGrant, '8817', 'replacement grant with same token'), 'ready');
  });
  assert.equal((await sendSaved(giftGrant)).status, 429);
  await stopAfterFirst(() => deliver(testKit()), async () => {
    assert.equal((await api('owner-token', 'revoke', { serverId, streamerId: streamer })).status, 200);
    assert.equal((await api('streamer-token', 'request', { serverId, survivorId: '12345' })).status, 200);
    assert.equal((await api('owner-token', 'approve', { serverId, streamerId: streamer, survivorId: '12345' })).status, 200);
  });
  await assert.rejects(db.transaction(async tx => {
    await tx.exec('set local role authenticated');
    await tx.query("select public.icepack_relay_saved_kit_delivery($1,$2,$3,'reserve',$4,$5)",
      [streamer, serverId, crypto.randomUUID(), custom.id, revision]);
  }), /permission denied/);
});
