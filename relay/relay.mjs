import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { isUuid } from './config.mjs';

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

  async function simulate(authorize) {
    const { envelope, actor, server, request } = await authorize('reserve');
    let connection;
    let state = 'cancelled';
    try {
      try {
        const details = connectionDetails(unseal(envelope, config.key, config.ownerId), config);
        connection = await openRcon(details);
      } catch { throw new HttpError(502, 'The relay could not connect to ARK. Check the server with its owner.'); }
      const approved = await authorize('dispatch');
      state = 'unconfirmed';
      try {
        await connection.send('GiveItemToPlayer ' + survivor(approved.survivorId) + ' "' + stone + '" 5 0 0');
        state = 'acknowledged';
      } catch {
        // A dropped RCON reply can follow a successful send. Treat it as unknown.
      }
      return { state };
    } finally {
      connection?.close();
      try { await rpc('finish', { p_actor: actor, p_server: server, p_request: request, p_state: state }); }
      catch { console.error('Relay could not finalize a delivery record.'); }
    }
  }

  function simulateWebsite(actor, input) {
    const server = uuid(input.serverId, 'Select an approved server.');
    const request = uuid(input.requestId, 'Invalid test request ID.');
    return simulate(async phase => ({
      ...await rpc('delivery', { p_actor: actor, p_server: server, p_request: request, p_phase: phase }),
      actor, server, request,
    }));
  }

  function simulateDesktop(req) {
    const secret = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1];
    if (req.headers.origin || !secret) {
      throw new HttpError(401, 'Arm a hosted test in Windows Companion.');
    }
    const hash = createHash('sha256').update(secret).digest('hex');
    return simulate(phase => rpc('desktop_delivery', { p_token_hash: hash, p_owner: config.ownerId, p_phase: phase }));
  }

  return createServer({ requestTimeout: 15000, headersTimeout: 5000 }, async (request, response) => {
    const send = (status, result) => response.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    }).end(JSON.stringify(result));
    try {
      if (request.method === 'GET' && request.url === '/health') return send(200, { ok: true });
      if (request.method === 'POST' && request.url === '/v1/desktop-test') {
        await readBody(request);
        return send(200, await simulateDesktop(request));
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
