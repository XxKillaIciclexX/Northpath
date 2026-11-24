export function createStore(config) {
  const headers = { apikey: config.supabaseKey, 'Content-Type': 'application/json' };
  return {
    async authenticate(token) {
      const response = await fetch(config.supabaseOrigin + '/auth/v1/user', {
        headers: { ...headers, Authorization: 'Bearer ' + token },
        signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok) throw Error('Authentication backend unavailable.');
      return (await response.json()).id;
    },
    async rpc(name, parameters) {
      const response = await fetch(config.supabaseOrigin + '/rest/v1/rpc/icepack_relay_' + name, {
        method: 'POST',
        headers: { ...headers, Authorization: 'Bearer ' + config.supabaseKey },
        body: JSON.stringify(parameters), signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      if (!response.ok) throw Error('Registry backend unavailable.');
      return response.status === 204 ? null : response.json();
    },
  };
}
