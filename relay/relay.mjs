import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { isUuid } from './config.mjs';
import { defaultItemQuantity, maxItemQuantity, rewardsById } from './reward-catalog.mjs';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const requireInput = (condition, message) => {
  if (!condition) throw new HttpError(400, message);
};

function uuid(value, message) {
  requireInput(isUuid(value), message);
  return value.toLowerCase();
}

function survivor(value) {
  requireInput(typeof value === 'string' && /^[1-9][0-9]{0,9}$/.test(value) &&
    Number(value) <= 4294967295, 'Enter a valid numeric Specimen Implant ID.');
  return value;
}

function limit(value) {
  requireInput(Number.isInteger(value) && value >= 1 && value <= 10, 'Choose 1–10 tests per hour.');
  return value;
}

function connectionDetails(input, config) {
  const host = typeof input.host === 'string' ? input.host.trim().toLowerCase() : '';
  requireInput(host === config.host && input.port === config.rconPort,
    'Enter the RCON host and port approved for this pilot.');
  const password = input.password;
  requireInput(typeof password === 'string' && password.length > 0 && Buffer.byteLength(password) <= 128 &&
    !Array.from(password).some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127), 'Enter the RCON password.');
  return { host, port: input.port, password };
}

function seal(details, key, ownerId) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('northpath-rcon-v1:' + ownerId));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(details)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

function unseal(envelope, key, ownerId) {
  const packed = Buffer.from(envelope, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, packed.subarray(0, 12));
  decipher.setAAD(Buffer.from('northpath-rcon-v1:' + ownerId));
  decipher.setAuthTag(packed.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString());
}

async function readBody(request, maxBytes = 4096) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) {
    throw new HttpError(415, 'Use a JSON request.');
  }
  if (Number(request.headers['content-length']) > maxBytes) throw new HttpError(413, 'Request is too large.');
  let size = 0;
  const chunks = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBytes) {
      request.resume();
      throw new HttpError(413, 'Request is too large.');
    }
    chunks.push(chunk);
  }
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (input && typeof input === 'object' && !Array.isArray(input)) return input;
  } catch {}
  throw new HttpError(400, 'Invalid JSON request.');
}

const hostedDinosaurs = new Map([['wild-dodo', 'Dodo'], ['wild-raptor', 'Raptor'], ['wild-rex', 'Rex']]);
const validItemQuantity = quantity => Number.isInteger(quantity) && quantity >= 1 && quantity <= maxItemQuantity;

function rewardCommands(reward, playerId, quantities) {
  if (reward === 'starter-kit') return ['rose-stone', 'wild-dodo'].flatMap(id => rewardCommands(id, playerId, quantities));
  const item = rewardsById.get(reward)?.item;
  if (item) {
    const quantity = quantities[reward] ?? defaultItemQuantity;
    if (!validItemQuantity(quantity)) throw Error('Invalid hosted item quantity.');
    return [`GiveItemToPlayer ${playerId} "Blueprint'${item.blueprint}'" ${quantity} 0 0`];
  }
  const dinosaur = hostedDinosaurs.get(reward);
  // The same supported wild-spawn command used by the Windows engine.
  if (dinosaur) return [`ScriptCommand IcePackSpawn,${dinosaur},25,${playerId}`];
  throw Error('Unsupported hosted reward.');
}

