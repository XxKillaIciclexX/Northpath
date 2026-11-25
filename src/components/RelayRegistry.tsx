import { useEffect, useState, type FormEvent } from 'react';

type AccessState = 'requested' | 'approved' | 'revoked';
type RewardPolicy = 'whitelist' | 'all_supported';
type DeliveryState = 'pending' | 'sending' | 'cancelled' | 'unconfirmed' | 'acknowledged';
type Server = { id: string; name: string };
type OwnerServer = Server & {
  listed: boolean;
  hourlyLimit: number;
  rewardPolicy?: RewardPolicy;
  roseWhitelisted?: boolean;
  access: { streamerId: string; survivorId: string; state: AccessState; email: string }[];
  history: { requestId: string; createdAt: string; state: DeliveryState; streamer: string; source?: 'test' | 'live_rose' }[];
};
type Dashboard = {
  canRegister: boolean;
  owned: OwnerServer | null;
  linked: (Server & { state: AccessState; survivorId: string; roseAllowed?: boolean })[];
  results: Server[];
};
type Props = { token: string; relayUrl: string };

const deliveryLabels: Record<DeliveryState, string> = {
  pending: 'Preparing', sending: 'Sending', cancelled: 'Cancelled',
  unconfirmed: 'Delivery unconfirmed', acknowledged: 'ARK acknowledged',
};
const field = 'mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100';
const card = 'card space-y-4 p-5';
const roseRewardId = 'rose-stone';

function parseOwnerWhitelist(raw: string): boolean {
  const config = JSON.parse(raw);
  if (!config || config.version !== 1 || !Array.isArray(config.allowedRewardIds) ||
      Object.keys(config).some(key => key !== 'version' && key !== 'allowedRewardIds')) {
    throw new Error('Choose a version 1 Northpath owner whitelist.');
  }
  if (config.allowedRewardIds.some((id: unknown) => id !== roseRewardId)) {
    throw new Error('This whitelist includes a reward the relay does not support yet.');
  }
  if (config.allowedRewardIds.length > 1) throw new Error('Remove duplicate reward IDs from the whitelist.');
  return config.allowedRewardIds.includes(roseRewardId);
}

function exportOwnerWhitelist(roseWhitelisted: boolean) {
  const json = JSON.stringify({ version: 1, allowedRewardIds: roseWhitelisted ? [roseRewardId] : [] }, null, 2) + '\n';
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'northpath-owner-whitelist.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function OwnerRewardPolicy({ initialPolicy, initialRose, busy, save }: {
  initialPolicy: RewardPolicy;
  initialRose: boolean;
  busy: boolean;
  save: (policy: RewardPolicy, roseWhitelisted: boolean) => void;
}) {
  const [policy, setPolicy] = useState(initialPolicy);
  const [roseWhitelisted, setRoseWhitelisted] = useState(initialRose);
  const [fileStatus, setFileStatus] = useState<{ text: string; error?: boolean }>();

  async function importWhitelist(file: File) {
    try {
      if (file.size > 16_384) throw new Error('The whitelist file is too large.');
      const allowed = parseOwnerWhitelist(await file.text());
      setRoseWhitelisted(allowed);
      setPolicy('whitelist');
      setFileStatus({ text: 'Whitelist loaded. Review it and save the reward policy to activate it.' });
    } catch (error) {
      setFileStatus({ text: error instanceof SyntaxError ? 'The whitelist file contains invalid JSON.'
        : error instanceof Error ? error.message : 'Could not open the whitelist file.', error: true });
    }
  }
  return <form className="space-y-3" onSubmit={event => {
    event.preventDefault();
    save(policy, roseWhitelisted);
  }}>
    <label className="block max-w-sm font-semibold text-white">Reward policy
      <select className={field} value={policy} onChange={event => setPolicy(event.target.value as RewardPolicy)}>
        <option value="all_supported">All supported rewards</option>
        <option value="whitelist">Owner whitelist</option>
      </select>
    </label>
    {policy === 'whitelist' ? <label className="flex items-center gap-2">
      <input type="checkbox" checked={roseWhitelisted} onChange={event => setRoseWhitelisted(event.target.checked)} />
      Allow Rose → 5 Stone
    </label> : <p className="text-sm text-slate-300">The current catalog supports Rose → 5 Stone.</p>}
    <div className="flex flex-wrap items-center gap-2">
      <button type="submit" className="btn btn-primary" disabled={busy || (policy === initialPolicy && roseWhitelisted === initialRose)}>Save reward policy</button>
      <label className={'btn btn-ghost relative cursor-pointer' + (busy ? ' opacity-60' : '')}>
        Import whitelist
        <input type="file" className="absolute inset-0 h-full w-full cursor-pointer opacity-0" accept=".json,application/json" disabled={busy} onChange={event => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = '';
          if (file) void importWhitelist(file);
        }} />
      </label>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => exportOwnerWhitelist(initialRose)}>Export saved whitelist</button>
    </div>
    {fileStatus && <p role={fileStatus.error ? 'alert' : 'status'} className={fileStatus.error ? 'text-rose-300' : 'text-sm text-slate-300'}>{fileStatus.text}</p>}
  </form>;
}

