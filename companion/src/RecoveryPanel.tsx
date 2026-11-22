import {useCallback,useState} from 'react';
import {DatabaseBackup, RefreshCw, ShieldCheck, ShieldAlert} from 'lucide-react';
type Snapshot={name:string;createdUtc:string;files:string[];verified:boolean};
type Detail={key:string;changed:boolean;exists:boolean;saved:{ruleCount:number|null;kitCount:number|null;playerTargetConfigured:boolean}|null;current:{ruleCount:number|null;kitCount:number|null;playerTargetConfigured:boolean}|null};
type Comparison={name:string;createdUtc:string;files:Detail[]};
type AuditEvent={time:string;type:'config-apply'|'config-restore'|'target-update';status:'started'|'succeeded'|'failed';operationId:string;snapshot?:string};
type Props={syncToken:string};
export default function RecoveryPanel({syncToken}:Props){
 const [snapshots,setSnapshots]=useState<Snapshot[]>([]);
 const [events,setEvents]=useState<AuditEvent[]>([]);
 const [selected,setSelected]=useState('');
 const [comparison,setComparison]=useState<Comparison|null>(null);
 const [ticket,setTicket]=useState('');
 const [confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const request=useCallback(async(endpoint:string,payload:unknown)=>{
  const r=await fetch(`/api/agent/recovery/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json','x-icepack-sync-token':syncToken},body:JSON.stringify(payload)});
  const data=await r.json() as {ok?:boolean;error?:string;[key:string]:unknown};
  if(!r.ok||!data.ok)throw Error(data.error??`HTTP ${r.status}`);return data;
 },[syncToken]);
 const perform=async(task:()=>Promise<void>)=>{setBusy(true);setError('');setMessage('');try{await task();}catch(e){setError(e instanceof Error?e.message:'Operation failed');}finally{setBusy(false);}};
 const list=()=>perform(async()=>{const r=await request('list',{});setSnapshots(r.snapshots as Snapshot[]);const a=await request('audit',{});setEvents(a.events as AuditEvent[]);setComparison(null);setTicket('');setSelected('');});
 const inspect=(name:string)=>perform(async()=>{setSelected(name);setTicket('');setComparison(null);const r=await request('compare',{name});setComparison(r.comparison as Comparison);});
 const preview=()=>perform(async()=>{setTicket('');setConfirmation('');const r=await request('preview',{name:selected});setComparison(r.comparison as Comparison);setTicket(r.restoreToken as string);setMessage('Restore preview valid for 2 minutes. Stop the ARK engine before confirming.');});
 const restore=()=>perform(async()=>{
  if(!window.confirm(`Restore ${selected}? Your ARK engine MUST be stopped. A safety backup will be created first.`))return;
  const r=await request('restore',{name:selected,restoreToken:ticket,confirmation});
  setTicket('');setConfirmation('');setComparison(null);
  setMessage(`Restored on disk. Pre-restore safety snapshot: ${String(r.safetySnapshot)}. Restart the engine; Live mode remains off.`);
  const refreshed=await request('list',{});setSnapshots(refreshed.snapshots as Snapshot[]);const a=await request('audit',{});setEvents(a.events as AuditEvent[]);
 });
 return <div className="space-y-6">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold text-white md:text-3xl">Configuration recovery</h1><p className="mt-2 text-sm text-slate-400">Review verified snapshots, compare saved configuration, and restore safely through your local bridge.</p></div><button className="btn btn-primary" disabled={busy||!syncToken} onClick={list}><RefreshCw size={16}/> Refresh backups</button></div>
  {!syncToken&&<div className="panel border-amber-500/30 p-4 text-sm text-amber-300">Enter the current local bridge pairing token on Connections first.</div>}
  {error&&<div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</div>}
  {message&&<div role="status" className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-200">{message}</div>}
  <div className="grid gap-5 lg:grid-cols-[1fr_1.25fr]">
   <div className="panel p-5"><h2 className="flex items-center gap-2 font-semibold text-white"><DatabaseBackup size={19}/> Backup history</h2><p className="mt-1 text-xs text-slate-400">Up to 100 most recent snapshots. Invalid snapshots cannot be restored.</p>
    <div className="mt-4 space-y-2">{snapshots.length===0?<p className="text-sm text-slate-500">Click Refresh backups to load available snapshots.</p>:snapshots.map(s=><button type="button" disabled={busy||!s.verified} key={s.name} onClick={()=>inspect(s.name)} className={`w-full rounded-xl border p-3 text-left ${selected===s.name?'border-cyan-400 bg-cyan-500/10':'border-slate-700 bg-[#0a1524] hover:border-slate-500'} ${!s.verified?'opacity-60':''}`}><div className="flex items-center gap-2 text-xs font-semibold text-slate-200">{s.verified?<ShieldCheck className="text-emerald-400" size={15}/>:<ShieldAlert className="text-rose-400" size={15}/>} {s.name}</div><p className="mt-1 text-xs text-slate-400">{s.createdUtc?new Date(s.createdUtc).toLocaleString():'Unverified'} · {s.files.join(', ')||'Unavailable'}</p></button>)}</div>
   </div>
   <div className="panel p-5"><h2 className="font-semibold text-white">Compare & restore</h2>{!comparison?<p className="mt-4 text-sm text-slate-400">Select a verified snapshot to inspect differences from the current files.</p>:<><p className="mt-3 break-all text-xs text-slate-400">Snapshot: {comparison.name}</p><div className="mt-4 space-y-3">{comparison.files.map(f=><div key={f.key} className="rounded-lg border border-slate-700 bg-[#0a1524] p-3"><div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-white">{f.key==='legacy-rules'?'Legacy rules / player target':'Applied Kits & Gift Rules'}</span><span className={f.changed?'text-amber-300':'text-emerald-300'}>{f.changed?'Different':'Identical'}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400"><div>In snapshot<br/>Rules: {f.saved?.ruleCount??'—'} · Kits: {f.saved?.kitCount??'—'}{f.key==='legacy-rules'&&<div>Target configured: {f.saved?.playerTargetConfigured?'Yes':'No'}</div>}</div><div>Current file<br/>Rules: {f.current?.ruleCount??'—'} · Kits: {f.current?.kitCount??'—'}{f.key==='legacy-rules'&&<div>Target configured: {f.current?.playerTargetConfigured?'Yes':'No'}</div>}</div></div></div>)}</div><p className="mt-3 text-xs text-slate-500">Comparison is checksum and summary based; it does not reveal player IDs or secret values. It does not import the old configuration into the browser editor.</p>
    <button className="btn btn-ghost mt-4" disabled={busy} onClick={preview}>Preview restore</button>
    {ticket&&<div className="mt-4 space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><p className="text-sm text-amber-200">Stop the original ARK engine on port 3210. The bridge and Northpath dashboard must remain running. A fresh pre-restore backup is mandatory.</p><label className="block text-xs text-slate-300">Type RESTORE CONFIGURATION to confirm</label><input className="field" value={confirmation} onChange={e=>setConfirmation(e.target.value)} autoComplete="off" placeholder="RESTORE CONFIGURATION"/><button className="btn btn-primary" disabled={busy||confirmation!=='RESTORE CONFIGURATION'} onClick={restore}>Restore verified snapshot</button></div>}</> }</div>
  </div>
  <div className="panel p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold text-white">Configuration activity</h2><p className="text-xs text-slate-400">Local audit events · last 100 · no player IDs or secrets</p></div>
   {events.length===0?<p className="mt-3 text-sm text-slate-400">No recorded v1.6 applies or restores yet. Click Refresh backups after your next Apply.</p>:<div className="mt-3 max-h-80 space-y-2 overflow-auto">{events.map((e,i)=><div key={`${e.operationId}-${e.status}-${i}`} className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-700 bg-[#0a1524] p-3 text-xs"><div><span className="font-semibold text-white">{e.type==='config-apply'?'Apply configuration':e.type==='target-update'?'Update player target':'Restore configuration'}</span><span className={`ml-2 ${e.status==='failed'?'text-rose-300':e.status==='succeeded'?'text-emerald-300':'text-amber-300'}`}>{e.status}</span><div className="mt-1 break-all text-slate-400">Snapshot: {e.snapshot??'—'}</div></div><div className="text-slate-400">{new Date(e.time).toLocaleString()}</div></div>)}</div>}
  </div>
 </div>;
}
