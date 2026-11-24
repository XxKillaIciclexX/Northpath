import { isIPv4 } from 'node:net';

export function httpOrigin(value, allowLoopback = false) {
  const url = new URL(value);
  const loopback = allowLoopback && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (url.href !== url.origin + '/' || (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:'))) {
    throw Error('Expected an HTTPS origin or a local HTTP origin.');
  }
  return url.origin;
}

function isPublicIPv4(value) {
  if (!isIPv4(value)) return false;
  const [a, b, c] = value.split('.').map(Number);
  return a > 0 && a < 224 && ![10, 127].includes(a) &&
    !(a === 100 && b >= 64 && b <= 127) && !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) && !(a === 192 && [0, 168].includes(b)) &&
    !(a === 198 && ([18, 19].includes(b) || (b === 51 && c === 100))) &&
    !(a === 203 && b === 0 && c === 113);
}

export const isUuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);

export function readConfig(env) {
  const ownerId = env.ICEPACK_RELAY_OWNER_ID?.trim().toLowerCase();
  const host = env.ICEPACK_RELAY_TARGET_HOST?.trim().toLowerCase();
  const address = env.ICEPACK_RELAY_TARGET_IPV4?.trim();
  const rconPort = Number(env.ICEPACK_RELAY_TARGET_PORT);
  const vaultKey = env.ICEPACK_RELAY_VAULT_KEY ?? '';
  const port = Number(env.PORT ?? 8787);
  if (!isUuid(ownerId)) throw Error('Set ICEPACK_RELAY_OWNER_ID to the test owner account UUID.');
  if (!host || !/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(host) || !isPublicIPv4(address) ||
      !Number.isInteger(rconPort) || rconPort < 1 || rconPort > 65535) {
    throw Error('Set the verified test server host, public IPv4 address, and RCON port.');
  }
  if (!/^[a-f0-9]{64}$/i.test(vaultKey)) throw Error('Set ICEPACK_RELAY_VAULT_KEY to a random 32-byte hexadecimal key.');
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw Error('Set SUPABASE_SERVICE_ROLE_KEY on the relay.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid PORT.');

  return {
    ownerId, host, address, rconPort, port, key: Buffer.from(vaultKey, 'hex'),
    origin: httpOrigin(env.ICEPACK_RELAY_SITE_ORIGIN, true),
    supabaseOrigin: httpOrigin(env.SUPABASE_URL, true),
    supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY,
  };
}
