import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {GameAudio} from '../dist/audio.js';
import {BattleAudio,DogAudio,PenguinAudio,NaidanAudio} from '../dist/audio-original.js';
import {CoopBattle} from '../dist/coop.js';

class Media {
  constructor(src){this.src=src;this.paused=true;this.currentTime=0;this.volume=1;this.listeners=new Map();this.plays=0;}
  addEventListener(name,fn){this.listeners.set(name,fn);}
  play(){this.paused=false;this.plays++;return Promise.resolve();}
  pause(){this.paused=true;}
  end(){this.paused=true;this.listeners.get('ended')?.();}
  remove(){this.removed=true;}
}
class Impact {
  constructor(){this.sounds=[];this.settings=[];}
  setEnabled(value){this.enabled=value;this.settings.push(value);}
  unlock(){}
  play(name){if(this.enabled)this.sounds.push(name);}
  dispose(){}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const media=[],visibility=new EventTarget();visibility.hidden=false;const saved=new Map();
  const factory=src=>{const track=new Media(src);media.push(track);return track;};
  const classes={BattleAudio,PenguinAudio,NaidanAudio,ImpactAudio:Impact,DogAudio:class extends DogAudio{constructor(){super(()=>factory('./assets/audio/dog-call.mp3'));}}};
  const audio=new GameAudio({mediaFactory:factory,classes,visibility,storage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}});
  const state={sceneId:'room:1',clock:1,phase:'playing',paused:false,actors:[],players:[],effects:[],superLaughing:false};
  const track=file=>media.find(a=>a.src.endsWith(file));
  return {audio,state,track,media,visibility,saved};
}
test('original normal/death music and laugh recordings play with their original mix',async()=>{
  const {audio,state,track}=fixture();audio.start();audio.sync(state);await flush();
  assert.equal(track('normal-theme.mp3').paused,false);assert.equal(track('normal-theme.mp3').loop,true);assert.equal(track('normal-theme.mp3').volume,.35);
  state.effects=[{eid:1,type:'laugh',at:1}];audio.sync(state);await flush();assert.equal(track('laugh.mp3').paused,false);assert.equal(track('laugh.mp3').volume,.85);
  state.phase='defeat';audio.sync(state);await flush();assert.equal(track('normal-theme.mp3').paused,true);assert.equal(track('death-theme.mp3').paused,false);assert.ok(audio.impact.sounds.includes('defeat'));audio.dispose();
});
test('repeated co-op snapshots do not replay effects, including after mute and pause',()=>{
  const {audio,state,saved}=fixture();audio.start();state.effects=[{eid:1,type:'shoot',at:1}];
  for(let i=0;i<60;i++)audio.sync(state);assert.deepEqual(audio.impact.sounds,['shoot']);assert.equal(audio.impact.settings.length,2);
  audio.toggle();assert.equal(saved.get('naiwa-coop-muted'),'1');state.effects.push({eid:2,type:'hit',at:1});audio.sync(state);
  audio.toggle();audio.sync(state);assert.deepEqual(audio.impact.sounds,['shoot']);state.effects.push({eid:3,type:'guardHit',at:1});audio.sync(state);assert.deepEqual(audio.impact.sounds,['shoot','block']);
  state.paused=true;state.effects.push({eid:4,type:'dash',at:1});audio.sync(state);state.paused=false;audio.sync(state);assert.deepEqual(audio.impact.sounds,['shoot','block']);audio.dispose();
});
test('original skill and monster effect types reach the matching original sounds',async()=>{
  const {audio,state,track}=fixture();audio.start();
  state.effects=['slash','frost','quake','volley','bossPhase','skillTell','dogTransform'].map((type,i)=>({eid:i+1,type,text:type==='skillTell'?'铃声号令':undefined,at:1}));
  audio.sync(state);await flush();assert.deepEqual(audio.impact.sounds,['dash','ice','bossSlam','shoot','bossPhase','bell']);assert.equal(track('dog-call.mp3').paused,false);audio.dispose();
});
test('each penguin keeps its rage and death recordings, even after its body disappears',async()=>{
  const {audio,state,media}=fixture();audio.start();state.actors=[{id:7,kind:'penguin',rageTriggered:true,dead:false},{id:8,kind:'penguin',rageTriggered:true,dead:false}];audio.sync(state);await flush();
  const rage=media.filter(a=>a.src.endsWith('penguin-rage.mp3'));assert.equal(rage.length,2);assert.ok(rage.every(a=>a.loop&&!a.paused));
  state.actors[0].dead=true;audio.sync(state);await flush();const death=media.find(a=>a.src.endsWith('penguin-death.mp3'));assert.ok(death&&!death.loop&&!death.paused);assert.equal(rage[0].paused,true);
  state.actors=state.actors.slice(1);audio.sync(state);assert.equal(death.paused,false);death.end();audio.sync(state);assert.equal(audio.penguins.has(7),false);audio.dispose();
});
test('remote companion and super-laugh recordings use authoritative sequence time',async()=>{
  const {audio,state,media,track}=fixture();audio.start();await flush();
  state.players=[{id:'host',connected:true,naidanStage:'laugh',naidanElapsed:2.2},{id:'guest',connected:true,naidanStage:'call',naidanElapsed:.4}];
  state.superLaughing=true;state.superLaughElapsed=1.3;audio.sync(state);await flush();
  const companions=media.filter(a=>a.src.endsWith('naidan-sequence-v241.mp3'));assert.equal(companions.length,2);assert.deepEqual(companions.map(a=>a.currentTime),[2.2,.4]);assert.ok(companions.every(a=>!a.paused));
  assert.equal(track('super-laugh.mp3').paused,false);assert.equal(track('super-laugh.mp3').currentTime,1.3);assert.equal(track('normal-theme.mp3').volume,.08);
  state.paused=true;audio.sync(state);assert.ok(companions.every(a=>a.paused));assert.equal(track('super-laugh.mp3').paused,true);audio.dispose();
});
test('backgrounding, leaving and changing scene stop sound without replaying stale events',async()=>{
  const {audio,state,track,visibility,media}=fixture();audio.start();audio.sync(state);await flush();visibility.hidden=true;visibility.dispatchEvent(new Event('visibilitychange'));assert.equal(track('normal-theme.mp3').paused,true);
  visibility.hidden=false;visibility.dispatchEvent(new Event('visibilitychange'));await flush();assert.equal(track('normal-theme.mp3').paused,false);
  state.effects=[{eid:10,type:'hit',at:0}];audio.sync(state);assert.equal(audio.impact.sounds.length,0);state.sceneId='room:2';state.effects=[{eid:1,type:'shoot',at:1}];audio.sync(state);assert.deepEqual(audio.impact.sounds,['shoot']);
  audio.stop();assert.ok(media.every(a=>a.paused));audio.sync(state);assert.ok(media.every(a=>a.paused));audio.dispose();
});
test('co-op snapshots carry the original audio timing and penguin state for guests',()=>{
  const model=new CoopBattle([{id:'host'},{id:'guest'}]);model.start();model.use(model.players[1],()=>{model.naidanElapsed=2.25;});model.savePlayer();
  const penguin=model.makeActor('penguin',1000,800);penguin.rageTriggered=true;model.actors=[penguin];
  const packet=JSON.parse(JSON.stringify(model.snapshot()));assert.equal(packet.players[1].naidanElapsed,2.25);assert.equal(packet.actors[0].rageTriggered,true);assert.equal(typeof packet.superLaughing,'boolean');assert.equal(typeof packet.superLaughElapsed,'number');
});
test('all eight original audio files are shipped intact in the static build',async()=>{
  const manifest=JSON.parse(await fs.readFile(new URL('../art/original-audio-sources.json',import.meta.url),'utf8'));assert.equal(manifest.length,8);
  for(const entry of manifest){const data=await fs.readFile(new URL('../dist/'+entry.file,import.meta.url));assert.equal(data.length,entry.bytes);assert.ok(data.length>512);assert.ok(data.subarray(0,3).toString()==='ID3'||data[0]===255,entry.file);}
});
