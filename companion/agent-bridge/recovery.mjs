// v1.5 local-only recovery. Never exposes file paths, secrets or generic file access.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {snapshotBeforeApply} from './protected-apply.mjs';
const SOURCES = Object.freeze({'legacy-rules': ['engineDir','rules-v06.json'], 'streamer-config':['kitDir','streamer-config-v2.json']});
const NAME=/^\d{8}-\d{6}-[0-9a-f]{8}$/;
const HASH=/^[0-9A-Fa-f]{64}$/;
const digest= b => crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
const parse = b => JSON.parse(b.toString('utf8').replace(/^\uFEFF/,''));
const assertSnapshotName=n=>{if(typeof n!=='string'||!NAME.test(n))throw Error('Invalid snapshot identifier');return n;};
const safeFile=(folder,name)=>{const full=path.join(folder,name);if(!fs.existsSync(full))throw Error('Snapshot file missing');const info=fs.lstatSync(full);if(!info.isFile()||info.size<1||info.size>4*1024*1024)throw Error('Invalid snapshot file');return fs.readFileSync(full);};
export function readSnapshot(paths,name){
 const folder=path.join(paths.root,assertSnapshotName(name));
 if(!fs.existsSync(folder)||!fs.lstatSync(folder).isDirectory()||fs.lstatSync(folder).isSymbolicLink())throw Error('Snapshot not found');
 const m=parse(safeFile(folder,'manifest.json'));
 if(m?.format!=='icepack-config-backup'||m.version!==1||!Array.isArray(m.entries)||m.entries.length<1||m.entries.length>2)throw Error('Unsupported snapshot manifest');
 const entries=[];const used=new Set();
 for(const entry of m.entries){
  const k=entry?.key;
  if(!Object.hasOwn(SOURCES,k)||used.has(k)||entry.filename!==`${k}.json`||typeof entry.sha256!=='string'||!HASH.test(entry.sha256))throw Error('Invalid snapshot entry');
  used.add(k);
  const bytes=safeFile(folder,entry.filename);if(digest(bytes)!==entry.sha256.toUpperCase())throw Error(`Snapshot integrity failure: ${k}`);
  parse(bytes);entries.push({key:k,bytes,sha256:digest(bytes)});
 }
 return {name,createdUtc:typeof m.createdUtc==='string'?m.createdUtc:'',entries};
}
function currentFile(paths,k){const [p,name]=SOURCES[k];return path.join(paths[p],name);}
export function listSnapshots(paths){
 if(!fs.existsSync(paths.root))return [];
 return fs.readdirSync(paths.root,{withFileTypes:true}).filter(d=>d.isDirectory()&&NAME.test(d.name)).sort((a,b)=>b.name.localeCompare(a.name)).slice(0,100).map(d=>{
  try {const x=readSnapshot(paths,d.name);return {name:x.name,createdUtc:x.createdUtc,files:x.entries.map(e=>e.key),verified:true};}
  catch {return {name:d.name,verified:false,files:[],createdUtc:''};}
 });
}
export function compareSnapshot(paths,name){
 const snap=readSnapshot(paths,name);
 return {name,createdUtc:snap.createdUtc,files:snap.entries.map(e=>{
  const filename=currentFile(paths,e.key);const now=fs.existsSync(filename)?fs.readFileSync(filename):null;
  const saved=parse(e.bytes);let live=null;try {if(now)live=parse(now);}catch{}
  const summary=x=>x&&typeof x==='object'?{ruleCount:Array.isArray(x.rules)?x.rules.length:null,kitCount:Array.isArray(x.kits)?x.kits.length:null,playerTargetConfigured:typeof x.playerId==='string'&&/^\d{1,10}$/.test(x.playerId)}:null;
  return {key:e.key,changed:now?digest(now)!==e.sha256:true,exists:!!now,saved:summary(saved),current:summary(live)};
 })};
}
export function assertEngineStopped(isListening){if(isListening)throw Error('Stop the original engine (port 3210) before restoring');}
export function restoreSnapshot(paths,name,{engineStopped,preCommit}={}){
 if(engineStopped!==true)throw Error('Stop the original engine before restore');
 const snap=readSnapshot(paths,name);
 const targets=snap.entries.map(e=>({key:e.key,bytes:e.bytes,destination:currentFile(paths,e.key)}));
 for(const t of targets){const parent=path.dirname(t.destination);if(!fs.existsSync(parent)||!fs.statSync(parent).isDirectory())throw Error(`Missing destination directory for ${t.key}`);}
 // Make a verified pre-restore snapshot of all current configs before touching anything.
 const safety=snapshotBeforeApply(paths);
 const staged=[];const originals=[];const completed=[];
 try {
  for(const t of targets){
   const tmp=`${t.destination}.restore-${crypto.randomBytes(8).toString('hex')}.tmp`;
   fs.writeFileSync(tmp,t.bytes,{flag:'wx'});if(digest(fs.readFileSync(tmp))!==digest(t.bytes))throw Error('Staging verification failed');
   staged.push({...t,tmp});originals.push({destination:t.destination,bytes:fs.existsSync(t.destination)?fs.readFileSync(t.destination):null});
  }
  // Re-check snapshot integrity and safety guard before committing.
  readSnapshot(paths,name);
  if(preCommit)preCommit();
  for(const t of staged){fs.renameSync(t.tmp,t.destination);completed.push(t.destination);}
  return {restored:true,safetySnapshot:safety.snapshot,files:targets.map(t=>t.key)};
 } catch(err){
  for(const dest of completed.reverse()){
   const previous=originals.find(o=>o.destination===dest);
   try {if(previous.bytes===null)fs.rmSync(dest,{force:true});else fs.writeFileSync(dest,previous.bytes);}catch{}
  }
  throw err;
 } finally {for(const t of staged)try{fs.rmSync(t.tmp,{force:true});}catch{}}
}
