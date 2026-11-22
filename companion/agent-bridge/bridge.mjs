// Northpath Ice Pack Companion bridge: loopback-only status and explicitly authorized configuration sync.
// This bridge never exposes a generic command endpoint and never sends RCON.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readJsonBody,getCatalog,convertDashboard,hashConfig,safeToApply,atomicApply } from './sync.mjs';
import { validateGiftRequest,assertPreviewOnly } from './preview-safety.mjs';
import { validateControl, activityCategory } from './controls.mjs';
import {resolveBackupPaths,snapshotBeforeApply} from './protected-apply.mjs';
import {listSnapshots,compareSnapshot,restoreSnapshot} from './recovery.mjs';
import {appendAudit,readAudit,newOperationId} from './audit.mjs';
import {assessDrift} from './drift.mjs';
import {validateTargetId,getEngineTarget,assertTargetSaveSafe} from './target.mjs';
import net from 'node:net';
import { previewDashboardDraft } from './draft-preview.mjs';
const HOST='127.0.0.1',PORT=3212, ENGINE_URL='http://127.0.0.1:3210';
const KIT_DIR=process.env.ICEPACK_KIT_DIR ? path.resolve(process.env.ICEPACK_KIT_DIR) : null;
// Managed Windows startup supplies a fresh random token through the process environment.
// Manual bridge startup retains the original terminal pairing workflow.
const managedToken=process.env.ICEPACK_BRIDGE_PAIRING_TOKEN;
const standalonePreview=Boolean(managedToken)&&process.env.ICEPACK_ALPHA_PREVIEW==='1';
if(managedToken!==undefined&&!/^[0-9a-f]{48}$/.test(managedToken))throw Error('Invalid managed bridge pairing token');
const TOKEN=managedToken??crypto.randomBytes(24).toString('hex');
const permittedOrigins=new Set(standalonePreview
  ? ['http://127.0.0.1:5174']
  : ['http://127.0.0.1:5173','http://localhost:5173']);
const draftCatalog=standalonePreview
  ? JSON.parse(fs.readFileSync(new URL('../src/catalog.json',import.meta.url),'utf8'))
  : null;