export function createRelay({ config, store, connect }) {
  async function rpc(name, params) {
    const result = await store.rpc(name, params);
    if (result?.error) throw new HttpError(result.status, result.error);
    return result;
  }

  function openRcon(details) {
    return connect({ address: config.address, port: config.rconPort, password: details.password });
  }

  async function register(actor, input) {
    if (actor !== config.ownerId) throw new HttpError(403, 'Registration is limited to the pilot owner.');
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    requireInput(name.length >= 2 && name.length <= 60, 'Enter a server name between 2 and 60 characters.');
    requireInput(typeof input.listed === 'boolean', 'Choose a server visibility.');
    const hourlyLimit = limit(input.hourlyLimit);
    const details = connectionDetails(input, config);
    let connection;
    try { connection = await openRcon(details); }
    catch { throw new HttpError(502, 'Could not authenticate with the test server. Check the RCON password and hosting settings.'); }
    connection.close();
    return rpc('register', {
      p_actor: actor, p_name: name, p_listed: input.listed, p_limit: hourlyLimit,
      p_envelope: seal(details, config.key, actor),
    });
  }

  async function manage(actor, input, action) {
    const server = uuid(input.serverId, 'Enter a valid server ID.');
    const streamer = ['approve', 'revoke'].includes(action) ? uuid(input.streamerId, 'Select a streamer.') : null;
    let value = null;
    if (['request', 'approve'].includes(action)) value = survivor(input.survivorId);
    if (action === 'limit') value = String(limit(input.hourlyLimit));
    return rpc('manage', { p_actor: actor, p_server: server, p_action: action, p_streamer: streamer, p_value: value });
  }

  async function simulate(authorize, rewardId) {
    const { envelope, actor, server, request, rewardId: savedReward, kitRewardIds, kitName, itemQuantities = {} } = await authorize('reserve');
    rewardId ??= savedReward;
    let connection;
    let state = 'cancelled';
    let acknowledged = 0;
    try {
      try {
        const details = connectionDetails(unseal(envelope, config.key, config.ownerId), config);
        connection = await openRcon(details);
      } catch { throw new HttpError(502, 'The relay could not connect to ARK. Check the server with its owner.'); }
      const approved = await authorize('dispatch', request);
      state = 'unconfirmed';
      const playerId = survivor(approved.survivorId);
      const steps = rewardId === 'custom-kit' ? kitRewardIds : [rewardId ?? 'rose-stone'];
      const commands = steps.flatMap(id => rewardCommands(id, playerId, itemQuantities));
      try {
        for (const command of commands) {
          if (acknowledged > 0 && (await authorize('continue', request)).survivorId !== playerId) break;
          await connection.send(command);
          acknowledged++;
        }
        if (acknowledged === commands.length) state = 'acknowledged';
      } catch {
        // A dropped RCON reply can follow a successful send. Treat it as unknown.
      }
      return rewardId
        ? { state, rewardId, acknowledged, total: commands.length, ...(kitName ? { kitName } : {}),
          ...(Object.keys(itemQuantities).length ? { itemQuantities } : {}) }
        : { state };
    } finally {
      connection?.close();
      const outcome = { p_actor: actor, p_server: server, p_request: request, p_state: state };
      try {
        if (rewardId) await rpc('finish_catalog', { ...outcome, p_reward: rewardId, p_acknowledged: acknowledged });
        else await rpc('finish', outcome);
      }
      catch { console.error('Relay could not finalize a delivery record.'); }
    }
  }

  function simulateWebsite(actor, input) {
    const server = uuid(input.serverId, 'Select an approved server.');
    const request = uuid(input.requestId, 'Invalid test request ID.');
    if (input.kitId !== undefined) {
      const kitId = input.kitId;
      requireInput(input.rewardId === undefined && input.quantity === undefined &&
        typeof kitId === 'string' && kitId.length > 0 && Array.from(kitId).length <= 120,
        'Choose a saved custom Kit.');
      const revision = uuid(input.kitRevision, 'Refresh server access and choose a saved Kit.');
      return simulate(async phase => ({
        ...await rpc('saved_kit_delivery', {
          p_actor: actor, p_server: server, p_request: request, p_phase: phase, p_kit_id: kitId, p_revision: revision,
          p_supports_quantities: true,
        }),
        actor, server, request,
      }), 'custom-kit');
    }
    if (input.rewardId !== undefined) {
      const reward = input.rewardId;
      requireInput(reward !== 'custom-kit' && rewardsById.has(reward), 'Choose a supported hosted reward.');
      requireInput(input.quantity === undefined || (rewardsById.get(reward)?.item && validItemQuantity(input.quantity)),
        'Choose an item quantity between 1 and ' + maxItemQuantity + '.');
      return simulate(async phase => ({
        ...await rpc('catalog_delivery', {
          p_actor: actor, p_server: server, p_request: request, p_phase: phase, p_reward: reward, p_quantity: input.quantity ?? null,
        }),
        actor, server, request,
      }), reward);
    }
    return simulate(async phase => ({
      ...await rpc('delivery', { p_actor: actor, p_server: server, p_request: request, p_phase: phase }),
      actor, server, request,
    }));
  }

  function simulateDesktop(req, route) {
    const secret = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1];
    if (req.headers.origin || !secret) {
      throw new HttpError(401, 'Arm a hosted test in Windows Companion.');
    }
    const hash = createHash('sha256').update(secret).digest('hex');
    const params = { p_token_hash: hash, p_owner: config.ownerId };
    if (route === '/v1/live-reward') return simulate((phase, request) =>
      rpc('hosted_gift_delivery', { ...params, p_phase: phase, p_request: request ?? null, p_supports_quantities: true }));
    if (route === '/v1/live-rose') return simulate(phase => rpc('paired_delivery', { ...params, p_phase: phase, p_source: 'live_rose' }));
    return simulate(phase => rpc('desktop_delivery', { ...params, p_phase: phase }));
  }

  return createServer({ requestTimeout: 15000, headersTimeout: 5000 }, async (request, response) => {
    const send = (status, result) => response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    }).end(JSON.stringify(result));
    try {
      if (request.method === 'GET' && request.url === '/health') return send(200, { ok: true });
      if (request.method === 'POST' && ['/v1/desktop-test', '/v1/live-rose', '/v1/live-reward'].includes(request.url)) {
        await readBody(request);
        return send(200, await simulateDesktop(request, request.url));
      }
      if (request.headers.origin && request.headers.origin !== config.origin) {
        throw new HttpError(403, 'This website is outside the relay allowlist.');
      }
      if (request.headers.origin === config.origin) {
        response.setHeader('Access-Control-Allow-Origin', config.origin);
        response.setHeader('Vary', 'Origin');
      }
      if (request.url !== '/v1/pilot') throw new HttpError(404, 'Unknown relay route.');
      if (request.method === 'OPTIONS') return response.writeHead(204, {
        'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Max-Age': '600',
      }).end();
      if (request.method !== 'POST') throw new HttpError(405, 'Use POST for relay actions.');
      const authorization = /^Bearer ([A-Za-z0-9._-]{1,4096})$/i.exec(request.headers.authorization ?? '');
      if (!authorization) throw new HttpError(401, 'Sign in to Northpath first.');
      const identity = await store.authenticate(authorization[1]);
      if (!isUuid(identity)) throw new HttpError(401, 'Sign in to Northpath first.');
      const actor = identity.toLowerCase();
      const input = await readBody(request, 128 * 1024);
      let result;
      switch (input.action) {
        case 'dashboard': {
          const search = typeof input.search === 'string' ? input.search.trim().slice(0, 60) : '';
          result = { ...await rpc('dashboard', { p_actor: actor, p_search: search }), canRegister: actor === config.ownerId };
          break;
        }
        case 'register': result = await register(actor, input); break;
        case 'reward-policy': {
          const server = uuid(input.serverId, 'Select a server.');
          requireInput(['all_supported', 'whitelist'].includes(input.policy), 'Select a supported reward policy.');
          if (input.allowedRewardIds !== undefined) {
            const ids = input.allowedRewardIds;
            requireInput(Array.isArray(ids) && ids.length <= rewardsById.size && ids.every(id => rewardsById.has(id)) &&
              new Set(ids).size === ids.length, 'Choose a valid hosted reward whitelist.');
            const limits = input.maxItemQuantities;
            requireInput(limits === undefined || (limits && typeof limits === 'object' && !Array.isArray(limits) &&
              Object.entries(limits).every(([id, quantity]) => rewardsById.get(id)?.item && validItemQuantity(quantity))),
              'Set valid item quantity limits.');
            result = await rpc('catalog_policy', {
              p_actor: actor, p_server: server, p_policy: input.policy, p_rewards: ids, p_limits: limits ?? null,
            });
            break;
          }
          requireInput(input.maxItemQuantities === undefined && typeof input.roseWhitelisted === 'boolean', 'Select a supported reward policy.');
          result = await rpc('live_rose_policy', {
            p_actor: actor, p_server: server, p_policy: input.policy, p_enabled: input.roseWhitelisted,
          });
          break;
        }
        case 'request': case 'approve': case 'revoke': case 'limit':
          result = await manage(actor, input, input.action);
          break;
        case 'simulate': result = await simulateWebsite(actor, input); break;
        default: throw new HttpError(400, 'Unknown relay action.');
      }
      return send(200, result);
    } catch (error) {
      if (error instanceof HttpError) return send(error.status, { error: error.message });
      console.error('Relay request failed.');
      return send(503, { error: 'The relay is temporarily unavailable.' });
    }
  });
}
