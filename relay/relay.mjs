import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { isUuid } from './config.mjs';
import rewardCatalog from './reward-catalog.json' with { type: 'json' };

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

async function readBody(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers['content-type'] ?? '')) {
    throw new HttpError(415, 'Use a JSON request.');
  }
  if (Number(request.headers['content-length']) > 4096) throw new HttpError(413, 'Request is too large.');
  let size = 0;
  const chunks = [];
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 4096) {
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

const stone = "Blueprint'/Game/PrimalEarth/CoreBlueprints/Resources/PrimalItemResource_Stone.PrimalItemResource_Stone'";
const rewardIds = new Set(rewardCatalog.map(reward => reward.id));

function rewardCommands(reward, playerId) {
  const stoneCommand = 'GiveItemToPlayer ' + playerId + ' "' + stone + '" 5 0 0';
  // Uses the same fixed v0.3 ASA mod command as the Windows engine.
  const dodoCommand = 'ScriptCommand IcePackSpawn,Dodo,25,' + playerId;
  switch (reward) {
    case 'rose-stone': return [stoneCommand];
    case 'wild-dodo': return [dodoCommand];
    case 'starter-kit': return [stoneCommand, dodoCommand];
    default: throw Error('Unsupported hosted reward.');
  }
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
    const { envelope, actor, server, request, rewardId: savedReward } = await authorize('reserve');
    rewardId ??= savedReward;
    let connection;
    let state = 'cancelled';
    let acknowledged = 0;
    try {
      try {
        const details = connectionDetails(unseal(envelope, config.key, config.ownerId), config);
        connection = await openRcon(details);
      } catch { throw new HttpError(502, 'The relay could not connect to ARK. Check the server with its owner.'); }
      const approved = await authorize('dispatch');
      const playerId = survivor(approved.survivorId);
      const commands = rewardCommands(rewardId ?? 'rose-stone', playerId);
      state = 'unconfirmed';
      try {
        for (const command of commands) {
          if (acknowledged > 0 && (await authorize('continue')).survivorId !== playerId) break;
          await connection.send(command);
          acknowledged++;
        }
        if (acknowledged === commands.length) state = 'acknowledged';
      } catch {
        // A dropped RCON reply can follow a successful send. Treat it as unknown.
      }
      return rewardId ? { state, rewardId, acknowledged, total: commands.length } : { state };
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
    if (input.rewardId !== undefined) {
      const reward = input.rewardId;
      requireInput(rewardIds.has(reward), 'Choose a supported hosted reward.');
      return simulate(async phase => ({
        ...await rpc('catalog_delivery', { p_actor: actor, p_server: server, p_request: request, p_phase: phase, p_reward: reward }),
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
    if (route === '/v1/live-reward') return simulate(phase => rpc('draft_delivery', { ...params, p_phase: phase }));
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
      const input = await readBody(request);
      const identity = await store.authenticate(authorization[1]);
      if (!isUuid(identity)) throw new HttpError(401, 'Sign in to Northpath first.');
      const actor = identity.toLowerCase();
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
            requireInput(Array.isArray(ids) && ids.length <= rewardIds.size && ids.every(id => rewardIds.has(id)) &&
              new Set(ids).size === ids.length, 'Choose a valid hosted reward whitelist.');
            result = await rpc('catalog_policy', { p_actor: actor, p_server: server, p_policy: input.policy, p_rewards: ids });
            break;
          }
          requireInput(typeof input.roseWhitelisted === 'boolean', 'Select a supported reward policy.');
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