const previews=new Map();
let controlling=false;
let applying=false;
let restoring=false;
let savingTarget=false;
const restorePreviews=new Map();
async function enginePortListening(){return new Promise(resolve=>{const c=net.connect({host:'127.0.0.1',port:3210});let done=false;const finish=v=>{if(!done){done=true;c.destroy();resolve(v);}};c.once('connect',()=>finish(true));c.once('error',()=>finish(false));c.setTimeout(1200,()=>finish(true));});}
// Show only a small, redacted window of recent local engine activity.
// Do not relay arbitrary engine state, environment values or any RCON credentials.
function safeActivity(logs){
 if(!Array.isArray(logs)) return [];
 return logs.slice(0,40).flatMap(entry=>{
   if(!entry||typeof entry!=='object'||typeof entry.message!=='string')return [];
   const time=typeof entry.time==='string'?entry.time.slice(0,30):'';
   let message=entry.message.slice(0,700)
     .replace(/(RCON_PASSWORD|PASSWORD|TOKEN|SECRET|API_KEY)\s*[:=]\s*[^\s,;]+/gi,'$1=[REDACTED]')
     .replace(/(password|token|secret)\s+(?:is|was)\s+[^\s,;]+/gi,'$1 [REDACTED]');
   // Include operational status and gift/RCON events only, not general diagnostic payloads.
   if(!/(?:CUSTOM|Custom|RCON|gift|Gift|rules loaded|Rule)/.test(message))return [];
   return [{time,message,category:activityCategory(message)}];
 });
}
function pickState(state){const cr=state?.customRules||{};return {online:true,engineOnline:true,engineStatus:String(state?.status??'Engine reached').slice(0,160),engineVersion:'legacy-local',armState:state?.armed===true,giftRconMode:String(state?.giftRcon?.mode??'unknown').slice(0,40),customRulesMode:String(cr.mode??'unknown').slice(0,40),customRulesLoaded:cr.loaded===true,customRuleCount:Number.isSafeInteger(cr.ruleCount)?cr.ruleCount:0,customKitCount:Number.isSafeInteger(cr.kitCount)?cr.kitCount:0,customQueued:Number.isSafeInteger(cr.queued)?cr.queued:0,customInflight:cr.inflight===true,pending:Number.isSafeInteger(state?.pending)?state.pending:0,bridgeOnline:state?.bridgeOnline===true,recentLogs:safeActivity(state?.logs),checkedAt:new Date().toISOString()};}
async function engineState(){const r=await fetch(`${ENGINE_URL}/state`,{signal:AbortSignal.timeout(2200)});if(!r.ok)throw Error(`Engine status HTTP ${r.status}`);const raw=await r.text();if(raw.length>2_000_000)throw Error('Engine state too large');return pickState(JSON.parse(raw));}
async function simulateEngineGift(gift){
 const r=await fetch(`${ENGINE_URL}/custom-rules-simulate`,{method:'POST',headers:{'Content-Type':'application/json','x-ice-pack':'1',Origin:ENGINE_URL},body:JSON.stringify(gift),signal:AbortSignal.timeout(3500)});
 const raw=await r.text(); if(raw.length>20000)throw Error('Engine preview response too large');
 let data;try{data=JSON.parse(raw)}catch{throw Error('Invalid engine preview response')}
 if(!r.ok||!data.ok)throw Error(String(data.error||`Engine preview HTTP ${r.status}`).slice(0,150));
 return data;
}
async function enginePost(endpoint, body) {
 const r=await fetch(`${ENGINE_URL}${endpoint}`,{method:'POST',headers:{'x-ice-pack':'1',Origin:ENGINE_URL,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
 const raw=await r.text();if(raw.length>20000)throw Error('Engine control response too large');
 let data;try{data=JSON.parse(raw)}catch{throw Error('Invalid engine control response')}
 if(!r.ok||!data.ok)throw Error(String(data.error||`Engine returned HTTP ${r.status}`).slice(0,160));
 return data;
}
async function reloadEngine(){const r=await fetch(`${ENGINE_URL}/custom-rules-reload`,{method:'POST',headers:{'x-ice-pack':'1',Origin:ENGINE_URL},signal:AbortSignal.timeout(5000)});const data=await r.json();if(!r.ok||!data.ok)throw Error(data.error||`Engine reload HTTP ${r.status}`);return data;}
function response(res,code,body,origin){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin',...(permittedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin}:{})});res.end(JSON.stringify(body));}
const server=http.createServer(async(req,res)=>{
 const origin=String(req.headers.origin??'');
 const json=(code,obj)=>response(res,code,obj,origin);
 try {
  if(!['127.0.0.1:3212','localhost:3212'].includes(req.headers.host))return json(403,{error:'Invalid host'});
  if(origin&&!permittedOrigins.has(origin))return json(403,{error:'Allowed only from local dashboard'});
  if(req.method==='GET'&&req.url==='/status'){try{return json(200,await engineState());}catch(e){return json(503,{online:true,engineOnline:false,engineStatus:'Local engine unavailable',error:String(e.message).slice(0,120)});}}
  const endpoints=standalonePreview
    ? ['/pairing/check','/simulate/preview','/draft/preview']
    : ['/sync/preview','/sync/apply','/sync/compare','/sync/drift','/simulate/preview','/control','/recovery/list','/recovery/compare','/recovery/preview','/recovery/restore','/recovery/audit','/target/read','/target/save'];
  if(!endpoints.includes(req.url)||req.method!=='POST')return json(404,{error:'Unknown endpoint'});
  // No cross-origin browser access: requests through Vite's same-origin proxy include Origin on POST.
  if(!permittedOrigins.has(origin))return json(403,{error:'A local dashboard Origin is required'});
  const submitted=String(req.headers['x-icepack-sync-token']??'');
  if(!/^[a-f0-9]{48}$/.test(submitted)||!crypto.timingSafeEqual(Buffer.from(submitted),Buffer.from(TOKEN)))return json(401,{error:'Enter the pairing token from the current launcher session'});
  if(req.url==='/pairing/check')return json(200,{ok:true});
  if(req.url==='/draft/preview'){
    const plan=previewDashboardDraft(await readJsonBody(req),draftCatalog);
    return json(200,{ok:true,plan});
  }
  if(req.url==='/target/read') {
    const r=await fetch(`${ENGINE_URL}/state`,{signal:AbortSignal.timeout(2500)});
    if(!r.ok)throw Error(`Engine state HTTP ${r.status}`);
    const raw=await r.text();if(raw.length>2_000_000)throw Error('Engine state too large');
    return json(200,{ok:true,target:getEngineTarget(JSON.parse(raw))});
  }
  if(req.url==='/target/save') {
    if(savingTarget||applying||restoring||controlling)return json(409,{error:'Another protected operation is running'});
    const input=await readJsonBody(req);
    const playerId=validateTargetId(input.playerId);
    savingTarget=true;
    try {
      assertTargetSaveSafe(await engineState());
      // A target change is a configuration mutation: require a verified recovery snapshot first.
      if(!KIT_DIR||!fs.existsSync(KIT_DIR))throw Error('Kit directory unavailable; protected target save cannot proceed');
      const paths=resolveBackupPaths(KIT_DIR);
      const snapshot=snapshotBeforeApply(paths);
      // Recheck because another UI may have started processing while the backup was written.
      assertTargetSaveSafe(await engineState());
      const operationId=newOperationId();
      appendAudit(paths.root,{type:'target-update',status:'started',operationId,snapshot:snapshot.snapshot});
      try {
        await enginePost('/custom-rules-config',{playerId});
        const r=await fetch(`${ENGINE_URL}/state`,{signal:AbortSignal.timeout(2500)});
        if(!r.ok)throw Error('Engine could not confirm saved target');
        const raw=await r.text();if(raw.length>2_000_000)throw Error('Engine state too large');
        const verified=getEngineTarget(JSON.parse(raw));
        if(verified.playerId!==playerId||!verified.laneConfigured)throw Error('Engine did not confirm saved and loaded target. Check engine logs.');
        try{appendAudit(paths.root,{type:'target-update',status:'succeeded',operationId,snapshot:snapshot.snapshot});}catch(e){console.error('Target saved but audit write failed:',e.message);}
        return json(200,{ok:true,target:verified,recoverySnapshot:snapshot.snapshot});
      }catch(e){try{appendAudit(paths.root,{type:'target-update',status:'failed',operationId,snapshot:snapshot.snapshot});}catch{}throw e;}
    } finally {savingTarget=false;}
  }
  if(req.url.startsWith('/recovery/')){
    if(!KIT_DIR||!fs.existsSync(KIT_DIR))return json(503,{error:'Kit Editor directory unavailable'});
    const paths=resolveBackupPaths(KIT_DIR);
    if(req.url==='/recovery/list')return json(200,{ok:true,snapshots:listSnapshots(paths)});
    if(req.url==='/recovery/audit')return json(200,{ok:true,events:readAudit(paths.root)});
    const input=await readJsonBody(req);
    if(req.url==='/recovery/compare')return json(200,{ok:true,comparison:compareSnapshot(paths,input.name)});
    if(req.url==='/recovery/preview'){
      const comparison=compareSnapshot(paths,input.name);
      // Preview doesn't change files. A new preview is required for each restore.
      const token=crypto.randomBytes(20).toString('hex');
      restorePreviews.clear();
      restorePreviews.set(token,{name:input.name,comparisonHash:crypto.createHash('sha256').update(JSON.stringify(comparison)).digest('hex'),expires:Date.now()+120000});
      return json(200,{ok:true,comparison,restoreToken:token,engineMustBeStopped:true,expiresInSeconds:120});
    }
    if(req.url==='/recovery/restore'){
      if(restoring||applying||controlling||savingTarget)return json(409,{error:'Another operation is in progress'});
      if(typeof input.restoreToken!=='string'||typeof input.name!=='string'||input.confirmation!=='RESTORE CONFIGURATION')throw Error('Explicit restore confirmation required');
      const ticket=restorePreviews.get(input.restoreToken);restorePreviews.clear();
      if(!ticket||ticket.name!==input.name||Date.now()>ticket.expires)throw Error('Restore preview expired. Preview again');
      const currentComparisonHash=crypto.createHash('sha256').update(JSON.stringify(compareSnapshot(paths,input.name))).digest('hex');
      if(currentComparisonHash!==ticket.comparisonHash)throw Error('Configuration changed since restore preview. Preview again');
      restoring=true;
      try {
        if(await enginePortListening())throw Error('Stop the engine on port 3210 before restoring. Bridge and dashboard can remain running.');
        const operationId=newOperationId();
        appendAudit(paths.root,{type:'config-restore',status:'started',operationId,snapshot:input.name});
        try {
          const result=restoreSnapshot(paths,input.name,{engineStopped:true});
          try{appendAudit(paths.root,{type:'config-restore',status:'succeeded',operationId,snapshot:result.safetySnapshot});}catch(e){console.error('Recovery succeeded, but writing its audit event failed:',e.message);}
          return json(200,{ok:true,...result,warning:'Configuration restored on disk. Restart the engine; Preview and Live are not enabled automatically.'});
        } catch(err) {
          try{appendAudit(paths.root,{type:'config-restore',status:'failed',operationId,snapshot:input.name});}catch{}
          throw err;
        }
      } finally {restoring=false;}
    }
  }
  if(req.url==='/simulate/preview'){
    const gift=validateGiftRequest(await readJsonBody(req));
    if(standalonePreview&&(gift.id!==''||gift.name!=='Heart Me'))return json(400,{error:'Choose the sample Heart Me preview'});
    assertPreviewOnly(await engineState());
    // Engine endpoint also enforces preview mode; never call /bridge/gift or an RCON endpoint.
    const result=await simulateEngineGift(gift);
    if(standalonePreview){
      const record=result.customRules?.history?.[0];
      if(record?.gift!==gift.name||record.ruleId!=='alpha-heart-me'||record.status!=='preview'||record.commands?.length!==1){
        throw Error('The engine did not plan the sample Heart Me reward');
      }
      return json(200,{ok:true,gift:gift.name,previewOnly:true,message:'The engine preview planned 25 Stone. No game command was sent.'});
    }
    return json(200,{ok:true,gift:gift.name,previewOnly:true,message:'Preview sent to engine. Check Recent engine activity for commands or rejection.'});
  }
  if(req.url==='/control') {
    if(controlling||applying||restoring||savingTarget)return json(409,{error:'Another local operation is running'});
    const input=await readJsonBody(req);
    if(!input || typeof input.action!=='string')return json(400,{error:'Specify a control action'});
    const before=await engineState();
    const action=validateControl(input.action,before);
    controlling=true;
    try {
      if(action==='start-preview')await enginePost('/custom-rules-mode',{mode:'preview'});
      if(action==='stop-preview')await enginePost('/custom-rules-mode',{mode:'off'});
      if(action==='emergency-stop')await enginePost('/gift-rcon-emergency-stop',{});
      const after=await engineState();
      if(action==='start-preview'&&after.customRulesMode!=='preview')throw Error('Engine did not report Preview mode after request');
      if(action==='stop-preview'&&after.customRulesMode!=='off')throw Error('Engine did not report Off mode after request');
      if(action==='emergency-stop'&&(after.customRulesMode!=='off'||after.giftRconMode!=='off'||after.armState))throw Error('Stop was sent but engine still reports an active lane; check original dashboard');
      return json(200,{ok:true,action,customRulesMode:after.customRulesMode,warning:action==='emergency-stop'?'Queued work cleared; in-flight RCON already sent cannot be recalled.':undefined});
    } finally {controlling=false;}
  }
  if(!KIT_DIR||!fs.existsSync(KIT_DIR))return json(503,{error:'Set ICEPACK_KIT_DIR to the existing local Kit Editor folder before starting bridge'});
  if(req.url==='/sync/drift'){
    // Read-only, token-protected. Does not trigger engine reload, RCON, or backup.
    const input=await readJsonBody(req);
    const c=getCatalog(KIT_DIR);
    const draft=convertDashboard(input,c).config;
    const target=path.join(KIT_DIR,'streamer-config-v2.json');
    let applied=null;
    if(fs.existsSync(target)){
      const st=fs.lstatSync(target);
      if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>400000)throw Error('Applied file is not a regular configuration file or exceeds safety limit');
      applied=(await import('./icepack-config-engine.mjs')).validateConfiguration(JSON.parse(fs.readFileSync(target,'utf8').replace(/^\uFEFF/,'')),c);
    }
    let engine=null;
    try{engine=await engineState();}catch{/* Missing engine is an unknown result, not proof of agreement. */}
    const result=assessDrift({draftHash:hashConfig(draft),appliedHash:applied?hashConfig(applied):null,appliedRuleCount:applied?.rules.length??null,appliedKitCount:applied?.kits.length??null,engine});
    result.draft={ruleCount:draft.rules.length,kitCount:draft.kits.length};
    return json(200,{ok:true,drift:result});
  }
  if(req.url==='/sync/compare'){
    const input=await readJsonBody(req);
    const desired=convertDashboard(input,getCatalog(KIT_DIR)).config;
    const target=path.join(KIT_DIR,'streamer-config-v2.json');
    if(!fs.existsSync(target))return json(200,{ok:true,match:false,reason:'No applied engine configuration file found'});
    const stat=fs.statSync(target);if(stat.size>400000)return json(400,{error:'Applied engine configuration exceeds safety limit'});
    const current=(await import('./icepack-config-engine.mjs')).validateConfiguration(JSON.parse(fs.readFileSync(target,'utf8')),getCatalog(KIT_DIR));
    const status=await engineState();
    return json(200,{ok:true,match:hashConfig(desired)===hashConfig(current),loaded:status.customRulesLoaded,ruleCount:status.customRuleCount,kitCount:status.customKitCount,source:'Applied configuration file on disk (not proof of live engine memory)'});
  }
  if(req.url==='/sync/preview'){
    const input=await readJsonBody(req);
    const catalog=getCatalog(KIT_DIR);
    const prepared=convertDashboard(input,catalog);
    const status=await engineState();safeToApply(status);
    const id=crypto.randomBytes(16).toString('hex');const hash=hashConfig(prepared.config);
    for(const [key,v] of previews)if(Date.now()>v.expiresAt)previews.delete(key);
    previews.set(id,{hash,config:prepared.config,expiresAt:Date.now()+120000});
    return json(200,{previewId:id,hash,ruleCount:prepared.config.rules.length,kitCount:prepared.config.kits.length,warnings:prepared.warnings,expiresInSeconds:120,engineMode:status.customRulesMode});
  }
  if(applying||restoring||savingTarget)return json(409,{error:'Another apply is running'});
  const request=await readJsonBody(req);
  if(typeof request.previewId!=='string'||typeof request.hash!=='string')return json(400,{error:'Preview is required before apply'});
  const preview=previews.get(request.previewId);
  if(!preview||preview.expiresAt<Date.now()||preview.hash!==request.hash)return json(409,{error:'Preview expired or changed. Preview again'});
  previews.delete(request.previewId);
  applying=true;
  try {
    safeToApply(await engineState());
    // Revalidate against the current on-disk engine catalog before writing.
    const c=getCatalog(KIT_DIR);
    const checked=(await import('./icepack-config-engine.mjs')).validateConfiguration(preview.config,c);
    if(hashConfig(checked)!==preview.hash)throw Error('Catalog or configuration changed; preview again');
    // Protect both legacy player targeting and the current Kit configuration before mutation.
    // A failed backup aborts the apply; the existing atomicApply rollback remains active.
    const paths=resolveBackupPaths(KIT_DIR);
    const protectedSnapshot=snapshotBeforeApply(paths);
    const operationId=newOperationId();
    appendAudit(paths.root,{type:'config-apply',status:'started',operationId,snapshot:protectedSnapshot.snapshot});
    try {
      const result=await atomicApply(KIT_DIR,checked,reloadEngine);
      try{appendAudit(paths.root,{type:'config-apply',status:'succeeded',operationId,snapshot:protectedSnapshot.snapshot});}catch(e){console.error('Apply succeeded, but writing its audit event failed:',e.message);}
      return json(200,{ok:true,ruleCount:checked.rules.length,kitCount:checked.kits.length,backupCreated:Boolean(result.backup),recoverySnapshot:protectedSnapshot.snapshot,reloaded:true,liveEnabled:false});
    } catch(err) {
      try{appendAudit(paths.root,{type:'config-apply',status:'failed',operationId,snapshot:protectedSnapshot.snapshot});}catch{}
      throw err;
    }
  }finally{applying=false;}
 }catch(e){json(400,{error:String(e.message).slice(0,300)});}
});
server.listen(PORT,HOST,()=>{
 console.log(`Ice Pack local agent bridge: http://${HOST}:${PORT}/status`);
 if(standalonePreview){console.log('Standalone pairing and Heart Me preview enabled.');}
 else if(managedToken){console.log('Pairing token: use Copy bridge pairing token in the Windows Control Center.');}
 else{console.log('Sync token for dashboard (keep private): '+TOKEN);}
 console.log('Kit Editor directory: '+(KIT_DIR??'NOT SET — sync disabled'));
 console.log('Local-only: NEVER expose port 3212 through port forwarding or cloud hosting.');
});
