// Ice Pack Companion v1.4: create a v1.2-compatible recovery snapshot before sync/apply.
// This module never reads .env, starts Live mode, or sends commands to RCON.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const FILES = [
  {key:'legacy-rules', filename:'rules-v06.json', location:'engine'},
  {key:'streamer-config', filename:'streamer-config-v2.json', location:'kit'}
];
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();

export function resolveBackupPaths(kitDir, options={}) {
  if (!kitDir) throw Error('Missing Kit Editor directory');
  const local = options.localAppData ?? process.env.LOCALAPPDATA;
  if (!local) throw Error('LOCALAPPDATA is unavailable; cannot create a compatible recovery snapshot');
  const configFile = options.settingsPath ?? process.env.ICEPACK_COMPANION_SETTINGS_PATH ?? path.join(local,'IcePackCompanion','settings.json');
  let settings;
  try { settings=JSON.parse(fs.readFileSync(configFile,'utf8').replace(/^\uFEFF/,'')); }
  catch (e) { throw Error(`Cannot read installed companion settings (${e.message}); run installer again`); }
  if (!settings || typeof settings.enginePath!=='string' || typeof settings.kitDir!=='string') throw Error('Installer settings lack enginePath or kitDir');
  const canonical = (p) => fs.realpathSync(path.resolve(p));
  // Never make a backup from a different Kit directory than the one being changed.
  if (canonical(settings.kitDir).toLowerCase() !== canonical(kitDir).toLowerCase()) {
    throw Error('Bridge Kit directory differs from installed settings; update settings before applying');
  }
  const engineCodeDir = canonical(settings.enginePath);
  const engineDir = settings.engineDataPath ? canonical(settings.engineDataPath) : engineCodeDir;
  return {engineDir, engineCodeDir, kitDir:canonical(kitDir), root:path.join(path.dirname(configFile),'backups')};
}

export function snapshotBeforeApply(paths) {
  const entries=[];
  for (const f of FILES) {
    const file=path.join(f.location==='engine'?paths.engineDir:paths.kitDir,f.filename);
    if(!fs.existsSync(file)) continue;
    const st=fs.statSync(file);
    if(!st.isFile() || st.size<1 || st.size>4*1024*1024) throw Error(`Invalid size or type for ${f.key}`);
    const bytes=fs.readFileSync(file);
    try { JSON.parse(bytes.toString('utf8')); } catch { throw Error(`Invalid JSON for ${f.key}; apply blocked`); }
    entries.push({key:f.key,filename:`${f.key}.json`,bytes,sha256:hash(bytes),original:file});
  }
  if(!entries.length)throw Error('No existing configurations to protect; apply blocked');
  fs.mkdirSync(paths.root,{recursive:true,mode:0o700});
  const date=new Date();
  const stamp=`${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}${String(date.getDate()).padStart(2,'0')}-${String(date.getHours()).padStart(2,'0')}${String(date.getMinutes()).padStart(2,'0')}${String(date.getSeconds()).padStart(2,'0')}`;
  let dir;
  for(let attempt=0;attempt<10;attempt++) {
    const candidate=path.join(paths.root,`${stamp}-${crypto.randomBytes(4).toString('hex')}`);
    try { fs.mkdirSync(candidate,{mode:0o700}); dir=candidate;break; }
    catch(e){if(e.code!=='EEXIST')throw e;}
  }
  if(!dir)throw Error('Unable to create unique recovery snapshot directory');
  try {
    for(const e of entries){
      const dest=path.join(dir,e.filename);
      fs.writeFileSync(dest,e.bytes,{flag:'wx',mode:0o600});
      if(hash(fs.readFileSync(dest))!==e.sha256)throw Error(`Snapshot checksum mismatch for ${e.key}`);
    }
    const manifest={format:'icepack-config-backup',version:1,createdUtc:new Date().toISOString(),entries:entries.map(({key,filename,sha256})=>({key,filename,sha256}))};
    fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
    // Fail closed if a config changes while its snapshot is being made.
    for(const e of entries) if(hash(fs.readFileSync(e.original))!==e.sha256)throw Error(`${e.key} changed during backup; preview and apply again`);
    return {snapshot:path.basename(dir),directory:dir,files:entries.map(e=>e.key)};
  } catch(e){fs.rmSync(dir,{recursive:true,force:true});throw e;}
}
