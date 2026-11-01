import test from 'node:test';
import assert from 'node:assert/strict';
import {CoopBattle,BALANCE,cleanInput} from '../dist/coop.js';
const make=(n=2)=>{const m=new CoopBattle(Array.from({length:n},(_,i)=>({id:'p'+i,name:'奶蛙'+(i+1)})));m.start();return m;};
test('all four bosses use weaker base HP multiplied by party size',()=>{
  for(const n of [1,2,3,4]){const m=make(n);for(const [kind,hp] of Object.entries({captain:3168,general:5280,marshal:7480,boss:8800}))assert.equal(m.makeActor(kind,900,520).hp,Math.round(hp*.7*n));}
});
test('wave count and concurrent spawn limit scale without multiplying mob health',()=>{
  for(const n of [1,2,3,4]){const m=make(n);m.progressWaves(3);assert.equal(m.waveRemaining,5*n);m.progressWaves(1);assert.equal(m.waveRemaining,5*n-1);assert.equal(m.actors[0].maxHp,47);}
});
test('each player moves independently while shared time advances once',()=>{
  const m=make();const [a,b]=m.players;const ax=a.hero.x,bx=b.hero.x;
  m.setInput(a.id,{mx:1});m.setInput(b.id,{mx:-1});m.update(.02);
  assert.ok(a.hero.x>ax);assert.ok(b.hero.x<bx);assert.equal(m.clock,.02);assert.ok(Number.isFinite(m.hero.y));
});
test('individual defense and life stay isolated, all down causes team defeat',()=>{
  const m=make();for(const p of m.players)p.invulnerable=0;
  m.use(m.players[1],()=>{m.defending=true;m.defenseTransition=0;m.hurt(100,0);});
  assert.equal(m.players[0].hero.hp,120);assert.equal(m.players[1].hero.hp,50);
  m.use(m.players[1],()=>{m.invulnerable=0;m.defending=false;m.hurt(999,0);});assert.equal(m.phase,'playing');
  m.use(m.players[0],()=>{m.invulnerable=0;m.hurt(999,0);});assert.equal(m.phase,'defeat');
});
test('projectiles belong to the shooter and charge that player',()=>{
  const m=make();const p=m.players[1];m.use(p,()=>m.attack());assert.equal(m.shots[0].playerId,p.id);
  const enemy=m.makeActor('chaser',p.hero.x+50,p.hero.y);enemy.state='idle';m.actors=[enemy];
  const before=m.players[0].energy;m.updateShots(.02);assert.ok(enemy.hp<enemy.maxHp);assert.equal(m.players[0].energy,before);assert.ok(p.energy>30);
});
test('nearby teammate holding rescue for three seconds revives fallen player',()=>{
  const m=make();m.players[1].hero.hp=0;m.players[1].hero.x=m.players[0].hero.x+20;m.players[1].hero.y=m.players[0].hero.y;
  for(let i=0;i<152;i++){m.setInput('p0',{revive:true});m.update(.02);m.actors=[];}
  assert.equal(m.players[1].hero.hp,60);
});
test('disconnect preserves current boss HP and changes scaling next chapter',()=>{
  const m=make(3);m.enterZone(6,true);const before=m.actors[0].hp;m.disconnect('p2');assert.equal(m.partySize,3);assert.equal(m.actors[0].hp,before);
  m.enterZone(6);assert.equal(m.partySize,2);assert.equal(m.actors[0].maxHp,12320);
});
test('retry restores whole team and permits repeated practice without ads',()=>{
  const m=make();m.enterZone(4);m.phase='defeat';m.players.forEach(p=>p.hero.hp=0);m.retry();assert.equal(m.zone,4);assert.equal(m.phase,'playing');assert.ok(m.players.every(p=>p.hero.hp===120));
});
test('boss damage is reduced equally for all party sizes',()=>{
  const a=make(1),b=make(4);assert.equal(a.bossPower({kind:'boss',combatPhase:1},40),40*1.45*.75);assert.equal(a.bossPower({kind:'boss',combatPhase:2},40),b.bossPower({kind:'boss',combatPhase:2},40));
});
test('snapshot is serializable and untrusted controls are bounded',()=>{
  const m=make(4);for(let i=0;i<100;i++){for(const p of m.players)m.setInput(p.id,{attack:true,mx:Math.sin(i)});m.update(.02);}const s=JSON.parse(JSON.stringify(m.snapshot()));assert.equal(s.players.length,4);assert.ok(s.actors.every(a=>Number.isFinite(a.x)));assert.deepEqual(cleanInput({mx:Infinity,my:-100,attack:'yes'}),{mx:1,my:-1,attack:false,defend:false,revive:false});
});
test('one area attack damages both nearby players while advancing enemy AI once',()=>{
  const m=make(),y=535*m.arenaScale;m.crates=[];for(const p of m.players){p.hero.x=350;p.hero.y=y;m.use(p,()=>{m.invulnerable=0;});}m.savePlayer();
  const e=m.makeActor('chaser',300,y);e.state='warn';e.timer=.001;e.face=1;e.targetX=350;e.targetY=y;m.actors=[e];m.update(.02);
  assert.ok(m.players.every(p=>p.hero.hp<120));assert.equal(m.actors.length,1);assert.ok(Number.isFinite(e.x));
});
test('friendly milk deals half damage, respects body blocking and cannot hit its owner',()=>{
  const m=make(),[owner,friend]=m.players,y=800;owner.hero.x=300;owner.hero.y=y;friend.hero.x=360;friend.hero.y=y;
  m.use(friend,()=>{m.invulnerable=0;});m.savePlayer();const enemy=m.makeActor('chaser',395,y);m.actors=[enemy];
  m.shots=[{id:999,x:330,y,z:72,vx:820,vy:0,vz:0,life:2,enemy:false,damage:14,pierce:1,hits:new Set(),size:16,playerId:owner.id}];
  m.updateShots(.1);assert.equal(friend.hero.hp,113);assert.equal(owner.hero.hp,120);assert.equal(enemy.hp,enemy.maxHp);assert.equal(m.shots.length,0);
});
test('friendly fire can down teammates, while defense and invulnerability still work',()=>{
  const m=make(),p=m.players[1];m.use(p,()=>{m.invulnerable=0;m.defending=true;m.defenseTransition=0;m.hurt(14*.5,0);});assert.equal(p.hero.hp,115.1);
  m.use(p,()=>{m.defending=false;m.invulnerable=0;m.hurt(999,0);});assert.equal(p.hero.hp,0);assert.equal(m.phase,'playing');
});
test('larger worlds scale every chapter, crates, and miniboss spawn boundaries',()=>{
  const m=make();for(let zone=0;zone<7;zone++){m.enterZone(zone,true);assert.equal(m.arenaScale,1.5);assert.equal(m.arenaBounds.maxX,1815);assert.equal(m.snapshot().worldWidth,1920);assert.equal(m.snapshot().worldHeight,1080);assert.ok(m.players.every(p=>p.hero.y>=m.arenaBounds.minY));assert.ok(m.crates.every(c=>c.y>=m.arenaBounds.minY));}
  m.enterZone(4,true);m.wave=3;m.nextWaveTimer=0;m.actors=[];m.progressWaves(.02);assert.equal(m.actors[0].x,1470);assert.equal(m.actors[0].y,802.5);
});
test('wind-up frames do not clone the actor collection',()=>{
  const m=make(4),a=m.makeActor('chaser',300,800);a.state='warn';a.timer=.8;m.actors=[a];const original=globalThis.structuredClone;let calls=0;globalThis.structuredClone=(v)=>{calls++;return original(v);};try{m.stepEnemy(a,1/60);assert.equal(calls,0);assert.equal(m.actors[0],a);}finally{globalThis.structuredClone=original;}
});
test('retry starts a fresh visual scene without stale attacks',()=>{const m=make();const before=m.sceneId;m.effects=[{eid:99,type:'rectWarning',at:m.clock}];m.phase='defeat';m.retry();assert.notEqual(m.sceneId,before);assert.equal(m.effects.length,0);});
test('rapid laugh input is handled while the super-laugh locks ordinary actions',()=>{const m=make();m.enterZone(6,true);m.superCastRemaining=1;m.superOwner='p0';m.superClickRemaining=0;m.superReturnPosition={x:m.hero.x,y:m.hero.y,z:0};m.setInput('p0',{},['rapid']);m.update(.02);assert.ok(m.superLaughElapsed>0);});
test('all seven chapters survive multi-player AI, skills and projectile simulation',()=>{
  const m=make(4);for(let zone=0;zone<7;zone++){
    m.enterZone(zone,true);m.upgrades=['auto','spread','pierce','pot','rapid','aftershock'];m.dashUnlocked=true;
    for(let tick=0;tick<700;tick++){
      for(const p of m.players){m.use(p,()=>m.invulnerable=10);m.setInput(p.id,{attack:true,mx:Math.sin(tick*.02)*.5,my:Math.cos(tick*.02)*.5},tick%180===0?['naidan']:[]);}
      m.update(.02);if(m.phase==='upgrade')m.chooseUpgrade(m.pending[0].id);
      assert.ok(m.players.every(p=>Number.isFinite(p.hero.x)&&Number.isFinite(p.hero.hp)));assert.ok(m.actors.every(a=>Number.isFinite(a.x)&&Number.isFinite(a.hp)));
    }
  }
});
