import {useCallback,useEffect,useState} from 'react';
import {RefreshCw,ShieldAlert,ShieldCheck,ArrowRight} from 'lucide-react';
import {getReconciliationGuide} from './reconciliation.mjs';

type Summary={ruleCount:number|null;kitCount:number|null};
type Drift={
 status:'not-applied'|'draft-differs'|'engine-attention'|'counts-match'|'unverified';
 draftMatchesApplied:boolean|null;
 engineAgreement:'unknown'|'not-loaded'|'count-mismatch'|'counts-match';
 reason:string;appliedPresent:boolean;draft:Summary;applied:Summary;
 engine:{online:boolean;loaded:boolean;mode:string;ruleCount:number|null;kitCount:number|null};
 checkedAt:string;note:string;
};
type Props={syncToken:string;draft:unknown;onValidatePreview:()=>void;validateBusy:boolean;onOpenRecovery:()=>void};
const names:Record<Drift['status'],string>={
 'not-applied':'No applied configuration','draft-differs':'Unapplied browser changes',
 'engine-attention':'Engine requires attention','counts-match':'Counts agree — content unverified',
 'unverified':'Engine agreement unverified'
};
export default function DriftPanel({syncToken,draft,onValidatePreview,validateBusy,onOpenRecovery}:Props){
 const [result,setResult]=useState<Drift|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [lastDraft,setLastDraft]=useState('');
 const draftKey=JSON.stringify(draft);
 const check=useCallback(async(signal?:AbortSignal)=>{
  if(!syncToken)return;
  setBusy(true);
  try{
   const response=await fetch('/api/agent/sync/drift',{method:'POST',headers:{'Content-Type':'application/json','x-icepack-sync-token':syncToken},body:draftKey,signal});
   const data=await response.json() as {ok?:boolean;error?:string;drift?:Drift};
   if(!response.ok||!data.ok||!data.drift)throw Error(data.error||`Drift check failed (${response.status})`);
   if(!signal?.aborted){setResult(data.drift);setLastDraft(draftKey);setError('');}
  }catch(e){if(!signal?.aborted){setResult(null);setError(e instanceof Error?e.message:'Drift check failed');}}
  finally{if(!signal?.aborted)setBusy(false);}
 },[syncToken,draftKey]);
 useEffect(()=>{
  setResult(null);setLastDraft('');setError('');
  if(!syncToken)return;
  const controller=new AbortController();
  void check(controller.signal);
  const id=window.setInterval(()=>void check(controller.signal),15000);
  return()=>{window.clearInterval(id);controller.abort();};
 },[check,syncToken]);
 const stale=lastDraft!==draftKey;
 const attention=result&&result.status!=='counts-match';
 return <section className="panel mt-6 p-5 md:p-6" aria-label="Configuration drift">
  <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-white">Configuration synchronization</h2><p className="mt-1 text-sm text-slate-400">Read-only comparison: browser draft → applied file → engine-reported counts.</p></div><button className="btn btn-ghost" disabled={busy||!syncToken} onClick={()=>void check()}><RefreshCw size={16}/>{busy?'Checking…':'Check now'}</button></div>
  {!syncToken?<p className="mt-4 text-sm text-amber-300">Enter the pairing token above to check synchronization.</p>:error?<p role="alert" className="mt-4 text-sm text-rose-300">{error}</p>:(!result||stale)?<p className="mt-4 text-sm text-slate-400">Checking the current draft and engine…</p>:<>
   <div className={`mt-4 flex items-center gap-2 text-sm font-semibold ${attention?'text-amber-300':'text-cyan-300'}`}>{attention?<ShieldAlert size={18}/>:<ShieldCheck size={18}/>} {names[result.status]}</div>
   <div className="mt-4 grid gap-3 sm:grid-cols-3">
    <div className="rounded-lg border border-slate-700 bg-[#0a1524] p-3"><div className="text-xs text-slate-400">Browser draft</div><div className="mt-2 text-sm text-white">{result.draft.ruleCount} rules · {result.draft.kitCount} Kits</div><div className="mt-1 text-xs text-slate-400">{result.draftMatchesApplied===true?'Matches file':result.draftMatchesApplied===false?'Different from file':'No applied file'}</div></div>
    <div className="rounded-lg border border-slate-700 bg-[#0a1524] p-3"><div className="text-xs text-slate-400">Applied file</div><div className="mt-2 text-sm text-white">{result.appliedPresent?`${result.applied.ruleCount} rules · ${result.applied.kitCount} Kits`:'Not found'}</div><div className="mt-1 text-xs text-slate-400">Saved on disk</div></div>
    <div className="rounded-lg border border-slate-700 bg-[#0a1524] p-3"><div className="text-xs text-slate-400">Running engine</div><div className="mt-2 text-sm text-white">{result.engine.online?`${result.engine.ruleCount} rules · ${result.engine.kitCount} Kits`:'Offline'}</div><div className="mt-1 text-xs text-slate-400">{result.engine.loaded?`Loaded · ${result.engine.mode}`:'Not confirmed loaded'}</div></div>
   </div>
   <p className="mt-3 text-sm text-slate-300">{result.reason}</p>
   {(() => {
     const guide=getReconciliationGuide(result);
     return <div className="mt-4 rounded-xl border border-slate-700 bg-[#0b1a2a] p-4" aria-label="Guided reconciliation">
       <h3 className="font-semibold text-white">Guided reconciliation</h3>
       <p className="mt-1 text-sm text-slate-300">{guide.summary}</p>
       <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-slate-300">{guide.steps.map(step=><li key={step}>{step}</li>)}</ol>
       <div className="mt-4 flex flex-wrap gap-2">
         {guide.action==='preview' && <button type="button" className="btn btn-primary" disabled={validateBusy||busy||!syncToken} onClick={onValidatePreview}><ShieldCheck size={16}/>{validateBusy?'Validating…':'Validate & preview draft'}</button>}
         {guide.showRecovery && <button type="button" className="btn btn-ghost" onClick={onOpenRecovery}><ArrowRight size={16}/>Open Recovery</button>}
         <button type="button" className="btn btn-ghost" disabled={busy} onClick={()=>void check()}><RefreshCw size={16}/>Recheck status</button>
       </div>
       <p className="mt-3 text-xs text-slate-500">This guide never applies, reloads, restores, or enables Live. Applying still requires the separate preview, confirmation, and protected backup workflow above.</p>
     </div>;
   })()}
   <p className="mt-2 text-xs text-slate-500">Matching counts are not proof the engine has the identical rule content. Last checked: {new Date(result.checkedAt).toLocaleTimeString()}. Rechecks every 15 seconds. This panel never applies changes or enables Live mode.</p>
  </>}
 </section>;
}
