import { useEffect, useRef, useState, type FormEvent } from 'react';
import { defaultItemQuantity, maxItemQuantity, rewardCatalog, rewardsById, type HostedReward } from '../../relay/reward-catalog.mjs';

type AccessState = 'requested' | 'approved' | 'revoked';
type RewardPolicy = 'whitelist' | 'all_supported';
type DeliveryState = 'pending' | 'sending' | 'cancelled' | 'unconfirmed' | 'acknowledged';
type Quantities = Record<string, number>;
type OwnerPolicy = { policy: RewardPolicy; allowedRewardIds: string[]; maxItemQuantities: Quantities };
type Server = { id: string; name: string };
type LinkedServer = Server & { state: AccessState; survivorId: string; roseAllowed?: boolean; allowedRewardIds?: string[]; maxItemQuantities?: Quantities };
type SavedKit = { id: string; name: string; rewardIds: string[]; itemQuantities?: Quantities; revision: string };
type TestReward = { rewardId?: string; kitId?: string; kitRevision?: string; quantity?: number };
type OwnerServer = Server & {
  listed: boolean;
  hourlyLimit: number;
  rewardPolicy?: RewardPolicy;
  roseWhitelisted?: boolean;
  allowedRewardIds?: string[];
  maxItemQuantities?: Quantities;
  access: { streamerId: string; survivorId: string; state: AccessState; email: string }[];
  history: { requestId: string; createdAt: string; state: DeliveryState; streamer: string; source?: 'test' | 'live_rose' | 'live_draft';
    rewardId?: string; acknowledgedCommands?: number; totalCommands?: number; kitName?: string | null; kitRewardIds?: string[] | null; itemQuantities?: Quantities }[];
};
type Dashboard = {
  canRegister: boolean;
  owned: OwnerServer | null;
  linked: LinkedServer[];
  results: Server[];
  savedKits?: SavedKit[];
};
type Props = { token: string; relayUrl: string };

const deliveryLabels: Record<DeliveryState, string> = {
  pending: 'Preparing', sending: 'Sending', cancelled: 'Cancelled',
  unconfirmed: 'Delivery unconfirmed', acknowledged: 'ARK acknowledged',
};
const field = 'field mt-1 block';
const card = 'card space-y-4 p-5';
const roseRewardId = 'rose-stone';
const customKitId = 'custom-kit';
const rewardName = (reward: HostedReward) => reward.item?.name ?? reward.label;
const validQuantity = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= maxItemQuantity;

function rewardLabel(id = roseRewardId, quantities: Quantities = {}) {
  const reward = rewardsById.get(id);
  if (reward?.item) return (quantities[id] ?? defaultItemQuantity) + ' ' + reward.item.name;
  return reward?.label ?? 'Hosted reward';
}

function orderRewards(ids: string[]) {
  const selected = new Set(ids);
  return rewardCatalog.filter(reward => selected.has(reward.id)).map(reward => reward.id);
}

function parseOwnerWhitelist(raw: string, available: HostedReward[], supportsQuantities: boolean): OwnerPolicy {
  const config = JSON.parse(raw);
  const version1 = config?.version === 1;
  const version2 = config?.version === 2 && supportsQuantities;
  const allowedKeys = version1 ? ['version', 'allowedRewardIds'] : ['version', 'policy', 'allowedRewardIds', 'maxItemQuantities'];
  if ((!version1 && !version2) || !Array.isArray(config.allowedRewardIds) ||
      Object.keys(config).some(key => !allowedKeys.includes(key)) ||
      (version2 && !['whitelist', 'all_supported'].includes(config.policy))) {
    throw new Error('Choose a valid Northpath owner whitelist.');
  }
  const entries = new Map(available.map(reward => [reward.id, reward]));
  if (config.allowedRewardIds.some((id: string) => !entries.has(id))) {
    throw new Error('This whitelist includes a reward the relay does not support yet.');
  }
  if (new Set(config.allowedRewardIds).size !== config.allowedRewardIds.length) throw new Error('Remove duplicate reward IDs from the whitelist.');
  const limits = version1 ? {} : config.maxItemQuantities;
  if (!limits || typeof limits !== 'object' || Array.isArray(limits) ||
    Object.entries(limits).some(([id, quantity]) => !entries.get(id)?.item || !validQuantity(quantity))) {
    throw new Error('Item quantity limits must be whole numbers from 1 to ' + maxItemQuantity + '.');
  }
  return { policy: version1 ? 'whitelist' : config.policy, allowedRewardIds: orderRewards(config.allowedRewardIds), maxItemQuantities: limits };
}

