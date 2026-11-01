import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer} from '../dist/render.js';

const fixture=()=>{
  const calls=[];
  const c=new Proxy({globalAlpha:.2,globalCompositeOperation:'screen',filter:'blur(4px)'},{get:(target,name)=>name in target?target[name]:(...args)=>calls.push({name,args,alpha:target.globalAlpha,filter:target.filter,composite:target.globalCompositeOperation})});
  const walk={loaded:true,width:1448,height:1086},poses={loaded:true,width:1774,height:887};
  const r=Object.create(Renderer.prototype);
  Object.assign(r,{ctx:c,walks:new Map(),selfId:'p1',input:{mx:1,my:0},images:new Map(),load:name=>name.includes('walk-v3')?walk:poses,text:()=>{}});
  const p={id:'p1',name:'奶蛙',color:'#ffd674',naidanStage:'off'},a={kind:'hero',id:1,x:400,y:700,z:0,hp:120,state:'run',face:1};
  return {r,c,calls,p,a,walk,poses};
};
test('renderer draws changing leg cells with aligned soles and no added body wobble',()=>{
  const {r,calls,p,a,walk,poses}=fixture();
  for(let i=0;i<=40;i++)r.actor(a,p,{x:400+i*4.5,y:700,z:0});
  const draws=calls.filter(c=>c.name==='drawImage');
  assert.equal(new Set(draws.map(c=>c.args[1]+','+c.args[2])).size,8);
  assert.ok(draws.every(c=>c.args[0]===walk));
  assert.equal(calls.filter(c=>c.name==='rotate').length,0);
  assert.ok(calls.filter(c=>c.name==='translate').every(c=>c.args[1]===700));
  for(const call of draws){const [,sx,sy,sw,sh,dx,dy,dw,dh]=call.args;const sole=sy===0?530:498;assert.ok(Math.abs(dy+sole/sh*dh)<.01);assert.ok(sx+sw<=walk.width);assert.ok(sy+sh<=walk.height);}
  a.state='idle';r.input.mx=0;r.actor(a,p,{x:580,y:700,z:0});assert.equal(calls.filter(c=>c.name==='drawImage').at(-1).args[0],poses);
});
test('each frame replaces the whole backing buffer at full opacity before world transforms',()=>{
  const {r,c,calls}=fixture();
  Object.assign(r,{canvas:{width:1600,height:900},liveModel:{players:[],actors:[],crates:[],shots:[],effects:[],arenaScale:1.5,zone:0,clock:0},last:0,frames:[],drawCosts:[],entities:[],camera:{x:0,y:0},minimap:()=>{},load:()=>({loaded:false})});
  r.draw(1000);
  const clear=calls.find(c=>c.name==='fillRect');assert.deepEqual(clear.args,[0,0,1600,900]);assert.equal(clear.alpha,1);assert.equal(clear.filter,'none');assert.equal(clear.composite,'source-over');
  assert.equal(c.globalAlpha,1);
});
test('remote drawing stops at the packet target instead of reversing after extrapolation',()=>{
  const {r}=fixture();r.tracks=new Map([['a1',{fromX:100,fromY:700,fromZ:0,x:200,y:710,z:0,duration:.05}]]);r.packetAt=performance.now()-100;
  assert.deepEqual(r.position('a1',{},1/60),{x:200,y:710,z:0});
});
test('new snapshots continue at the displayed point and bound delayed interpolation',()=>{
  const {r}=fixture();r.liveModel=null;r.lastSceneId='same';r.lastZone=0;
  r.state={zone:0,clock:1};r.tracks=new Map([['a1',{x:200,y:710,z:0,renderX:150,renderY:705,renderZ:0}]]);
  r.update({sceneId:'same',zone:0,clock:1.5,actors:[{id:1,x:210,y:720}],players:[],shots:[]});
  const t=r.tracks.get('a1');assert.equal(t.fromX,150);assert.equal(t.fromY,705);assert.equal(t.duration,.1);
});
