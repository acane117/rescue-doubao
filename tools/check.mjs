import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const runtime=(await fs.readdir(path.join(root,'dist'))).filter(name=>name.endsWith('.js'));
for(const file of ['serve.mjs',...runtime.map(name=>'dist/'+name),...['check.mjs','snapshot.mjs'].map(name=>'tools/'+name)]){
  const result=spawnSync(process.execPath,['--check',path.join(root,file)],{stdio:'inherit'});
  if(result.status!==0)throw new Error('Syntax check failed: '+file);
}
const assets=JSON.parse(await fs.readFile(path.join(root,'dist/asset-manifest.json'),'utf8'));
for(const file of assets){
  const absolute=path.resolve(root,'dist',file);
  if(!absolute.startsWith(path.join(root,'dist')+path.sep))throw new Error('Asset outside dist: '+file);
  if(!(await fs.stat(absolute)).isFile())throw new Error('Missing asset: '+file);
}
for(const name of runtime){
  const absolute=path.join(root,'dist',name),source=await fs.readFile(absolute,'utf8');
  for(const match of source.matchAll(/from\s*['"](\.[^'"]+)['"]/g))await fs.access(path.resolve(path.dirname(absolute),match[1]));
}
for(const file of ['LICENSE.md','SOURCES.md','THIRD_PARTY_NOTICES.md','PROVENANCE.json','LICENSES/PeerJS-1.5.5-MIT.txt','dist/vendor/peerjs.min.js.map'])await fs.access(path.join(root,file));
console.log(`Syntax and local imports verified; ${assets.length} assets and attribution files present.`);