function exportOwnerWhitelist(saved: OwnerPolicy, supportsQuantities: boolean) {
  const config = supportsQuantities ? { version: 2, ...saved } : { version: 1, allowedRewardIds: saved.allowedRewardIds };
  const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'northpath-owner-whitelist.json';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function OwnerRewardPolicy({ saved, catalogEnabled, supportsQuantities, busy, save }: {
  saved: OwnerPolicy;
  catalogEnabled: boolean;
  supportsQuantities: boolean;
  busy: boolean;
  save: (value: OwnerPolicy) => void;
}) {
  const [policy, setPolicy] = useState(saved.policy);
  const [allowedRewardIds, setAllowedRewardIds] = useState(saved.allowedRewardIds);
  const [limits, setLimits] = useState(saved.maxItemQuantities);
  const [showLimits, setShowLimits] = useState(false);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(24);
  const [fileStatus, setFileStatus] = useState<{ text: string; error?: boolean }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const available = catalogEnabled ? rewardCatalog : rewardCatalog.slice(0, 1);
  const allowed = new Set(allowedRewardIds);
  const query = search.trim().toLowerCase();
  const matching = available.filter(reward => (policy === 'whitelist' || reward.item) &&
    [rewardName(reward), reward.category, reward.item?.category].some(label => label?.toLowerCase().includes(query)));
  const visible = matching.slice(0, visibleCount);
  const capCount = Object.keys(limits).length;
  const limitsChanged = capCount !== Object.keys(saved.maxItemQuantities).length ||
    Object.entries(limits).some(([id, quantity]) => saved.maxItemQuantities[id] !== quantity);
  const changed = policy !== saved.policy || allowedRewardIds.join(',') !== saved.allowedRewardIds.join(',') || limitsChanged;
  const limitsValid = Object.values(limits).every(validQuantity);

  async function importWhitelist(file: File) {
    try {
      if (file.size > 128 * 1024) throw new Error('The whitelist file is too large.');
      const imported = parseOwnerWhitelist(await file.text(), available, supportsQuantities);
      setAllowedRewardIds(imported.allowedRewardIds);
      setPolicy(imported.policy);
      setLimits(imported.maxItemQuantities);
      setFileStatus({ text: 'Whitelist loaded. Review it and save the reward policy to activate it.' });
    } catch (error) {
      setFileStatus({ text: error instanceof SyntaxError ? 'The whitelist file contains invalid JSON.'
        : error instanceof Error ? error.message : 'Could not open the whitelist file.', error: true });
    }
  }

  function changeLimit(id: string, value: string) {
    const next = { ...limits };
    if (value === '') delete next[id];
    else next[id] = Number(value);
    setLimits(next);
  }

  return <form className="space-y-3" onSubmit={event => {
    event.preventDefault();
    if (changed && limitsValid) save({ policy, allowedRewardIds, maxItemQuantities: limits });
  }}>
    <label className="block max-w-sm font-semibold text-white">Reward policy
      <select className={field} value={policy} onChange={event => setPolicy(event.target.value as RewardPolicy)}>
        <option value="all_supported">All supported rewards</option>
        <option value="whitelist">Owner whitelist</option>
      </select>
    </label>
    {supportsQuantities && <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={showLimits} onChange={event => setShowLimits(event.target.checked)} />
      Show optional item quantity limits{capCount ? ' (' + capCount + ' set)' : ''}
    </label>}
    {showLimits && <p className="text-sm text-slate-300">Leave a limit blank to allow any supported quantity up to {maxItemQuantity} per delivery.</p>}
    {(policy === 'whitelist' || showLimits) && <div className="space-y-3">
      {available.length > 24 && <label className="block max-w-sm">Find rewards
        <input className={field} type="search" value={search} onChange={event => { setSearch(event.target.value); setVisibleCount(24); }} />
      </label>}
      {[...new Set(visible.map(reward => reward.category))].map(category => <fieldset key={category} className="space-y-1">
        <legend className="font-semibold text-slate-200">{category}</legend>
        {visible.filter(reward => reward.category === category).map(reward => <div key={reward.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {policy === 'whitelist' ? <label className="flex min-w-0 items-center gap-2">
            <input type="checkbox" checked={allowed.has(reward.id)} onChange={event => {
              const checked = event.target.checked;
              setAllowedRewardIds(ids => checked ? orderRewards([...ids, reward.id]) : ids.filter(id => id !== reward.id));
            }} />
            <span className="break-words">Allow {rewardName(reward)}</span>
          </label> : <span className="break-words">{rewardName(reward)}</span>}
          {showLimits && reward.item && (policy === 'all_supported' || allowed.has(reward.id)) &&
            <input className="field !w-24" aria-label={'Max quantity of ' + reward.item.name}
              type="number" min={1} max={maxItemQuantity} placeholder="Any" value={limits[reward.id] ?? ''}
              onChange={event => changeLimit(reward.id, event.target.value)} />}
        </div>)}
      </fieldset>)}
      {matching.length === 0 && <p className="text-sm text-slate-300">No rewards match.</p>}
      {visible.length < matching.length && <button type="button" className="btn btn-ghost"
        onClick={() => setVisibleCount(count => count + 24)}>Show more rewards ({visible.length} of {matching.length})</button>}
      {catalogEnabled && policy === 'whitelist' && <p className="text-sm text-slate-300">Each Kit also requires permission for its items and dinosaurs.</p>}
    </div>}
    {!limitsValid && <p role="alert" className="text-sm text-rose-300">Enter a whole number from 1 to {maxItemQuantity}, or leave the limit blank.</p>}
    <div className="flex flex-wrap items-center gap-2">
      <button type="submit" className="btn btn-primary" disabled={busy || !changed || !limitsValid}>Save reward policy</button>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => fileInput.current?.click()}>Import whitelist</button>
      <input ref={fileInput} type="file" hidden accept=".json,application/json" disabled={busy} onChange={event => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = '';
        if (file) void importWhitelist(file);
      }} />
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => exportOwnerWhitelist(saved, supportsQuantities)}>Export saved whitelist</button>
    </div>
    {fileStatus && <p role={fileStatus.error ? 'alert' : 'status'} className={fileStatus.error ? 'text-rose-300' : 'text-sm text-slate-300'}>{fileStatus.text}</p>}
  </form>;
}

