import TargetPanel from './TargetPanel';
import DriftPanel from './DriftPanel';
import RecoveryPanel from './RecoveryPanel';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import {
  Activity, ArrowRight, Boxes, Check, ChevronDown, ChevronRight,
  Database, Download, Gamepad2, Gift, Layers3, LayoutDashboard,
  Menu, Monitor, Plus, Radio, RotateCcw, Search, Settings2, ShieldAlert, ShieldCheck,
  SlidersHorizontal, Trash2, Upload, WifiOff, X, Zap,
} from 'lucide-react';
import rawCatalog from './catalog.json';
import release from './icepack-release.json';

const releaseLabel = `v${release.version.replace(/-alpha$/, ' Alpha')}`;

type CatalogEntry = { id: string; name: string; blueprint: string; contentPack: string; verified: boolean; category: string; tags: string[] };
type ActionType = 'dinosaur' | 'item' | 'kit';
type Action = { type: ActionType; catalogId: string; quantity: number; level: number; tamed: boolean; quality: number; kitId: string; announcement: string };
type GiftRule = { id: string; giftName: string; giftId: string; enabled: boolean; action: Action };
type KitEntry = { id: string; action: Action };
type Kit = { id: string; name: string; description: string; entries: KitEntry[] };
type Config = { version: 1; rules: GiftRule[]; kits: Kit[]; serverName: string; playerId: string; preferredRegion: string };
type Page = 'overview' | 'rules' | 'kits' | 'catalog' | 'connections' | 'recovery' | 'settings';
type AgentStatus = {
  online: boolean;
  engineOnline: boolean;
  engineStatus: string;
  engineVersion: string;
  armState: boolean;
  giftRconMode: string;
  customRulesMode: string;
  customRulesLoaded: boolean;
  customRuleCount: number;
  customKitCount: number;
  pending: number;
  customQueued: number;
  customInflight: boolean;
  bridgeOnline: boolean;
  recentLogs: { time: string; message: string; category?: 'gifts' | 'previews' | 'rcon' | 'errors' | 'other' }[];
  checkedAt: string;
};
type Preview = { time: string; gift: string; detail: string; status: 'matched' | 'ignored' };

const catalog: { dinosaurs: CatalogEntry[]; items: CatalogEntry[]; packs: { id: string; name: string }[] } = rawCatalog;
const STORAGE_KEY = 'northpath.icepack.dashboard.v1';
const defaultAction = (type: ActionType = 'dinosaur'): Action => ({
  type, catalogId: type === 'item' ? 'Stone' : 'Dodo', quantity: 1, level: 25, tamed: false, quality: 0, kitId: '', announcement: '',
});
const initial: Config = {
  version: 1, serverName: 'My ARK server', playerId: '', preferredRegion: 'US',
  rules: [
    { id: 'demo-1', giftName: 'Rose', giftId: '', enabled: true, action: { ...defaultAction(), catalogId: 'Dodo' } },
    { id: 'demo-2', giftName: 'Galaxy', giftId: '', enabled: true, action: { ...defaultAction(), catalogId: 'Rex', level: 150 } },
    { id: 'demo-3', giftName: 'Heart Me', giftId: '', enabled: true, action: { ...defaultAction('item'), catalogId: 'Wood', quantity: 25 } },
  ],
  kits: [{ id: 'demo-kit', name: 'Starter supplies', description: 'Example kit — edit or delete', entries: [
    { id: 'demo-kit-1', action: { ...defaultAction('item'), catalogId: 'Stone', quantity: 100 } },
    { id: 'demo-kit-2', action: { ...defaultAction(), catalogId: 'Dodo', quantity: 1 } },
  ] }],
};

function validConfig(x: unknown): x is Config {
  if (!x || typeof x !== 'object') return false;
  const d = x as Record<string, unknown>;
  if (d.version !== 1 || !Array.isArray(d.rules) || !Array.isArray(d.kits) || d.rules.length > 500 || d.kits.length > 200) return false;
  if (typeof d.serverName !== 'string' || typeof d.playerId !== 'string' || typeof d.preferredRegion !== 'string') return false;
  const validAction = (a: unknown, allowKit: boolean): a is Action => {
    if (!a || typeof a !== 'object') return false;
    const z = a as Record<string, unknown>;
    return (z.type === 'dinosaur' || z.type === 'item' || (allowKit && z.type === 'kit')) &&
      typeof z.catalogId === 'string' && typeof z.kitId === 'string' && typeof z.announcement === 'string' &&
      z.catalogId.length < 150 && z.kitId.length < 150 && z.announcement.length <= 200 &&
      typeof z.quantity === 'number' && Number.isInteger(z.quantity) && z.quantity >= 1 && z.quantity <= 1000 &&
      typeof z.level === 'number' && Number.isInteger(z.level) && z.level >= 1 && z.level <= 150 &&
      typeof z.quality === 'number' && Number.isInteger(z.quality) && z.quality >= 0 && z.quality <= 100 &&
      typeof z.tamed === 'boolean';
  };
  return d.rules.every((r: unknown) => {
    if (!r || typeof r !== 'object') return false;
    const v = r as Record<string, unknown>;
    return typeof v.id === 'string' && typeof v.giftName === 'string' && v.giftName.length <= 120 && typeof v.giftId === 'string' && v.giftId.length <= 100 && typeof v.enabled === 'boolean' && validAction(v.action, true);
  }) && d.kits.every((k: unknown) => {
    if (!k || typeof k !== 'object') return false;
    const v = k as Record<string, unknown>;
    return typeof v.id === 'string' && typeof v.name === 'string' && v.name.length <= 120 && typeof v.description === 'string' && v.description.length <= 500 && Array.isArray(v.entries) && v.entries.length <= 100 && v.entries.every((e: unknown) => {
      if (!e || typeof e !== 'object') return false;
      const z = e as Record<string, unknown>;
      return typeof z.id === 'string' && validAction(z.action, false);
    });
  });
}
function loadConfig(): Config {
  try {
    const str = localStorage.getItem(STORAGE_KEY);
    if (str) { const data: unknown = JSON.parse(str); if (validConfig(data)) return data; }
  } catch { /* use fresh local sample */ }
  return initial;
}
const newId = () => crypto.randomUUID();
const displayAction = (a: Action, kits: Kit[]) => {
  if (a.type === 'kit') return `Kit · ${kits.find(k => k.id === a.kitId)?.name ?? 'Select a kit'}`;
  if (a.type === 'item') return `${a.quantity} × ${a.catalogId}${a.quality ? ` · quality ${a.quality}` : ''}`;
  return `${a.quantity} × ${a.catalogId} · Lv ${a.level} · ${a.tamed ? 'Tamed' : 'Wild'}`;
};

