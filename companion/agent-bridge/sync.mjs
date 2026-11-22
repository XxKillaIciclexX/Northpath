import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateConfiguration, validateArkCatalog } from './icepack-config-engine.mjs';

const maxBody = 400_000;
export async function readJsonBody(req) {
  const parts=[];let size=0;
  for await (const chunk of req) {size+=chunk.length;if(size>maxBody)throw Error('Payload too large (400 KB max)');parts.push(chunk);}
  try {return JSON.parse(Buffer.concat(parts).toString('utf8'));} catch {throw Error('Invalid JSON body');}
}
export function getCatalog(dir) {
  const filename=path.join(dir,'ark-catalog-v2.json');
  const stat=fs.statSync(filename);
  if(stat.size>4_000_000)throw Error('ARK catalog exceeds safety limit');
  return validateArkCatalog(JSON.parse(fs.readFileSync(filename,'utf8')));
}
function stableId(id,prefix,index){
  // Dashboard IDs can be generated UUIDs; engine accepts digits, letters, -, _, :, and dots.
  const x=String(id??'');
  return /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,119}$/.test(x)&&!['constructor','prototype','__proto__'].includes(x)?x:`${prefix}-${index}`;
}
export function convertDashboard(input, catalog, { multipleDinosaurs = false } = {}) {
  if(!input || typeof input!=='object' || input.version!==1 || !Array.isArray(input.rules)|| !Array.isArray(input.kits)) throw Error('Expected dashboard configuration version 1');
  if(input.rules.length>500||input.kits.length>200)throw Error('Too many rules or kits');
  const dinosaurIds=new Set(catalog.dinosaurs.map(x=>x.id));
  const itemIds=new Set(catalog.items.map(x=>x.id));
  const kitIds=new Map(input.kits.map((k,i)=>[k.id,stableId(k.id,'kit',i)]));
  const convertAction=(a,allowKit)=>{
    if(!a ||typeof a!=='object')throw Error('Missing action');
    if(typeof a.announcement!=='string' || a.announcement.trim())throw Error('Custom announcement text cannot be synced: current engine only supports announcement on/off; clear the text first');
    if(a.type==='kit') {
      if(!allowKit)throw Error('Nested Kits are not supported');
      if(!kitIds.has(a.kitId))throw Error(`Missing Kit: ${String(a.kitId).slice(0,100)}`);
      return {type:'kit',kitId:kitIds.get(a.kitId),announcement:false};
    }
    if(!Number.isSafeInteger(a.quantity)||a.quantity<1)throw Error('Invalid quantity');
    if(a.type==='dinosaur') {
      if(!dinosaurIds.has(a.catalogId))throw Error(`Dinosaur ${String(a.catalogId).slice(0,100)} is not in the engine catalog`);
      return {type:'dinosaur',creatureId:a.catalogId,quantity:a.quantity,level:a.level,status:a.tamed?'tamed':'wild',announcement:false};
    }
    if(a.type==='item') {
      if(!itemIds.has(a.catalogId))throw Error(`Item ${String(a.catalogId).slice(0,100)} is not in the engine catalog`);
      if(a.quality!==0)throw Error('Item quality is not supported by engine v2; set quality to 0');
      return {type:'item',itemId:a.catalogId,quantity:a.quantity,announcement:false};
    }
    throw Error('Unsupported action type');
  };
  const kits=input.kits.map((k,i)=>({id:kitIds.get(k.id),name:k.name,entries:k.entries.map(e=>convertAction(e.action,false))}));
  const rules=input.rules.map((r,i)=>({
    id:stableId(r.id,'rule',i),giftId:r.giftId?.trim()||null,giftName:r.giftName?.trim()||null,
    enabled:r.enabled,cooldown:0,reward:convertAction(r.action,true)
  }));
  const cfg=validateConfiguration({schemaVersion:2,rules,kits},catalog);
  const warnings=[];
  const liveDinos=new Set(['Dodo','Raptor','Rex']);
  for(const rule of cfg.rules.filter(r=>r.enabled)) {
    const actions=rule.reward.type==='kit'?cfg.kits.find(k=>k.id===rule.reward.kitId)?.entries??[]:[rule.reward];
    if(actions.some(a=>a.type==='dinosaur'&&(!liveDinos.has(a.creatureId)||(!multipleDinosaurs&&a.quantity!==1)||a.status!=='wild')))
      warnings.push(`${rule.giftName??rule.giftId}: creature or spawn options not yet approved for live ARK execution`);
    if(!multipleDinosaurs && actions.filter(a=>a.type==='dinosaur').length>1) warnings.push(`${rule.giftName??rule.giftId}: multiple dinosaurs per gift cannot execute live yet`);
    if(multipleDinosaurs && actions.reduce((count,a)=>count+(a.type==='dinosaur'?a.quantity:1),0)>8)
      warnings.push(`${rule.giftName??rule.giftId}: exceeds the engine limit of 8 commands per gift`);
    if(actions.some(a=>a.type==='item'&&a.itemId!=='Stone')) warnings.push(`${rule.giftName??rule.giftId}: only Stone is currently approved for live item delivery`);
    if(actions.some(a=>{const id=a.type==='dinosaur'?a.creatureId:a.type==='item'?a.itemId:null;const entry=id&&(a.type==='dinosaur'?catalog.dinosaurs:catalog.items).find(e=>e.id===id);return entry && (entry.contentPack!=='base-game'||!entry.enabled);}))warnings.push(`${rule.giftName??rule.giftId}: selected content pack/entry is not currently available for live execution`);
  }
  return {config:cfg,warnings:[...new Set(warnings)].slice(0,30)};
}
export function hashConfig(config){return crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');}
export function safeToApply(status) {
 if(!status?.engineOnline)throw Error('Engine must be online to apply and verify reload');
 if(status.armState===true||status.giftRconMode==='live'||status.customRulesMode==='live'||status.pending>0||status.customQueued>0||status.customInflight===true)
   throw Error('Stop all live gift lanes, disarm legacy rules, and clear queued work before applying');
 if(!status.customRulesLoaded && !['off','preview'].includes(status.customRulesMode))throw Error('Engine custom rules status unavailable');
}
export function atomicApply(dir,config, reload) {
 const target=path.join(dir,'streamer-config-v2.json');
 const backupDir=path.join(dir,'.northpath-sync-backups');
 fs.mkdirSync(backupDir,{recursive:true,mode:0o700});
 const previous=fs.existsSync(target)?fs.readFileSync(target):null;
 const name=`streamer-config-v2.${new Date().toISOString().replace(/[:.]/g,'-')}.${crypto.randomBytes(3).toString('hex')}.json`;
 const backup=path.join(backupDir,name);
 if(previous!==null)fs.writeFileSync(backup,previous,{mode:0o600,flag:'wx'});
 const pending=path.join(dir,`.northpath-${crypto.randomBytes(8).toString('hex')}.tmp`);
 const write=(payload)=>{fs.writeFileSync(pending,payload,{mode:0o600,flag:'wx'});fs.renameSync(pending,target);};
 try{
   write(JSON.stringify(config,null,2)+'\n');
   return Promise.resolve().then(reload).then(()=>({backup:previous!==null?backup:null})).catch(async err=>{
     try{
       if(previous!==null)write(previous);
       else fs.unlinkSync(target);
       await reload();
     }catch(rollbackError){throw Error(`Reload failed: ${err.message}; rollback/reload also failed: ${rollbackError.message}. Inspect the config and engine manually`);}
     throw Error(`Engine rejected configuration; previous config restored: ${err.message}`);
   });
 }finally{ if(fs.existsSync(pending))fs.unlinkSync(pending); }
}