function HostedRewardTest({ server, kits, busy, send }: {
  server: LinkedServer; kits: SavedKit[]; busy: boolean; send: (test: TestReward) => void;
}) {
  const [selected, setSelected] = useState(roseRewardId);
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState('');
  const ids = new Set(server.allowedRewardIds ?? (server.roseAllowed === false ? [] : [roseRewardId]));
  const limits = server.maxItemQuantities ?? {};
  const supportsQuantities = server.maxItemQuantities !== undefined;
  const withinLimits = (rewardIds: string[], amounts: Quantities = {}) =>
    rewardIds.every(id => (amounts[id] ?? defaultItemQuantity) <= (limits[id] ?? maxItemQuantity));
  const available: { id: string; label: string; test: TestReward; item?: HostedReward['item']; components?: string[] }[] = rewardCatalog
    .filter(reward => reward.id !== customKitId && ids.has(reward.id) &&
      (reward.id !== 'starter-kit' || withinLimits([roseRewardId])))
    .map(reward => ({ id: reward.id, label: supportsQuantities ? rewardName(reward) : reward.label,
      item: reward.item, test: { rewardId: server.allowedRewardIds ? reward.id : undefined } }));
  if (ids.has(customKitId)) {
    available.push(...kits.filter(kit => kit.rewardIds.every(id => ids.has(id)) && withinLimits(kit.rewardIds, kit.itemQuantities)).map(kit => ({
      id: 'kit:' + kit.id, label: 'Kit: ' + kit.name, test: { kitId: kit.id, kitRevision: kit.revision },
      components: kit.rewardIds.map(id => rewardLabel(id, kit.itemQuantities)),
    })));
  }
  if (!available.length) return <p className="text-sm text-slate-300">The server has no rewards you can test.</p>;
  const query = search.trim().toLowerCase();
  const matches = available.filter(option => option.label.toLowerCase().includes(query));
  const options = matches.slice(0, 60);
  const active = matches.find(option => option.id === selected);
  if (active && !options.includes(active)) options.push(active);
  const reward = active ?? options[0];
  const cap = reward ? (limits[reward.id] ?? maxItemQuantity) : maxItemQuantity;
  const amount = quantity === '' ? Math.min(defaultItemQuantity, cap) : Number(quantity);
  const hasQuantity = !!(reward?.item && supportsQuantities);
  const validAmount = !hasQuantity || (validQuantity(amount) && amount <= cap);
  const components = reward?.components?.join(' + ');
  return <div className="min-w-0 space-y-2">
    {available.length > 60 && <label className="block max-w-sm">Find a test reward
      <input className={field} type="search" value={search} onChange={event => { setSearch(event.target.value); setQuantity(''); }} />
    </label>}
    {!reward && <p className="text-sm text-slate-300">No rewards match.</p>}
    {reward && <div className="flex flex-wrap items-end gap-2">
      {available.length === 1 && reward.id !== roseRewardId && <p className="break-words text-sm text-slate-300">{reward.label}</p>}
      {available.length > 1 && <label className="min-w-0 max-w-full">Test reward
        <select className={field + ' max-w-full'} value={reward.id} disabled={busy} onChange={event => { setSelected(event.target.value); setQuantity(''); }}>
          {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>
      </label>}
      {hasQuantity && <label>Quantity (max {cap})
        <input className={field + ' !w-28'} type="number" min={1} max={cap} value={quantity === '' ? amount : quantity}
          onChange={event => setQuantity(event.target.value)} />
      </label>}
      <button type="button" className="btn btn-primary" disabled={busy || !validAmount} onClick={() => {
        const detail = components ? ' (' + components + ')' : '';
        const label = hasQuantity ? rewardLabel(reward.id, { [reward.id]: amount }) : reward.label;
        if (window.confirm('Send ' + label + detail + ' to your linked survivor on ' + server.name + '?')) {
          send(hasQuantity ? { ...reward.test, quantity: amount } : reward.test);
        }
      }}>{available.length === 1 && reward.id === roseRewardId && !hasQuantity ? 'Send Rose test' : 'Send test reward'}</button>
    </div>}
    {components && <p className="text-sm text-slate-300">{components}</p>}
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
        const result = await relay<{ state?: DeliveryState; rewardId?: string; acknowledged?: number; total?: number; kitName?: string; itemQuantities?: Quantities }>(credentials, payload);
        if (payload.action === 'simulate') {
          if (result.state === 'acknowledged') {
            message = result.rewardId && (result.rewardId !== roseRewardId || result.itemQuantities?.[roseRewardId])
              ? 'ARK acknowledged ' + (result.kitName ? 'Kit “' + result.kitName + '”' : rewardLabel(result.rewardId, result.itemQuantities)) + '. Verify the reward in game.'
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
  const savedPolicy: OwnerPolicy = {
    policy: owned?.rewardPolicy ?? 'all_supported',
    allowedRewardIds: orderRewards(owned?.allowedRewardIds ?? (owned?.roseWhitelisted ? [roseRewardId] : [])),
    maxItemQuantities: owned?.maxItemQuantities ?? {},
  };
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
      {owned.rewardPolicy && <OwnerRewardPolicy key={owned.id + JSON.stringify(savedPolicy)}
        saved={savedPolicy} busy={busy} catalogEnabled={Array.isArray(owned.allowedRewardIds)}
        supportsQuantities={owned.maxItemQuantities !== undefined}
        save={({ policy, allowedRewardIds, maxItemQuantities }) => void run({
          action: 'reward-policy', serverId: owned.id, policy,
          ...(owned.allowedRewardIds ? { allowedRewardIds } : { roseWhitelisted: allowedRewardIds.includes(roseRewardId) }),
          ...(owned.maxItemQuantities !== undefined ? { maxItemQuantities } : {}),
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
          {owned.history.map(entry => {
            const total = entry.totalCommands ?? (entry.rewardId === 'starter-kit' ? 2 : 1);
            return <li key={entry.requestId + entry.streamer} className="break-words py-2 text-sm text-slate-300">
              <span className="text-white">{entry.kitName ? 'Kit: ' + entry.kitName : rewardLabel(entry.rewardId, entry.itemQuantities)}</span> · {!entry.source || entry.source === 'test' ? 'Test' : 'Live gift'} · {deliveryLabels[entry.state]}
              {total > 1 && entry.acknowledgedCommands !== undefined && <> · {entry.acknowledgedCommands}/{total} steps acknowledged</>}
              {' · '}{entry.streamer} · <time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleString()}</time>
              {entry.kitRewardIds && <p className="mt-1">{entry.kitRewardIds.map(id => rewardLabel(id, entry.itemQuantities)).join(' + ')}</p>}
            </li>;
          })}
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
          {server.state === 'approved' && <HostedRewardTest server={server} kits={dashboard.savedKits ?? []} busy={busy}
            send={test => void run({ action: 'simulate', serverId: server.id, requestId: crypto.randomUUID(), ...test })} />}
        </li>)}
      </ul>
      <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void run({ action: 'dashboard' })}>Refresh access</button>
    </section>}
  </section>;
}
