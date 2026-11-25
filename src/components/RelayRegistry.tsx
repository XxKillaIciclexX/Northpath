import { useEffect, useRef, useState, type FormEvent } from 'react';
import rewardCatalog from '../../relay/reward-catalog.json';

type AccessState = 'requested' | 'approved' | 'revoked';
type RewardPolicy = 'whitelist' | 'all_supported';
type DeliveryState = 'pending' | 'sending' | 'cancelled' | 'unconfirmed' | 'acknowledged';
type Server = { id: string; name: string };
type LinkedServer = Server & { state: AccessState; survivorId: string; roseAllowed?: boolean; allowedRewardIds?: string[] };
type OwnerServer = Server & {
  listed: boolean;
  hourlyLimit: number;
  rewardPolicy?: RewardPolicy;
  roseWhitelisted?: boolean;
  allowedRewardIds?: string[];
  access: { streamerId: string; survivorId: string; state: AccessState; email: string }[];
  history: { requestId: string; createdAt: string; state: DeliveryState; streamer: string; source?: 'test' | 'live_rose' | 'live_draft';
    rewardId?: string; acknowledgedCommands?: number }[];
};
type Dashboard = {
  canRegister: boolean;
  owned: OwnerServer | null;
  linked: LinkedServer[];
  results: Server[];
};
type Props = { token: string; relayUrl: string };

const deliveryLabels: Record<DeliveryState, string> = {
  pending: 'Preparing', sending: 'Sending', cancelled: 'Cancelled',
  unconfirmed: 'Delivery unconfirmed', acknowledged: 'ARK acknowledged',
};
const field = 'field mt-1 block';
const card = 'card space-y-4 p-5';
const roseRewardId = 'rose-stone';
const rewardLabel = (id = roseRewardId) => rewardCatalog.find(reward => reward.id === id)?.label ?? 'Hosted reward';
const orderRewards = (ids: string[]) => rewardCatalog.filter(reward => ids.includes(reward.id)).map(reward => reward.id);

function parseOwnerWhitelist(raw: string, available: typeof rewardCatalog): string[] {
  const config = JSON.parse(raw);
  if (!config || config.version !== 1 || !Array.isArray(config.allowedRewardIds) ||
      Object.keys(config).some(key => key !== 'version' && key !== 'allowedRewardIds')) {
    throw new Error('Choose a version 1 Northpath owner whitelist.');
  }
  if (config.allowedRewardIds.some((id: unknown) => !available.some(reward => reward.id === id))) {
    throw new Error('This whitelist includes a reward the relay does not support yet.');
  }
  if (new Set(config.allowedRewardIds).size !== config.allowedRewardIds.length) throw new Error('Remove duplicate reward IDs from the whitelist.');
  return orderRewards(config.allowedRewardIds);
}

function exportOwnerWhitelist(allowedRewardIds: string[]) {
  const json = JSON.stringify({ version: 1, allowedRewardIds }, null, 2) + '\n';
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'northpath-owner-whitelist.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function OwnerRewardPolicy({ initialPolicy, initialIds, catalogEnabled, busy, save }: {
  initialPolicy: RewardPolicy;
  initialIds: string[];
  catalogEnabled: boolean;
  busy: boolean;
  save: (policy: RewardPolicy, allowedRewardIds: string[]) => void;
}) {
  const [policy, setPolicy] = useState(initialPolicy);
  const [allowedRewardIds, setAllowedRewardIds] = useState(initialIds);
  const [fileStatus, setFileStatus] = useState<{ text: string; error?: boolean }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const available = catalogEnabled ? rewardCatalog : rewardCatalog.slice(0, 1);

  async function importWhitelist(file: File) {
    try {
      if (file.size > 16_384) throw new Error('The whitelist file is too large.');
      const allowed = parseOwnerWhitelist(await file.text(), available);
      setAllowedRewardIds(allowed);
      setPolicy('whitelist');
      setFileStatus({ text: 'Whitelist loaded. Review it and save the reward policy to activate it.' });
    } catch (error) {
      setFileStatus({ text: error instanceof SyntaxError ? 'The whitelist file contains invalid JSON.'
        : error instanceof Error ? error.message : 'Could not open the whitelist file.', error: true });
    }
  }
  return <form className="space-y-3" onSubmit={event => {
    event.preventDefault();
    save(policy, allowedRewardIds);
  }}>
    <label className="block max-w-sm font-semibold text-white">Reward policy
      <select className={field} value={policy} onChange={event => setPolicy(event.target.value as RewardPolicy)}>
        <option value="all_supported">All supported rewards</option>
        <option value="whitelist">Owner whitelist</option>
      </select>
    </label>
    {policy === 'whitelist' ? <div className="space-y-3">
      {[...new Set(available.map(reward => reward.category))].map(category => <fieldset key={category} className="space-y-1">
        <legend className="font-semibold text-slate-200">{category}</legend>
        {available.filter(reward => reward.category === category).map(reward => <label key={reward.id} className="flex items-center gap-2">
          <input type="checkbox" checked={allowedRewardIds.includes(reward.id)} onChange={event => {
            const checked = event.target.checked;
            setAllowedRewardIds(ids => checked ? orderRewards([...ids, reward.id]) : ids.filter(id => id !== reward.id));
          }} />
          Allow {reward.label}
        </label>)}
      </fieldset>)}
      {catalogEnabled && <p className="text-sm text-slate-300">Each Kit also requires permission for its items and dinosaurs.</p>}
    </div> : <p className="text-sm text-slate-300">{available.map(reward => reward.label).join(' / ')}</p>}
    <div className="flex flex-wrap items-center gap-2">
      <button type="submit" className="btn btn-primary"
        disabled={busy || (policy === initialPolicy && allowedRewardIds.join(',') === initialIds.join(','))}>Save reward policy</button>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => fileInput.current?.click()}>Import whitelist</button>
      <input ref={fileInput} type="file" hidden accept=".json,application/json" disabled={busy} onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void importWhitelist(file);
      }} />
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => exportOwnerWhitelist(initialIds)}>Export saved whitelist</button>
    </div>
    {fileStatus && <p role={fileStatus.error ? 'alert' : 'status'} className={fileStatus.error ? 'text-rose-300' : 'text-sm text-slate-300'}>{fileStatus.text}</p>}
  </form>;
}

