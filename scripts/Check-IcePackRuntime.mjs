#!/usr/bin/env node
// Ice Pack Companion v3.3 - read-only runtime/dependency assessment.
// Never reads .env, settings, player IDs, saved rules, backups, or pairing secrets.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = path.resolve(here, '..');
const DEFAULT_ENGINE = 'C:\\IcePackARK\\ice-pack-ark';
export function parseArgs(argv) {
  const opts = {repo: DEFAULT_REPO, engine: DEFAULT_ENGINE, json: false};
  for (let i=0; i<argv.length; i++) {
    if (argv[i] === '--json') opts.json=true;
    else if (argv[i] === '--repo' || argv[i] === '--engine') {
      if (!argv[i+1] || argv[i+1].startsWith('--')) throw Error(`Expected a directory after ${argv[i]}`);
      opts[argv[i].slice(2)] = path.resolve(argv[++i]);
    } else throw Error(`Unknown argument: ${argv[i]}`);
  }
  return opts;
}
function inspectFile(root, relative) {
  const target=path.join(root,...relative.split('/'));
  try {
    const info=fs.lstatSync(target);
    return info.isFile() && !info.isSymbolicLink();
  } catch {return false;}
}
function readJsonFile(root, file) {
  const p=path.join(root,file);
  try {
    const st=fs.lstatSync(p);
    if (!st.isFile() || st.isSymbolicLink()) return {error:'missing or linked file'};
    const content=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'');
    return {value:JSON.parse(content)};
  } catch(e) {
    return {error:e?.code==='ENOENT'?'missing': 'invalid or unreadable JSON'};
  }
}
function compareDeps(pkg,lock){
  if (!lock || !lock.packages || !lock.packages['']) return {ok:false, message:'lockfile has no root package metadata'};
  const root=lock.packages[''];
  for (const section of ['dependencies','devDependencies','optionalDependencies']) {
    const expected=pkg[section]||{}, actual=root[section]||{};
    const names=new Set([...Object.keys(expected),...Object.keys(actual)]);
    for(const name of names){if(expected[name]!==actual[name])return {ok:false,message:`package and lockfile disagree in ${section}`};}
  }
  return {ok:true,message:'package declarations match lockfile root'};
}
export function assess({repo,engine}, {nodeVersion=process.versions.node}={}) {
  const results=[];
  const add=(area,name,status,detail)=>results.push({area,name,status,detail});
  const major=Number(String(nodeVersion).split('.')[0]);
  add('machine','Node.js runtime',major>=20?'pass':'fail',major>=20?'Node.js 20+ detected':'Node.js 20+ required');
  for (const [area, root, paths] of [
    ['dashboard',repo,['companion/index.html','companion/vite.config.ts','companion/src/App.tsx','companion/src/main.tsx','companion/agent-bridge/bridge.mjs']],
    ['engine',engine,['server.mjs','engine.mjs','icepack-custom-rules.mjs','icepack-gift-rcon.mjs','icepack-spawn-rcon.mjs','public/index.html']],
  ]) {
    for(const rel of paths){add(area,rel,inspectFile(root,rel)?'pass':'fail',inspectFile(root,rel)?'present':'required file missing or linked');}
    const dir=area==='dashboard'?path.join(root,'companion'):root;
    const pkg=readJsonFile(dir,'package.json');
    const lock=readJsonFile(dir,'package-lock.json');
    add(area,'package.json',pkg.value?'pass':'fail',pkg.value?'readable package manifest':pkg.error);
    add(area,'package-lock.json',lock.value?'pass':'fail',lock.value?'readable npm lockfile':lock.error);
    if(pkg.value && lock.value){
      const comp=compareDeps(pkg.value,lock.value);
      add(area,'npm ci lock consistency',comp.ok?'pass':'fail',comp.message);
      const lockVersion=Number(lock.value.lockfileVersion||0);
      add(area,'npm lockfile format',lockVersion>=2?'pass':'fail',lockVersion>=2?`lockfileVersion ${lockVersion}`:'lockfileVersion 2+ required');
    }
    const nm=path.join(dir,'node_modules');
    let installed=false;
    try {const info=fs.lstatSync(nm); installed=info.isDirectory() && !info.isSymbolicLink();} catch {}
    add(area,'Dependencies installed',installed?'pass':'info',installed?'node_modules present (not an integrity verification)':'Not present; run npm ci after inspection');
  }
  add('external','ARK dedicated server / Nitrado','external','Requires separately configured server; cannot be verified from local source');
  add('external','IcePackCompanion ASA mod','external','Mod must be installed and compatible with the dedicated ARK server');
  add('external','Streamer.bot / TikTok integration','external','Must be configured and tested separately');
  add('external','RCON connectivity','external','Not tested; no connection attempted and no credentials read');
  const failures=results.filter(r=>r.status==='fail');
  return {
    schema:1,
    toolVersion:'3.3-alpha',
    result:failures.length===0?'source-prerequisites-pass':'source-prerequisites-incomplete',
    checks:results,
    failureCount:failures.length,
    caveat:'Read-only source/dependency assessment. Does not install npm modules, bundle Node.js, verify external ARK services, or establish a complete clean-PC installer.'
  };
}
export function main(argv=process.argv.slice(2)) {
  const options=parseArgs(argv);
  const report=assess(options);
  if(options.json) console.log(JSON.stringify(report,null,2));
  else {
    console.log('Ice Pack Companion v3.3 - Runtime Installation Readiness');
    console.log(`Source prerequisite status: ${report.result}`);
    for(const c of report.checks)console.log(`  ${c.status.toUpperCase().padEnd(8)} ${c.area}: ${c.name} - ${c.detail}`);
    console.log(report.caveat);
  }
  return report.failureCount===0?0:1;
}
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try { process.exitCode=main(); } catch(err) { console.error('Runtime preflight failed:',err.message);process.exitCode=2; }
}
