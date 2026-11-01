import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const excluded=new Set(['.git','.netlify','.openai','node_modules','coverage']);
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
async function walk(relative=''){
  const found=[];
  for(const entry of await fs.readdir(path.join(root,relative),{withFileTypes:true})){
    if(excluded.has(entry.name)||entry.name==='SNAPSHOT.json'||entry.name==='netlify-site.json'||entry.name.startsWith('.env')||/\.(zip|tar\.gz)$/.test(entry.name))continue;
    const file=relative?relative+'/'+entry.name:entry.name;
    if(entry.isDirectory())found.push(...await walk(file));
    else if(entry.isFile()){const bytes=await fs.readFile(path.join(root,file));found.push({path:file,bytes:bytes.length,sha256:digest(bytes)});}
  }
  return found.sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
const files=await walk(),manifestPath=path.join(root,'SNAPSHOT.json');
if(process.argv.includes('--verify')){
  const expected=JSON.parse(await fs.readFile(manifestPath,'utf8')).files;
  const actual=new Map(files.map(file=>[file.path,file]));let changes=0;
  for(const file of expected){const next=actual.get(file.path);if(!next||next.sha256!==file.sha256||next.bytes!==file.bytes){console.error('Changed/missing:',file.path);changes++;}actual.delete(file.path);}
  for(const file of actual.keys()){console.error('New file:',file);changes++;}
  if(changes)throw new Error(`${changes} file changes from this delivery snapshot`);
  console.log(`Snapshot verified: ${files.length} files.`);
}else{
  const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
  const suppliedDate=process.argv.find(value=>value.startsWith('--date='))?.slice(7);
  const date=suppliedDate||new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Snapshot date must use YYYY-MM-DD');
  const snapshot={project:'营救豆包',version:pkg.version,snapshot_date:date,time_zone:'Asia/Shanghai',algorithm:'SHA-256',excluded:['SNAPSHOT.json','local Git/hosting state','environment files','archives'],files};
  await fs.writeFile(manifestPath,JSON.stringify(snapshot,null,2)+'\n');console.log(`Snapshot written: ${files.length} files.`);
}
