// Ice Pack Companion v1.6: bounded, privacy-preserving, local audit trail.
// Store only allowlisted metadata; never store credentials, player IDs, raw JSON or paths.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const TYPES=new Set(['config-apply','config-restore','target-update']);
const STATES=new Set(['started','succeeded','failed']);
const SNAPSHOT=/^\d{8}-\d{6}-[0-9a-f]{8}$/;
const ID=/^[0-9a-f]{24}$/;
const MAX_BYTES=1024*1024;
const FILE='activity.jsonl';
function auditFile(root){return path.join(path.dirname(root),FILE);}
function entry(data){
 if(!TYPES.has(data.type)||!STATES.has(data.status)||typeof data.operationId!=='string'||!ID.test(data.operationId))throw Error('Invalid audit event');
 if(data.snapshot!==undefined && !SNAPSHOT.test(data.snapshot))throw Error('Invalid audit snapshot');
 const stamp=typeof data.time==='string'&&Number.isFinite(Date.parse(data.time))?data.time:new Date().toISOString();
 return {time:stamp,type:data.type,status:data.status,operationId:data.operationId,...(data.snapshot?{snapshot:data.snapshot}:{})};
}
export function newOperationId(){return crypto.randomBytes(12).toString('hex');}
export function appendAudit(root,data){
 const file=auditFile(root);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 const row=JSON.stringify(entry(data))+'\n';
 if(fs.existsSync(file)){
  const st=fs.lstatSync(file);
  if(!st.isFile()||st.isSymbolicLink())throw Error('Invalid audit file');
  if(st.size>MAX_BYTES){
   const archive=`${file}.${new Date().toISOString().slice(0,10)}.${crypto.randomBytes(3).toString('hex')}.archive`;
   fs.renameSync(file,archive);
  }
 }
 fs.appendFileSync(file,row,{encoding:'utf8',mode:0o600});
}
export function readAudit(root,limit=100){
 const file=auditFile(root);
 if(!fs.existsSync(file))return [];
 const st=fs.lstatSync(file);if(!st.isFile()||st.isSymbolicLink()||st.size>MAX_BYTES+1024)throw Error('Invalid audit file');
 return fs.readFileSync(file,'utf8').split(/\r?\n/).filter(Boolean).slice(-Math.min(200,Math.max(1,limit))).reverse().flatMap(line=>{
   try {const x=JSON.parse(line);return [entry(x)];}catch{return [];}
 });
}