function HostedRewardTest({ server, busy, send }: { server: LinkedServer; busy: boolean; send: (rewardId?: string) => void }) {
  const [selected, setSelected] = useState(roseRewardId);
  const ids = server.allowedRewardIds ?? (server.roseAllowed === false ? [] : [roseRewardId]);
  const available = rewardCatalog.filter(reward => ids.includes(reward.id));
  const reward = available.find(option => option.id === selected) ?? available[0];
  if (!reward) return <p className="text-sm text-slate-300">The owner’s whitelist is empty.</p>;
  return <div className="flex flex-wrap items-end gap-2">
    {available.length === 1 && reward.id !== roseRewardId && <p className="text-sm text-slate-300">{reward.label}</p>}
    {available.length > 1 && <label>Test reward
      <select className={field} value={reward.id} disabled={busy} onChange={event => setSelected(event.target.value)}>
        {available.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>}
    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => {
      if (window.confirm('Send ' + reward.label + ' to your linked survivor on ' + server.name + '?')) {
        send(server.allowedRewardIds ? reward.id : undefined);
      }
    }}>{available.length === 1 && reward.id === roseRewardId ? 'Send Rose test' : 'Send test reward'}</button>
  </div>;
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
        const result = await relay<{ state?: DeliveryState; rewardId?: string; acknowledged?: number; total?: number }>(credentials, payload);
        if (payload.action === 'simulate') {
          if (result.state === 'acknowledged') {
            message = result.rewardId && result.rewardId !== roseRewardId
              ? 'ARK acknowledged ' + rewardLabel(result.rewardId) + '. Verify the reward in game.'
              : 'ARK acknowledged the test. Check your inventory for 5 Stone.';
          } else if (result.acknowledged && result.total && result.acknowledged < result.total) {
            message = 'ARK acknowledged ' + result.acknowledged + ' of ' + result.total +
              ' Kit steps. Check the game and delivery history before sending again.';
          } else {
            message = 'Delivery is unconfirmed. Check the game and the owner’s history before sending again.';
          }
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
  const initialIds = orderRewards(owned?.allowedRewardIds ?? (owned?.roseWhitelisted ? [roseRewardId] : []));
  return <section className="mt-6 max-w-3xl space-y-4" aria-labelledby="relay-title">
    <h2 id="relay-title" className="text-xl font-semibold text-white">ARK server registry</h2>
    <p className="text-sm text-slate-300">Find a server, request access, and test an approved reward.</p>
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
      {owned.rewardPolicy && <OwnerRewardPolicy key={owned.id + owned.rewardPolicy + initialIds.join(',')}
        initialPolicy={owned.rewardPolicy} initialIds={initialIds} busy={busy} catalogEnabled={Array.isArray(owned.allowedRewardIds)}
        save={(policy, allowedRewardIds) => void run({
          action: 'reward-policy', serverId: owned.id, policy,
          ...(owned.allowedRewardIds ? { allowedRewardIds } : { roseWhitelisted: allowedRewardIds.includes(roseRewardId) }),
        }, 'Saved the reward policy.')} />}
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
            <span className="text-white">{rewardLabel(entry.rewardId)}</span> · {!entry.source || entry.source === 'test' ? 'Test' : 'Live gift'} · {deliveryLabels[entry.state]}
            {entry.rewardId === 'starter-kit' && entry.acknowledgedCommands !== undefined && <> · {entry.acknowledgedCommands}/2 steps acknowledged</>}
            {' · '}{entry.streamer} · <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
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
          {server.state === 'approved' && <HostedRewardTest server={server} busy={busy}
            send={rewardId => void run({ action: 'simulate', serverId: server.id, requestId: crypto.randomUUID(), rewardId })} />}
        </li>)}
      </ul>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void run({ action: 'dashboard' })}>Refresh access</button>
    </section>}
  </section>;
}