async function relay<T>({ token, relayUrl }: Props, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const timeout = AbortSignal.timeout(30000);
  const response = await fetch(new URL('/v1/pilot', relayUrl), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    redirect: 'error',
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'The relay request failed.');
  return result as T;
}

export default function RelayRegistry({ token, relayUrl }: Props) {
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [search, setSearch] = useState('');
  const [searched, setSearched] = useState('');
  const [serverId, setServerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; error?: boolean }>({ text: 'Loading the server registry…' });

  useEffect(() => {
    const controller = new AbortController();
    relay<Dashboard>({ token, relayUrl }, { action: 'dashboard', search: '' }, controller.signal)
      .then(result => {
        if (controller.signal.aborted) return;
        setDashboard(result);
        setStatus({ text: '' });
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus({ text: 'Could not load the server registry.', error: true });
      });
    return () => controller.abort();
  }, [token, relayUrl]);

  async function run(payload: Record<string, unknown>, success = '', query = searched) {
    if (busy) return;
    setBusy(true);
    setStatus({ text: payload.action === 'simulate' ? 'Sending the test reward…' : 'Updating server registry…' });
    const credentials = { token, relayUrl };
    let message = success;
    try {
      if (payload.action !== 'dashboard') {
        const result = await relay<{ state?: DeliveryState }>(credentials, payload);
        if (payload.action === 'simulate') {
          message = result.state === 'acknowledged'
            ? 'ARK acknowledged the test. Check your inventory for 5 Stone.'
            : 'Delivery is unconfirmed. Check your inventory and the owner’s history before sending again.';
        }
      }
      setDashboard(await relay<Dashboard>(credentials, { action: 'dashboard', search: query }));
      setSearched(query);
      setStatus({ text: message });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : 'The relay request failed.', error: true });
    } finally {
      setBusy(false);
    }
  }

  function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = event.currentTarget.elements.namedItem('password') as HTMLInputElement;
    password.value = '';
    void run({
      action: 'register', name: values.get('name'), host: values.get('host'), port: Number(values.get('port')),
      password: values.get('password'), listed: values.has('listed'), hourlyLimit: Number(values.get('hourlyLimit')),
    }, 'Connected to ARK and registered the server.');
  }

  function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void run({ action: 'request', serverId: serverId.trim(), survivorId: String(values.get('survivorId')).trim() },
      'Access request sent to the server owner.');
  }

  const owned = dashboard?.owned;
  return <section className="mt-6 max-w-3xl space-y-4" aria-labelledby="relay-title">
    <h2 id="relay-title" className="text-xl font-semibold text-white">ARK server registry</h2>
    <p className="text-sm text-slate-300">Find an approved server and test one Rose reward through the Northpath relay.</p>
    {status.text && <p role={status.error ? 'alert' : 'status'} className={status.error ? 'text-rose-300' : 'text-slate-200'}>
      {status.text}
    </p>}
    {!dashboard && status.error && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void run({ action: 'dashboard' })}>
      Try again
    </button>}
    {dashboard?.canRegister && !owned && <form className={card} onSubmit={register} autoComplete="off">
      <h3 className="font-semibold text-white">Register an ARK server</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>Server name<input className={field} name="name" autoComplete="off" minLength={2} maxLength={60} required /></label>
        <label>RCON host<input className={field} name="host" autoComplete="off" maxLength={253} required /></label>
        <label>RCON port<input className={field} name="port" type="number" min={1} max={65535} required /></label>
        <label>RCON password<input className={field} name="password" type="password" autoComplete="new-password" maxLength={128} required /></label>
        <label>Rewards per hour<input className={field} name="hourlyLimit" type="number" min={1} max={10} defaultValue={1} required /></label>
      </div>
      <label className="flex items-center gap-2"><input name="listed" type="checkbox" /> Show this server in search</label>
      <button type="submit" className="btn btn-primary" disabled={busy}>Test connection and register</button>
    </form>}
    {owned && <section className={card}>
      <div>
        <h3 className="font-semibold text-white">{owned.name}</h3>
        <p className="mt-1 text-sm text-slate-300">{owned.listed ? 'Listed in search.' : 'Unlisted. Share the server ID to let a streamer request access.'}</p>
        <p className="mt-1 break-all text-sm text-slate-300">Server ID <code className="text-slate-100">{owned.id}</code></p>
      </div>
      <form key={owned.hourlyLimit} className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        const hourlyLimit = Number(new FormData(event.currentTarget).get('hourlyLimit'));
        void run({ action: 'limit', serverId: owned.id, hourlyLimit }, 'Saved the hourly limit.');
      }}>
        <label>Rewards per hour<input className={field} name="hourlyLimit" type="number" min={1} max={10} defaultValue={owned.hourlyLimit} required /></label>
        <button type="submit" disabled={busy} className="btn btn-ghost">Save limit</button>
      </form>
      {owned.rewardPolicy && <OwnerRewardPolicy key={owned.id + owned.rewardPolicy + String(owned.roseWhitelisted)}
        initialPolicy={owned.rewardPolicy} initialRose={owned.roseWhitelisted === true} busy={busy}
        save={(policy, roseWhitelisted) => void run({ action: 'reward-policy', serverId: owned.id, policy, roseWhitelisted }, 'Saved the reward policy.')} />}
      <div>
        <h4 className="font-semibold text-white">Streamer access</h4>
        {owned.access.length === 0 && <p className="mt-2 text-sm text-slate-300">No access requests yet.</p>}
        <ul className="divide-y divide-slate-700">
          {owned.access.map(entry => <li key={entry.streamerId} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div className="min-w-0 break-words text-sm">
              <p>{entry.email ?? 'Streamer account'}</p>
              <p className="text-slate-300">Survivor {entry.survivorId} · {entry.state}</p>
            </div>
            {entry.state === 'requested' && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => {
              if (window.confirm('Approve this streamer after verifying that the listed Survivor ID belongs to them?')) {
                void run({ action: 'approve', serverId: owned.id, streamerId: entry.streamerId, survivorId: entry.survivorId }, 'Streamer access approved.');
              }
            }}>Approve</button>}
            {entry.state === 'approved' && <button type="button" className="btn btn-ghost" disabled={busy} onClick={() =>
              void run({ action: 'revoke', serverId: owned.id, streamerId: entry.streamerId }, 'Streamer access revoked.')}>Revoke</button>}
          </li>)}
        </ul>
      </div>
      <div>
        <h4 className="font-semibold text-white">Delivery history</h4>
        {owned.history.length === 0 && <p className="mt-2 text-sm text-slate-300">No relay tests yet.</p>}
        <ul className="divide-y divide-slate-700">
          {owned.history.map(entry => <li key={entry.requestId + entry.streamer} className="py-2 text-sm text-slate-300">
            <span className="text-white">Rose → 5 Stone</span> · {entry.source === 'live_rose' ? 'Live gift' : 'Test'} · {deliveryLabels[entry.state]} · {entry.streamer} · <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
          </li>)}
        </ul>
        <button type="button" className="btn btn-ghost mt-2" disabled={busy} onClick={() => void run({ action: 'dashboard' })}>Refresh status</button>
      </div>
    </section>}
    {dashboard && !dashboard.canRegister && <section className={card}>
      <h3 className="font-semibold text-white">Find a server</h3>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
        event.preventDefault();
        const query = search.trim();
        void run({ action: 'dashboard', search: query }, '', query);
      }}>
        <label>Server name<input className={field} value={search} onChange={event => setSearch(event.target.value)} required minLength={2} maxLength={60} /></label>
        <button type="submit" disabled={busy} className="btn btn-ghost">Search</button>
      </form>
      {searched && dashboard.results.length === 0 && <p className="text-sm text-slate-300">No listed servers match your search.</p>}
      <ul className="divide-y divide-slate-700">
        {dashboard.results.map(server => <li key={server.id} className="flex items-center justify-between gap-2 py-2">
          <span>{server.name}</span>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setServerId(server.id)}>Select</button>
        </li>)}
      </ul>
      <form className="space-y-3" onSubmit={requestAccess}>
        <label className="block">Server ID<input className={field} value={serverId} onChange={event => setServerId(event.target.value)} required maxLength={36} /></label>
        <label className="block">Specimen Implant ID<input className={field} name="survivorId" inputMode="numeric" pattern="[1-9][0-9]{0,9}" required /></label>
        <p className="text-sm text-slate-300">The server owner sees your account email and Survivor ID when reviewing your request.</p>
        <button type="submit" className="btn btn-primary" disabled={busy}>Request access</button>
      </form>
    </section>}
    {dashboard && dashboard.linked.length > 0 && <section className={card}>
      <h3 className="font-semibold text-white">Your server access</h3>
      <ul className="divide-y divide-slate-700">
        {dashboard.linked.map(server => <li key={server.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
          <div><p>{server.name}</p><p className="text-sm text-slate-300">Survivor {server.survivorId} · {server.state}</p></div>
          {server.state === 'approved' && server.roseAllowed === false && <p className="text-sm text-slate-300">Rose is outside the owner’s whitelist.</p>}
          {server.state === 'approved' && server.roseAllowed !== false && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => {
            if (window.confirm('Send 5 Stone to your linked survivor on ' + server.name + '?')) {
              void run({ action: 'simulate', serverId: server.id, requestId: crypto.randomUUID() });
            }
          }}>Send Rose test</button>}
        </li>)}
      </ul>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void run({ action: 'dashboard' })}>Refresh access</button>
    </section>}
  </section>;
}