const sections: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: 'overview', label: 'Overview', icon: LayoutDashboard },
  { page: 'rules', label: 'Gift rules', icon: Gift },
  { page: 'kits', label: 'Kit builder', icon: Boxes },
  { page: 'catalog', label: 'ARK catalog', icon: Database },
  { page: 'connections', label: 'Connections', icon: Radio },
  { page: 'recovery', label: 'Recovery', icon: Database },
  { page: 'settings', label: 'Settings', icon: Settings2 },
];
const SectionTitle = ({ title, subtitle, extra }: { title: string; subtitle: string; extra?: ReactNode }) => (
  <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div><h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h1><p className="mt-2 text-sm text-slate-400">{subtitle}</p></div>
    {extra}
  </div>
);
const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => <div className={`panel p-5 md:p-6 ${className}`}>{children}</div>;
const Label = ({ children }: { children: ReactNode }) => <label className="label">{children}</label>;
const IconCircle = ({ children }: { children: ReactNode }) => <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">{children}</div>;

function ActionEditor({ value, onChange, kits, allowKit = true }: { value: Action; onChange: (next: Action) => void; kits: Kit[]; allowKit?: boolean }) {
  const change = (patch: Partial<Action>) => onChange({ ...value, ...patch });
  const options = value.type === 'item' ? catalog.items : catalog.dinosaurs;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <div><Label>Action</Label><select className="field" value={value.type} onChange={e => onChange(defaultAction(e.target.value as ActionType))}>
      <option value="dinosaur">Spawn dinosaur</option><option value="item">Give item</option>{allowKit && <option value="kit">Deliver kit</option>}
    </select></div>
    {value.type === 'kit' ? <div className="sm:col-span-2"><Label>Kit</Label><select className="field" value={value.kitId} onChange={e => change({ kitId: e.target.value })}><option value="">Select a kit</option>{kits.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}</select></div> : <>
      <div><Label>{value.type === 'item' ? 'Item' : 'Dinosaur'}</Label><select className="field" value={value.catalogId} onChange={e => change({ catalogId: e.target.value })}>
        {options.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></div>
      <div><Label>Quantity (1–1,000)</Label><input className="field" type="number" min="1" max="1000" value={value.quantity} onChange={e => change({ quantity: Math.max(1, Math.min(1000, Number(e.target.value) || 1)) })}/></div>
      {value.type === 'dinosaur' ? <>
        <div><Label>Level (1–150)</Label><input className="field" type="number" min="1" max="150" value={value.level} onChange={e => change({ level: Math.max(1, Math.min(150, Number(e.target.value) || 1)) })}/></div>
        <div><Label>Spawn state</Label><select className="field" value={value.tamed ? 'tamed' : 'wild'} onChange={e => change({ tamed: e.target.value === 'tamed' })}><option value="wild">Wild</option><option value="tamed">Tamed (future support)</option></select></div>
      </> : <div><Label>Item quality (0 = default)</Label><input className="field" type="number" min="0" max="100" value={value.quality} onChange={e => change({ quality: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })}/></div>}
    </>}
    <div className="sm:col-span-2 lg:col-span-3"><Label>Announcement (optional)</Label><input className="field" maxLength={200} value={value.announcement} onChange={e => change({ announcement: e.target.value })} placeholder="e.g. The Ice Pack sent you a surprise!"/></div>
  </div>;
}

function App() {
  const [config, setConfig] = useState<Config>(loadConfig);
  const [page, setPage] = useState<Page>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [ruleOpen, setRuleOpen] = useState<string | null>(null);
  const [kitOpen, setKitOpen] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [kind, setKind] = useState<'dinosaurs' | 'items'>('dinosaurs');
  const [simulationGift, setSimulationGift] = useState('Rose');
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [notice, setNotice] = useState('');
  const [agent, setAgent] = useState<AgentStatus | null>(null);
  const [agentError, setAgentError] = useState('');
  const [lastEngineSeen, setLastEngineSeen] = useState<string | null>(null);
  const [checkingAgent, setCheckingAgent] = useState(false);
  const [syncToken, setSyncToken] = useState('');
  const [syncPreview, setSyncPreview] = useState<{previewId:string;hash:string;ruleCount:number;kitCount:number;warnings:string[];engineMode:string;draftJson?:string}|null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');
  const [controlBusy, setControlBusy] = useState(false);
  const [controlMessage, setControlMessage] = useState('');
  const [controlError, setControlError] = useState('');
  const [activityFilter, setActivityFilter] = useState('all');
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareResult, setCompareResult] = useState<{match:boolean;loaded?:boolean;reason?:string;source?:string}|null>(null);
  const [compareError, setCompareError] = useState('');
  const [enginePreviewBusy, setEnginePreviewBusy] = useState(false);
  const [enginePreviewMessage, setEnginePreviewMessage] = useState('');
  const [enginePreviewError, setEnginePreviewError] = useState('');
  const syncRequest = async (path: string, payload: unknown) => {
    const response = await fetch(`/api/agent/sync/${path}`, {method:'POST',headers:{'Content-Type':'application/json','x-icepack-sync-token':syncToken},body:JSON.stringify(payload)});
    const data: unknown = await response.json();
    if (!response.ok) { const err = data as {error?:string}; throw new Error(err.error || `HTTP ${response.status}`); }
    return data;
  };
  const previewSync = async () => {
    setSyncBusy(true); setSyncError(''); setSyncMessage('');setSyncPreview(null);
    try {const preview = await syncRequest('preview',config) as {previewId:string;hash:string;ruleCount:number;kitCount:number;warnings:string[];engineMode:string}; setSyncPreview({...preview, draftJson:JSON.stringify(config)});setSyncMessage('Preview validated against your engine catalog. No changes applied.');}
    catch(e){setSyncError(e instanceof Error?e.message:'Preview failed');}
    finally{setSyncBusy(false);}
  };
  const applySync = async () => {
    if (!syncPreview) return;
    if (syncPreview.draftJson !== JSON.stringify(config)) { setSyncPreview(null); setSyncError('Draft changed since validation. Validate & preview again.'); return; }
    if (!window.confirm('Apply this exact configuration to the local Kit Editor, back up the previous file, and ask the engine to reload? Live gift modes must be OFF.'))return;
    setSyncBusy(true);setSyncError('');setSyncMessage('');
    try {const result=await syncRequest('apply',{previewId:syncPreview.previewId,hash:syncPreview.hash}) as {backupCreated:boolean};setCompareResult(null);setSyncPreview(null);setSyncMessage(`Applied and engine reloaded. Previous configuration backup ${result.backupCreated?'saved':'not needed (new file)'}. Live modes were not enabled.`);}
    catch(e){setSyncError(e instanceof Error?e.message:'Apply failed');setSyncPreview(null);}
    finally{setSyncBusy(false);}
  };
  const runControl = async (action: 'start-preview'|'stop-preview'|'emergency-stop') => {
    const prompt = action === 'emergency-stop'
      ? 'EMERGENCY STOP: clear queued work and stop all three reward lanes? Commands already sent cannot be recalled.'
      : action === 'stop-preview' ? 'Turn Custom Rules Preview off?' : 'Enable Custom Rules PREVIEW only? No RCON rewards will be sent.';
    if (!window.confirm(prompt)) return;
    setControlBusy(true); setControlMessage(''); setControlError('');
    try {
      const res = await fetch('/api/agent/control', {method:'POST',headers:{'Content-Type':'application/json','x-icepack-sync-token':syncToken},body:JSON.stringify({action})});
      const data = await res.json() as {ok?:boolean;error?:string;warning?:string;customRulesMode?:string};
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Control failed (${res.status})`);
      setControlMessage(`${action === 'start-preview' ? 'Preview enabled' : action === 'stop-preview' ? 'Preview stopped' : 'Emergency stop sent and verified'}. ${data.warning ?? ''}`);
    } catch (error) {setControlError(error instanceof Error ? error.message : 'Control request failed');}
    finally {setControlBusy(false);}
  };
  const compareConfig = async () => {
    setCompareBusy(true); setCompareError('');setCompareResult(null);
    try {
      const res = await fetch('/api/agent/sync/compare',{method:'POST',headers:{'Content-Type':'application/json','x-icepack-sync-token':syncToken},body:JSON.stringify(config)});
      const data = await res.json() as {ok?:boolean;match:boolean;loaded?:boolean;reason?:string;source?:string;error?:string};
      if (!res.ok || !data.ok) throw new Error(data.error ?? `Compare failed (${res.status})`);
      setCompareResult(data);
    } catch (error) {setCompareError(error instanceof Error ? error.message : 'Compare failed');}
    finally {setCompareBusy(false);}
  };
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 2200);
        let response: Response;
        try { response = await fetch('/api/agent/status', { signal: controller.signal, cache: 'no-store' }); }
        finally { window.clearTimeout(timeout); }
        if (!response.ok) throw new Error(`Local agent returned HTTP ${response.status}`);
        const data: AgentStatus = await response.json();
        if (!data.online || !data.engineOnline) throw new Error(data.engineStatus || 'Local engine is not reachable');
        if (active) { setAgent(data); setAgentError(''); setLastEngineSeen(new Date().toISOString()); }
      } catch (e) {
        if (active) { setAgent(null); setAgentError(e instanceof Error ? e.message : 'Connection unavailable'); }
      } finally { if (active) setCheckingAgent(false); }
    };
    setCheckingAgent(true);
    void check();
    const interval = window.setInterval(() => void check(), 5000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  const update = (patch: Partial<Config>) => { setCompareResult(null); setSyncPreview(null); setConfig(prev => ({ ...prev, ...patch })); };
  const changePage = (p: Page) => { setPage(p); setMenuOpen(false); setNotice(''); };
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* local storage may be blocked */ } }, [config]);
  const ruleCount = config.rules.filter(r => r.enabled).length;
  const activeKits = config.kits.length;
  const entries = kind === 'dinosaurs' ? catalog.dinosaurs : catalog.items;
  const filteredEntries = useMemo(() => entries.filter(c => (category === 'all' || c.category === category) && `${c.name} ${c.category} ${c.tags.join(' ')}`.toLowerCase().includes(query.toLowerCase())), [entries, category, query]);
  const categories = Array.from(new Set(entries.map(e => e.category))).sort();
  const updateRule = (id: string, patch: Partial<GiftRule>) => update({ rules: config.rules.map(r => r.id === id ? { ...r, ...patch } : r) });
  const updateKit = (id: string, patch: Partial<Kit>) => update({ kits: config.kits.map(k => k.id === id ? { ...k, ...patch } : k) });
  const updateEntry = (kit: Kit, entryId: string, action: Action) => updateKit(kit.id, { entries: kit.entries.map(e => e.id === entryId ? { ...e, action } : e) });
  const simulate = () => {
    const name = simulationGift.trim(); if (!name) return;
    const rule = config.rules.find(r => r.enabled && r.giftName.trim().toLowerCase() === name.toLowerCase());
    const record: Preview = { time: new Date().toLocaleTimeString(), gift: name, detail: rule ? displayAction(rule.action, config.kits) : 'No enabled matching rule', status: rule ? 'matched' : 'ignored' };
    setPreviews(prev => [record, ...prev].slice(0, 15));
    setNotice('Simulation only: no event was sent to TikTok, ARK, or RCON.');
  };
  const simulateInEngine = async () => {
    const rule = config.rules.find(r => r.enabled && r.giftName.trim().toLowerCase() === simulationGift.trim().toLowerCase());
    if (!rule) { setEnginePreviewError('Choose an enabled Gift Rule before engine preview.'); return; }
    setEnginePreviewBusy(true); setEnginePreviewMessage(''); setEnginePreviewError('');
    try {
      const response = await fetch('/api/agent/simulate/preview', {
        method: 'POST', headers: {'Content-Type':'application/json','x-icepack-sync-token':syncToken},
        body: JSON.stringify({id:rule.giftId,name:rule.giftName}),
      });
      const data = await response.json() as {ok?:boolean;error?:string;message?:string};
      if (!response.ok || !data.ok) throw new Error(data.error || `Preview failed (HTTP ${response.status})`);
      setEnginePreviewMessage(`Preview submitted for ${rule.giftName}. Check Connections → Recent engine activity for the engine-generated commands.`);
    } catch (e) { setEnginePreviewError(e instanceof Error ? e.message : 'Engine preview failed'); }
    finally { setEnginePreviewBusy(false); }
  };
  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = 'icepack-companion-config-v1.json'; link.click();
    URL.revokeObjectURL(url);
    setNotice('Configuration exported as JSON. Store the file securely.');
  };
  const importConfig = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
    if (file.size > 2_000_000) { setNotice('Import rejected: maximum file size is 2 MB.'); return; }
    try {
      const data: unknown = JSON.parse(await file.text());
      if (!validConfig(data)) { setNotice('Import rejected: invalid or unsupported configuration format.'); return; }
      if (!window.confirm('Replace all locally saved rules, kits, and preferences with the imported configuration?')) return;
      setSyncPreview(null); setCompareResult(null); setConfig(data); setNotice('Configuration imported into this browser.');
    } catch { setNotice('Import failed: file is not valid JSON.'); }
  };
  const selectedPage = sections.find(s => s.page === page)?.label ?? 'Overview';
  const localChecks = [
    { label: 'Engine reachable', ok: Boolean(agent), detail: agent ? 'Listening and returning status' : 'Start original engine on port 3210' },
    { label: 'Custom rules loaded', ok: Boolean(agent?.customRulesLoaded), detail: agent?.customRulesLoaded ? `${agent.customRuleCount} rules, ${agent.customKitCount} kits` : 'Load approved rules in the original engine' },
    { label: 'Pairing token entered', ok: syncToken.trim().length > 0, detail: syncToken ? 'Entered locally; validated only when an authenticated operation succeeds' : 'Enter the token printed by the bridge' },
    { label: 'Reward lanes safe for preview', ok: Boolean(agent && !agent.armState && agent.giftRconMode === 'off' && agent.customRulesMode !== 'live' && agent.pending === 0 && agent.customQueued === 0 && !agent.customInflight), detail: agent && (agent.armState || agent.giftRconMode !== 'off' || agent.customRulesMode === 'live' || agent.pending > 0 || agent.customQueued > 0 || agent.customInflight) ? 'A live lane or queued/in-flight work needs attention' : 'All live lanes must stay off for preview testing' },
  ];
  const checksPassed = localChecks.filter(c => c.ok).length;
  const localReadiness = !agent ? 'Offline' : agent.customRulesMode === 'live' || agent.giftRconMode !== 'off' || agent.armState ? 'Live lane active — use caution' : checksPassed === localChecks.length ? 'Ready for preview' : 'Setup required';

  return <div className="min-h-screen bg-[#09111f] text-slate-200 lg:flex">
    {menuOpen && <button className="fixed inset-0 z-30 bg-black/70 lg:hidden" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <aside className={`fixed inset-y-0 left-0 z-40 w-[264px] flex-col border-r border-[#203249] bg-[#0b1626] p-5 lg:sticky lg:top-0 lg:flex lg:h-screen ${menuOpen ? 'flex' : 'hidden'}`}>
      <div className="mb-9 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-[#082130]"><Gamepad2 size={24}/></div><div><div className="text-[15px] font-extrabold leading-tight text-white">ICE PACK</div><div className="text-[11px] font-semibold uppercase tracking-[.24em] text-cyan-300">COMPANION</div></div></div><button className="lg:hidden" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={20}/></button></div>
      <div className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-slate-500">Workspace</div>
      <nav className="space-y-1" aria-label="Main navigation">{sections.map(({ page: target, label, icon: Icon }) => <button key={target} onClick={() => changePage(target)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${page === target ? 'border border-cyan-400/20 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 text-cyan-100' : 'text-slate-400 hover:bg-[#192b40] hover:text-slate-100'}`}><Icon size={18}/><span className="flex-1">{label}</span>{page === target && <ChevronRight size={15}/>}</button>)}</nav>
      <div className="mt-auto space-y-4"><div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-amber-300"><ShieldAlert size={16}/> Prototype mode</div><p className="text-xs leading-5 text-slate-400">Browser-saved configuration. Live activity is read-only; configuration sync requires a pairing token. No cloud account yet.</p></div><div className="border-t border-slate-800 pt-4 text-xs text-slate-500">A <span className="font-semibold text-slate-300">Northpath</span> product <span className="float-right text-cyan-300">{releaseLabel}</span></div></div>
    </aside>
    <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#203249] bg-[#09111f]/95 px-5 backdrop-blur md:px-8"><div className="flex items-center gap-3"><button className="text-slate-300 lg:hidden" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={22}/></button><span className="hidden text-sm text-slate-500 sm:block">Workspace</span><ChevronRight className="hidden text-slate-600 sm:block" size={15}/><span className="text-sm font-semibold text-white">{selectedPage}</span></div><div className="flex items-center gap-3"><span className="hidden items-center gap-2 rounded-full border border-amber-600/25 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300 sm:inline-flex">{agent ? <ShieldCheck size={13}/> : <WifiOff size={13}/>} {agent ? 'Local engine detected' : 'Offline prototype'}</span><span className="flex h-9 w-9 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-xs font-bold text-cyan-300">IP</span></div></header>
      <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8 md:py-10">
        {notice && <div role="status" className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-200"><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice('')}><X size={17}/></button></div>}
        {page === 'overview' && <>
          <SectionTitle title="Welcome to the Pack" subtitle="Your command center for interactive ARK streams. Live actions remain disabled from this web dashboard." extra={<button className="btn btn-primary" onClick={() => changePage('rules')}><Plus size={16}/> Create gift rule</button>}/>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Enabled gift rules', count: String(ruleCount), icon: Gift, hint: 'Saved in this browser' },
              { label: 'Configured kits', count: String(activeKits), icon: Boxes, hint: 'Items + dinosaurs' },
              { label: 'Catalog creatures', count: String(catalog.dinosaurs.length), icon: Gamepad2, hint: 'Paths not verified' },
              { label: 'Local engine', count: agent ? 'Detected' : 'Offline', icon: agent ? ShieldCheck : WifiOff, hint: 'Connected agent status' },
            ].map(s => <Card key={s.label}><div className="flex items-start justify-between"><span className="text-xs font-semibold text-slate-400">{s.label}</span><s.icon className="text-cyan-400" size={19}/></div><div className="mt-4 text-3xl font-bold text-white">{s.count}</div><div className="mt-2 text-xs text-slate-500">{s.hint}</div></Card>)}
          </div>
          <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
            <Card><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold text-white">Gift event simulator</h2><p className="mt-1 text-xs text-slate-400">Use Browser preview for a draft, or Preview in engine to test the applied configuration safely.</p></div><span className="pill">LOCAL ONLY</span></div><div className="flex flex-col gap-3 sm:flex-row"><select className="field flex-1" value={simulationGift} onChange={e => setSimulationGift(e.target.value)}>{Array.from(new Set([...config.rules.map(r => r.giftName), 'Rose', 'Galaxy', 'Lion', 'Unmapped gift'])).map(g => <option key={g} value={g}>{g}</option>)}</select><button className="btn btn-ghost" onClick={simulate}><Zap size={16}/> Browser preview</button><button className="btn btn-primary" disabled={enginePreviewBusy || !agent || agent.customRulesMode !== 'preview' || !syncToken} onClick={() => void simulateInEngine()}><Activity size={16}/> {enginePreviewBusy ? 'Previewing...' : 'Preview in engine'}</button></div><p className="mt-3 text-xs text-slate-500">Engine preview uses the currently applied rules, not unsynced browser edits. Set the pairing token in Connections and enable Custom Preview in the old engine first. No RCON commands are sent.</p>{enginePreviewMessage && <p role="status" className="mt-3 text-sm text-emerald-300">{enginePreviewMessage}</p>}{enginePreviewError && <p role="alert" className="mt-3 text-sm text-rose-300">{enginePreviewError}</p>}<div className="mt-5 space-y-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Recent simulations</h3>{previews.length ? previews.map((p, i) => <div key={`${p.time}-${i}`} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-[#0a1524] p-3"><span className={`h-2 w-2 shrink-0 rounded-full ${p.status === 'matched' ? 'bg-emerald-400' : 'bg-slate-500'}`}/><div className="min-w-0 flex-1"><p className="truncate text-sm text-slate-200">{p.gift} <span className="text-slate-500">→</span> {p.detail}</p></div><span className="text-xs text-slate-500">{p.time}</span></div>) : <div className="rounded-lg border border-dashed border-slate-700 py-9 text-center text-sm text-slate-500">No simulations yet. Choose a gift to preview its rule.</div>}</div></Card>
            <div className="space-y-6"><Card><div className="mb-4 flex items-center gap-3"><IconCircle><Activity size={20}/></IconCircle><div><h2 className="font-semibold text-white">System status</h2><p className="text-xs text-slate-500">Development environment</p></div></div>{[['Cloud account', 'Not configured'], ['Streamer.bot bridge', agent?.bridgeOnline ? 'Recently active' : 'Not detected'], ['Local engine', agent ? 'Detected (read only)' : 'Offline'], ['Custom gift rules', agent?.customRulesMode ?? 'Unknown']].map(([a,b]) => <div key={a} className="flex justify-between gap-3 border-t border-slate-800 py-3 text-xs"><span className="text-slate-400">{a}</span><span className="text-amber-300">{b}</span></div>)}<button className="btn btn-ghost mt-3 w-full" onClick={() => changePage('connections')}>View connections <ArrowRight size={15}/></button></Card><Card><div className="flex items-center gap-3"><IconCircle><ShieldCheck size={20}/></IconCircle><h2 className="font-semibold text-white">Safe by design</h2></div><p className="mt-3 text-sm leading-6 text-slate-400">Live activity is read-only. Configuration sync requires explicit validation and approval. RCON credentials stay inside your local engine.</p></Card></div>
          </div>
        </>}
        {page === 'rules' && <>
          <SectionTitle title="Gift rules" subtitle="Choose what each TikTok gift should trigger in ARK. No live actions are sent yet." extra={<button className="btn btn-primary" onClick={() => { const id = newId(); update({ rules: [...config.rules, { id, giftName: 'New gift', giftId: '', enabled: true, action: defaultAction() }] }); setRuleOpen(id); }}><Plus size={16}/> Add rule</button>}/>
          <div className="space-y-3">{config.rules.length === 0 && <Card>No gift rules configured. Add your first rule above.</Card>}{config.rules.map(rule => <Card key={rule.id} className="!p-0 overflow-hidden"><div className="flex flex-wrap items-center gap-3 p-4 md:p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-300"><Gift size={20}/></div><div className="min-w-0 flex-1"><h3 className="font-semibold text-white">{rule.giftName || 'Unnamed gift'}</h3><p className="mt-1 text-xs text-slate-400">{displayAction(rule.action, config.kits)} {rule.giftId ? `· Gift ID ${rule.giftId}` : '· Name match (local preview)'}</p></div><label className="flex cursor-pointer items-center gap-2 text-xs text-slate-400"><input type="checkbox" checked={rule.enabled} onChange={e => updateRule(rule.id, { enabled: e.target.checked })} className="accent-emerald-500"/> Enabled</label><button className="btn btn-ghost" onClick={() => setRuleOpen(ruleOpen === rule.id ? null : rule.id)}>Edit {ruleOpen === rule.id ? <ChevronDown className="rotate-180" size={16}/> : <ChevronDown size={16}/>}</button><button className="rounded-lg p-2 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400" aria-label={`Delete ${rule.giftName}`} onClick={() => { if (window.confirm(`Delete the rule for ${rule.giftName}?`)) update({ rules: config.rules.filter(r => r.id !== rule.id) }); }}><Trash2 size={17}/></button></div>{ruleOpen === rule.id && <div className="border-t border-slate-700 bg-[#0c1828] p-5"><div className="mb-5 grid gap-4 sm:grid-cols-2"><div><Label>Gift name</Label><input className="field" maxLength={120} value={rule.giftName} onChange={e => updateRule(rule.id, { giftName: e.target.value })}/></div><div><Label>TikTok gift ID (optional; for future integration)</Label><input className="field" maxLength={100} value={rule.giftId} onChange={e => updateRule(rule.id, { giftId: e.target.value })} placeholder="Gift ID when available"/></div></div><ActionEditor value={rule.action} onChange={action => updateRule(rule.id, { action })} kits={config.kits}/><div className="mt-5 flex justify-end"><button className="btn btn-ghost" onClick={() => setRuleOpen(null)}><Check size={15}/> Done editing</button></div></div>}</Card>)}</div>
          <div className="mt-5 rounded-xl border border-cyan-900 bg-cyan-950/30 p-4 text-xs leading-5 text-cyan-200">Matching in this prototype uses gift names only. Gift IDs, region-specific catalogs, streak handling, and duplicate-event protection will be implemented in the connected agent.</div>
        </>}
        {page === 'kits' && <>
          <SectionTitle title="Kit builder" subtitle="Create bundles containing multiple items and dinosaurs. Kits cannot contain other kits." extra={<button className="btn btn-primary" onClick={() => { const id = newId(); update({ kits: [...config.kits, { id, name: 'New kit', description: '', entries: [] }] }); setKitOpen(id); }}><Plus size={16}/> Create kit</button>}/>
          <div className="grid gap-5 xl:grid-cols-2">{config.kits.length === 0 && <Card>No kits yet. Create a kit to get started.</Card>}{config.kits.map(kit => <Card key={kit.id} className="h-fit"><div className="flex items-start gap-3"><IconCircle><Boxes size={20}/></IconCircle><div className="min-w-0 flex-1"><h3 className="font-semibold text-white">{kit.name}</h3><p className="mt-1 text-xs text-slate-400">{kit.entries.length} entries · {kit.description || 'No description'}</p></div><button className="btn btn-ghost" onClick={() => setKitOpen(kitOpen === kit.id ? null : kit.id)}>{kitOpen === kit.id ? 'Close' : 'Edit'}</button><button className="rounded-lg p-2 text-slate-500 hover:text-rose-400" aria-label={`Delete ${kit.name}`} onClick={() => { if (window.confirm(`Delete ${kit.name}? Rules referencing it will need updating.`)) update({ kits: config.kits.filter(k => k.id !== kit.id) }); }}><Trash2 size={17}/></button></div><div className="mt-4 space-y-2">{kit.entries.map(entry => <div key={entry.id} className="rounded-lg bg-[#0a1524] px-3 py-2 text-xs text-slate-300">{displayAction(entry.action, config.kits)}</div>)}{!kit.entries.length && <p className="rounded-lg border border-dashed border-slate-700 p-4 text-xs text-slate-500">This kit is empty.</p>}</div>{kitOpen === kit.id && <div className="mt-5 space-y-5 border-t border-slate-700 pt-5"><div><Label>Kit name</Label><input className="field" maxLength={120} value={kit.name} onChange={e => updateKit(kit.id, { name: e.target.value })}/></div><div><Label>Description</Label><textarea className="field" rows={2} maxLength={500} value={kit.description} onChange={e => updateKit(kit.id, { description: e.target.value })}/></div>{kit.entries.map((entry, idx) => <div key={entry.id} className="rounded-xl border border-slate-700 bg-[#0a1524] p-4"><div className="mb-4 flex justify-between"><span className="text-xs font-semibold text-slate-300">Entry {idx + 1}</span><button aria-label="Remove kit entry" className="text-rose-400" onClick={() => updateKit(kit.id, { entries: kit.entries.filter(e => e.id !== entry.id) })}><Trash2 size={16}/></button></div><ActionEditor allowKit={false} kits={config.kits} value={entry.action} onChange={action => updateEntry(kit, entry.id, action)}/></div>)}<button className="btn btn-ghost w-full" onClick={() => updateKit(kit.id, { entries: [...kit.entries, { id: newId(), action: defaultAction('item') }] })}><Plus size={16}/> Add item or dinosaur</button></div>}</Card>)}</div>
        </>}
        {page === 'catalog' && <>
          <SectionTitle title="ARK catalog" subtitle="Browse our imported content data. Blueprint paths are candidate references, not server-verified." extra={<span className="pill">{catalog.dinosaurs.length} creatures · {catalog.items.length} items</span>}/>
          <div className="mb-5 flex flex-col gap-3 md:flex-row"><div className="flex gap-2"><button className={`btn ${kind === 'dinosaurs' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setKind('dinosaurs'); setCategory('all'); }}>Dinosaurs</button><button className={`btn ${kind === 'items' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => { setKind('items'); setCategory('all'); }}>Items</button></div><div className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-500" size={17}/><input className="field !pl-10" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search catalog..."/></div><div className="relative md:w-56"><SlidersHorizontal size={17} className="absolute left-3 top-3 text-slate-500"/><select className="field !pl-10" value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div></div>
          <div className="mb-4 text-xs text-slate-500">Showing {filteredEntries.length} of {entries.length} entries</div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filteredEntries.map(entry => <div key={entry.id} className="panel p-4"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-lg bg-cyan-500/10 p-2 text-cyan-300">{kind === 'dinosaurs' ? <Gamepad2 size={19}/> : <Layers3 size={19}/>}</div><div><h3 className="text-sm font-semibold text-white">{entry.name}</h3><p className="mt-1 text-xs text-slate-500">{entry.category}</p></div></div><span className="text-[10px] font-medium text-amber-400">Unverified</span></div><div className="mt-4 flex flex-wrap gap-1.5">{entry.tags.slice(0, 3).map(t => <span key={t} className="pill">{t}</span>)}</div><p className="mt-3 truncate font-mono text-[10px] text-slate-500" title={entry.blueprint}>{entry.blueprint || 'No candidate path'}</p></div>)}</div>{!filteredEntries.length && <Card>No entries match your search.</Card>}
        </>}
        {page === 'connections' && <>
          <SectionTitle title="Local agent connection" subtitle="Monitor recent gift and RCON activity, and sync approved configuration. No RCON commands are sent from this page." extra={<span className={`pill ${agent ? '!text-emerald-300' : '!text-amber-300'}`}>{agent ? 'Engine detected' : 'Not connected'}</span>}/>
          <Card className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="flex items-center gap-2 text-lg font-semibold text-white"><ShieldCheck size={20} className="text-cyan-300"/> Local readiness</h2><p className="mt-1 text-xs text-slate-400">One place to check startup, pairing and preview safety. These checks do not activate live processing.</p></div>
              <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${checksPassed === localChecks.length ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>{localReadiness} · {checksPassed}/{localChecks.length}</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">{localChecks.map(c => <div key={c.label} className="flex items-start gap-3 rounded-xl border border-slate-800 bg-[#0a1524] p-4"><span className={`mt-0.5 ${c.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{c.ok ? <Check size={17}/> : <ShieldAlert size={17}/>}</span><div><p className="text-sm font-medium text-white">{c.label}</p><p className="mt-1 text-xs leading-5 text-slate-400">{c.detail}</p></div></div>)}</div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4 text-xs text-slate-400"><span>{lastEngineSeen ? `Last successful engine check: ${new Date(lastEngineSeen).toLocaleTimeString()}` : 'No successful engine check this session'}</span><span>·</span><span>Auto-refresh every 5 seconds</span></div>
            {!agent && <p role="alert" className="mt-3 text-xs text-amber-200">Engine unavailable: {agentError || 'Check ports 3210 and 3212 and the local dashboard proxy.'}</p>}
            <p className="mt-3 text-xs text-slate-500">A token being present is not proof of successful pairing. To verify it, use a token-protected operation such as Compare configuration. RCON success requires separate in-game verification.</p>
          </Card>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card><div className="flex items-start justify-between"><IconCircle><Monitor size={20}/></IconCircle><span className="pill">READ ONLY</span></div><h2 className="mt-5 text-lg font-semibold text-white">Windows companion engine</h2><p className="mt-2 text-sm text-slate-400">{agent ? agent.engineStatus : 'No running local engine detected.'}</p>
              <div className="mt-5 space-y-3">{[
                ['Engine', agent ? 'Running' : 'Offline'],
                ['Gift processing mode', agent?.customRulesMode ?? 'Unavailable'],
                ['Experimental RCON gift lane', agent?.giftRconMode ?? 'Unavailable'],
                ['Legacy rewards armed', agent ? (agent.armState ? 'Yes' : 'No') : 'Unknown'],
                ['Streamer.bot heartbeat', agent ? (agent.bridgeOnline ? 'Recent' : 'No recent heartbeat') : 'Unknown'],
                ['Pending legacy commands', agent ? String(agent.pending) : 'Unknown'],
                ['Queued custom commands', agent ? String(agent.customQueued) : 'Unknown'],
                ['Custom RCON in-flight', agent ? (agent.customInflight ? 'Yes' : 'No') : 'Unknown'],
              ].map(([key,val]) => <div key={key} className="flex justify-between gap-3 border-t border-slate-800 pt-3 text-sm"><span className="text-slate-400">{key}</span><span className="text-right text-slate-200">{val}</span></div>)}</div>
              <p className="mt-5 text-xs text-slate-500">{checkingAgent ? 'Checking agent...' : agent ? `Last checked: ${new Date(agent.checkedAt).toLocaleTimeString()}` : `Connection detail: ${agentError || 'Not checked'}`}</p>
            </Card>
            <Card><div className="flex items-center gap-3"><IconCircle><Settings2 size={20}/></IconCircle><h2 className="font-semibold text-white">How to connect locally</h2></div>
              <ol className="mt-5 list-inside list-decimal space-y-3 text-sm leading-6 text-slate-300">
                <li>Start the existing Ice Pack engine on this Windows PC at <code className="text-cyan-300">127.0.0.1:3210</code>.</li>
                <li>Run <code className="text-cyan-300">node agent-bridge/bridge.mjs</code> from the companion folder.</li>
                <li>Run <code className="text-cyan-300">npm run dev -- --port 5173 --strictPort</code> for this dashboard.</li>
                <li>This screen refreshes automatically every five seconds.</li>
              </ol>
              <div className="mt-5 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">Status is read-only. Configuration sync requires an explicit local pairing token, preview, and confirmation; live ARK commands are never enabled by sync. Never expose the bridge to your network or cloud hosting.</div>
            </Card>
          </div>
          <Card className="mt-6">
            <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-lg font-semibold text-white">Engine controls</h2><span className="pill">LOCAL / TOKEN REQUIRED</span></div>
            <p className="text-sm text-slate-400">Start or stop preview from Northpath. This interface cannot enable Live mode. Emergency Stop disables all engine gift lanes and clears queued work; already-sent RCON cannot be recalled.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="btn btn-primary" disabled={controlBusy||!agent||!syncToken||!agent.customRulesLoaded||agent.customRulesMode!=='off'||agent.armState||agent.giftRconMode!=='off'||agent.pending>0||agent.customQueued>0||agent.customInflight} onClick={()=>void runControl('start-preview')}><Activity size={16}/> Start Preview</button>
              <button className="btn btn-ghost" disabled={controlBusy||!agent||!syncToken||agent.customRulesMode!=='preview'} onClick={()=>void runControl('stop-preview')}><X size={16}/> Stop Preview</button>
              <button className="btn btn-danger" disabled={controlBusy||!agent||!syncToken} onClick={()=>void runControl('emergency-stop')}><ShieldAlert size={16}/> Emergency Stop</button>
            </div>
            {controlMessage&&<p role="status" className="mt-3 text-sm text-emerald-300">{controlMessage}</p>}
            {controlError&&<p role="alert" className="mt-3 text-sm text-rose-300">{controlError}</p>}
            <p className="mt-3 text-xs text-slate-500">Current mode: {agent?.customRulesMode??'Unknown'} · Legacy: {agent?.armState?'Armed':'Disarmed'} · Experimental lane: {agent?.giftRconMode??'Unknown'} · Pending: {agent?.pending??'—'} + {agent?.customQueued??'—'} custom</p>
          </Card>
          <Card className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-white">Configuration sync</h2><span className="pill">Manual approval only</span></div>
            <p className="mb-4 text-sm text-slate-400">Converts this browser's rules and Kits to the engine's version-2 format. The bridge checks them against your actual saved ARK catalog, creates a backup, writes the config, and reloads the engine. It never starts live gifts.</p>
            <div className="max-w-xl"><Label>Local pairing token (shown in bridge PowerShell window)</Label><input className="field" type="password" autoComplete="off" value={syncToken} onChange={e=>{setSyncToken(e.target.value);setSyncPreview(null);}} placeholder="Paste token from bridge terminal" /></div>
            <div className="mt-4 flex flex-wrap gap-3"><button className="btn btn-ghost" disabled={syncBusy||!agent||!syncToken} onClick={()=>void previewSync()}><ShieldCheck size={16}/> Validate &amp; preview</button><button className="btn btn-primary" disabled={syncBusy||!syncPreview||syncPreview.draftJson!==JSON.stringify(config)||!agent} onClick={()=>void applySync()}><Check size={16}/> Apply approved configuration</button></div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4"><button className="btn btn-ghost" disabled={!agent||!syncToken||compareBusy} onClick={()=>void compareConfig()}><ShieldCheck size={16}/> Compare browser draft with applied file</button>{compareBusy&&<span className="text-xs text-slate-400">Comparing...</span>}</div>
            {compareResult&&<p role="status" className={`mt-3 text-sm ${compareResult.match&&compareResult.loaded?'text-emerald-300':'text-amber-300'}`}>{compareResult.match ? (compareResult.loaded ? 'Browser draft matches the applied configuration file; engine reports rules loaded.' : 'Browser draft matches saved file, but engine does not report rules loaded.') : (compareResult.reason??'Browser draft differs from the applied configuration file. Preview and apply if you want to sync.') } <span className="block text-xs text-slate-500">File comparison does not prove engine memory is identical.</span></p>}
            {compareError&&<p role="alert" className="mt-3 text-sm text-rose-300">{compareError}</p>}
            {syncMessage&&<p className="mt-4 text-sm text-emerald-300">{syncMessage}</p>}
            {syncError&&<p role="alert" className="mt-4 text-sm text-red-300">{syncError}</p>}
            {syncPreview&&<div className="mt-4 rounded-lg border border-cyan-500/25 bg-cyan-500/5 p-4"><p className="font-semibold text-white">Ready for confirmation: {syncPreview.ruleCount} rules, {syncPreview.kitCount} Kits</p><p className="mt-1 font-mono text-xs text-slate-400">SHA-256: {syncPreview.hash}</p><p className="mt-2 text-xs text-amber-300">Preview expires after 2 minutes. Engine mode: {syncPreview.engineMode}. All live lanes must remain off.</p>{syncPreview.warnings.length>0&&<div className="mt-3"><p className="text-sm font-semibold text-amber-300">Not supported for live execution yet:</p><ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-200">{syncPreview.warnings.map((w,i)=><li key={i}>{w}</li>)}</ul></div>}</div>}
          </Card>
          <div className="mt-6"><TargetPanel token={syncToken} engineOnline={Boolean(agent?.engineOnline)} /></div>
          <DriftPanel syncToken={syncToken} draft={config} onValidatePreview={()=>void previewSync()} validateBusy={syncBusy} onOpenRecovery={()=>changePage('recovery')} />
          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <Card><div className="flex items-center justify-between"><h2 className="font-semibold text-white">Agent-loaded rules</h2><span className="pill">Engine source</span></div><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-lg bg-[#0a1524] p-4"><p className="text-xs text-slate-400">Gift rules</p><p className="mt-2 text-3xl font-bold text-white">{agent?.customRulesLoaded ? agent.customRuleCount : '—'}</p></div><div className="rounded-lg bg-[#0a1524] p-4"><p className="text-xs text-slate-400">Kits</p><p className="mt-2 text-3xl font-bold text-white">{agent?.customRulesLoaded ? agent.customKitCount : '—'}</p></div></div><p className="mt-4 text-xs text-slate-500">Counts reflect the engine's currently loaded configuration, not this browser's draft.</p></Card>
            <Card><div className="flex items-center justify-between gap-2"><h2 className="font-semibold text-white">Recent engine activity</h2><span className="pill">LIVE LOG · READ ONLY</span></div><p className="mt-2 text-xs text-slate-500">Latest matching engine entries, refreshed every five seconds. RCON sent does not prove in-game delivery.</p><div className="mt-3"><Label>Filter activity</Label><select className="field" value={activityFilter} onChange={e=>setActivityFilter(e.target.value)}><option value="all">All activity</option><option value="gifts">Gifts & rules</option><option value="previews">Previews</option><option value="rcon">RCON activity</option><option value="errors">Errors & blocks</option></select></div><div className="mt-4 max-h-72 space-y-2 overflow-auto">{agent?.recentLogs.filter(l=>activityFilter==='all'||(l.category??'other')===activityFilter).length ? agent.recentLogs.filter(l=>activityFilter==='all'||(l.category??'other')===activityFilter).map((l,i) => <div key={i} className="rounded-lg bg-[#0a1524] p-3 text-xs"><span className="text-slate-500">{l.time} · {l.category??'other'}</span><p className="mt-1 break-words text-slate-300">{l.message}</p></div>) : <p className="text-sm text-slate-500">No matching activity in the latest log window.</p>}</div></Card>
          </div>
        </>}
        {page === 'recovery' && <RecoveryPanel syncToken={syncToken} />}
        {page === 'settings' && <>
          <SectionTitle title="Settings" subtitle="Manage local workspace details and your configuration backup."/>
          <div className="grid gap-6 xl:grid-cols-2"><Card><h2 className="mb-5 font-semibold text-white">Workspace preferences</h2><div className="space-y-4"><div><Label>Server nickname</Label><input className="field" maxLength={100} value={config.serverName} onChange={e => update({ serverName: e.target.value })}/></div><div><Label>Player targeting</Label><p className="text-sm text-slate-300">The authoritative Specimen Implant ID is now managed under <strong>Connections → Engine Player Target</strong>. This browser-only workspace field is not used to target live ARK rewards.</p></div><div><Label>Preferred gift region</Label><select className="field" value={config.preferredRegion} onChange={e => update({ preferredRegion: e.target.value })}><option value="US">United States</option><option value="GB">United Kingdom</option><option value="CA">Canada</option><option value="Other">Other / undecided</option></select></div></div></Card><Card><h2 className="mb-2 font-semibold text-white">Configuration backup</h2><p className="mb-5 text-sm text-slate-400">Rules and kits live in this browser's local storage. Export JSON before clearing browser data or switching devices.</p><div className="flex flex-wrap gap-3"><button className="btn btn-primary" onClick={exportConfig}><Download size={16}/> Export JSON</button><button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={16}/> Import JSON</button><input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importConfig}/></div><div className="mt-6 border-t border-slate-700 pt-5"><h3 className="mb-2 text-sm font-medium text-slate-200">Restore starter examples</h3><p className="mb-3 text-xs text-slate-500">Resets local kits and rules. Export first if you want to keep your work.</p><button className="btn btn-danger" onClick={() => { if (window.confirm('Replace all local settings with starter examples?')) { setSyncPreview(null); setCompareResult(null); setConfig(initial); setPreviews([]); setNotice('Starter configuration restored.'); } }}><RotateCcw size={16}/> Reset local data</button></div></Card></div>
        </>}
      </main>
      <footer className="border-t border-[#203249] px-5 py-5 text-center text-xs text-slate-500 md:px-8">ICE PACK COMPANION <span className="mx-2 text-slate-700">•</span> A NORTHPATH PRODUCT <span className="mx-2 text-slate-700">•</span> OFFLINE PROTOTYPE</footer>
    </div>
  </div>;
}
export default App;
