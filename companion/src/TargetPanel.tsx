import {useCallback,useEffect,useState} from 'react';
import {CheckCircle2,ShieldCheck,RefreshCw,AlertTriangle} from 'lucide-react';
type Target={playerId:string|null;configured:boolean;laneConfigured:boolean;mode:string};
type Props={token:string;engineOnline:boolean;onSaved?:()=>void};
export default function TargetPanel({token,engineOnline,onSaved}:Props){
 const [target,setTarget]=useState<Target|null>(null);
 const [draft,setDraft]=useState('');
 const [editing,setEditing]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const load=useCallback(async()=>{
  if(!token||!engineOnline)return;
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/agent/target/read',{method:'POST',headers:{'Content-Type':'application/json','x-icepack-sync-token':token},body:'{}'});
   const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'Cannot read engine target');
   setTarget(data.target);if(!editing)setDraft(data.target.playerId??'');
  }catch(e){setError(e instanceof Error?e.message:'Cannot read target');}
  finally{setBusy(false);}
 },[token,engineOnline,editing]);
 useEffect(()=>{setTarget(null);setEditing(false);setDraft('');setMessage('');},[token]);
 useEffect(()=>{void load();},[load]);
 const valid=/^\d{1,10}$/.test(draft)&&Number(draft)>0&&Number(draft)<=4294967295;
 const save=async()=>{
  if(!valid||!window.confirm('Save this target to the original ARK engine? A configuration recovery snapshot will be created first. All gift lanes must be Off.'))return;
  setBusy(true);setError('');setMessage('');
  try {
   const r=await fetch('/api/agent/target/save',{method:'POST',headers:{'Content-Type':'application/json','x-icepack-sync-token':token},body:JSON.stringify({playerId:draft})});
   const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||'Target save failed');
   setTarget(data.target);setDraft(data.target.playerId??'');setEditing(false);
   setMessage(`Saved and read back from engine. Recovery snapshot: ${data.recoverySnapshot}.`);onSaved?.();
  }catch(e){setError(e instanceof Error?e.message:'Target save failed');}
  finally{setBusy(false);}
 };
 return <section className="rounded-xl border border-slate-700 bg-[#14263a] p-5">
  <div className="flex flex-wrap items-center gap-2"><ShieldCheck size={20} className="text-cyan-300"/><h2 className="font-semibold text-white">Engine Player Target</h2><span className="rounded-full border border-slate-600 px-2 py-1 text-xs text-slate-300">Engine source of truth</span></div>
  <p className="mt-2 text-sm text-slate-400">Manage your saved Specimen Implant ID here. This is read directly from the original engine, not from browser storage. Saving creates a protected snapshot and never enables Live rewards.</p>
  {!token?<p className="mt-4 text-sm text-amber-300">Enter the bridge pairing token in Configuration sync first.</p>:!engineOnline?<p className="mt-4 text-sm text-amber-300">Start the original engine to view or update the saved target.</p>:<>
   <div className="mt-4 flex items-center gap-2 text-sm">{target?.configured&&target.laneConfigured?<><CheckCircle2 size={16} className="text-emerald-300"/><span className="text-emerald-300">Saved and loaded by the engine</span></>:<><AlertTriangle size={16} className="text-amber-300"/><span className="text-amber-300">Target missing or not loaded</span></>}</div>
   <label className="mt-4 block text-xs text-slate-300" htmlFor="enginePlayerTarget">Specimen Implant ID</label>
   <input id="enginePlayerTarget" className="field mt-1 w-full max-w-md" inputMode="numeric" maxLength={10} value={editing?draft:(target?.playerId??'')} readOnly={!editing} onChange={e=>setDraft(e.target.value)} placeholder="Numeric Specimen Implant ID"/>
   <div className="mt-3 flex flex-wrap gap-2"><button className="btn btn-ghost" disabled={busy} onClick={()=>void load()}><RefreshCw size={16}/> Refresh from engine</button>{!editing?<button className="btn btn-primary" disabled={busy||!target} onClick={()=>{setDraft(target?.playerId??'');setEditing(true);setMessage('');}}>Change target</button>:<><button className="btn btn-primary" disabled={busy||!valid} onClick={()=>void save()}>Save to engine</button><button className="btn btn-ghost" disabled={busy} onClick={()=>{setEditing(false);setDraft(target?.playerId??'');}}>Cancel</button></>}</div>
   {editing&&<p className="mt-2 text-xs text-amber-300">Before saving, turn Custom Rules, legacy rewards, and experimental rewards Off and clear pending work.</p>}
   {message&&<p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}
   {error&&<p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
  </>}
 </section>;
}
