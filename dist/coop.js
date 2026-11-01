import {BaseBattle,ZONES,UPGRADES,NAMES,isBoss,distance,shotHitsHero} from './base.js';
export {ZONES,UPGRADES,NAMES,isBoss};
export const COLORS=['#83bf9e','#dfb454','#ad96d3','#df94b1'];
export const BALANCE=Object.freeze({bossHealth:.70,bossDamage:.75,bossTell:1.25,bossRecovery:1.25,maxPlayers:4,friendlyFire:.5,mapScale:1.5});
const LOCAL='energy dashCooldown dashCharges dashQueued attackTimer manualCooldown defending defenseTransition peaches naidanElapsed naidanCooldown naidanPlaybackTime slowRemaining invulnerable moveX moveY lastPotHit combo comboTimer'.split(' ');
const BASE_WAVES=ZONES.map(z=>[...z.waves]);
const ENEMIES=[['chaser','chaser','chaser','shooter'],['chaser','jester','shooter','bell'],['shield','chaser','mimic','shooter','bell'],['jester','bomber','shooter','mimic','bell'],['shield','hammer','shooter','bomber','scribe'],['scribe','hammer','bell','shield','jester','mimic']];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const blankInput=()=>({mx:0,my:0,attack:false,defend:false,revive:false});
const CONTACT_STATES=new Set(['charge','lunge','pounce','slide']);
const NO_IMPACT_STATES=new Set(['idle','run','intro','recover','roar','shoot','shotWarn','barrageWarn','waveWarn','fanWarn','guardVolleyWarn','echoWarn','chargeWarn','slamWarn','guillotineWarn','brace']);
const actorPacket=a=>({id:a.id,kind:a.kind,x:Math.round(a.x*100)/100,y:Math.round(a.y*100)/100,z:Math.round(a.z*100)/100,face:a.face,hp:Math.round(a.hp*10)/10,maxHp:a.maxHp,state:a.state,timer:Math.round(a.timer*1000)/1000,dead:a.dead,hit:a.hit>0?1:0,combatPhase:a.combatPhase,rageTime:Math.round(a.rageTime*10)/10,rageTriggered:!!a.rageTriggered});
export function cleanName(name){return String(name||'奶蛙').replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,12)||'奶蛙';}
export function cleanInput(value){return {mx:clamp(Number(value?.mx)||0,-1,1),my:clamp(Number(value?.my)||0,-1,1),attack:value?.attack===true,defend:value?.defend===true,revive:value?.revive===true};}
export class CoopBattle extends BaseBattle {
  get arenaScale(){return BALANCE.mapScale;}
  constructor(roster=[]){
    super(); this.players=[];this.currentPlayer=null;this.partySize=1;this.inProbe=false;this.fromBoss=false;
    this.frame=0;this.effects=[];this.effectId=0;this.sceneIndex=0;this.sessionId=Date.now().toString(36)+Math.random().toString(36).slice(2,8);this.roster=roster.slice(0,4);this.configure({companion:true});
  }
  makeActor(kind,x,y){const a=super.makeActor(kind,x,y);if(isBoss(kind))a.hp=a.maxHp=Math.round(a.maxHp*BALANCE.bossHealth*(this.partySize||1));return a;}
  savePlayer(){if(this.currentPlayer){this.currentPlayer.hero=this.hero;for(const k of LOCAL)this.currentPlayer[k]=this[k];}}
  loadPlayer(p){this.currentPlayer=p;this.hero=p.hero;for(const k of LOCAL)this[k]=p[k];}
  use(p,fn){if(p===this.currentPlayer)return fn();this.savePlayer();const before=this.currentPlayer;this.loadPlayer(p);try{return fn();}finally{this.savePlayer();if(before)this.loadPlayer(before);}}
  enterZone(zone,initial=false){
    this.sceneId=this.sessionId+':'+(++this.sceneIndex);this.effects=[];this.events=[];
    this.savePlayer();const old=this.players||[];
    const members=old.length?old.filter(p=>p.connected):this.roster.map((p,i)=>({...p,name:cleanName(p.name),color:COLORS[i],connected:true}));
    this.partySize=Math.max(1,members.length);this.currentPlayer=null;super.enterZone(zone,initial);
    for(const crate of this.crates){crate.x*=this.arenaScale;crate.y*=this.arenaScale;}
    this.players=members.map((p,i)=>{
      const hero=super.makeActor('hero',(255+i*64)*this.arenaScale,(510+(i%2)*54)*this.arenaScale);
      hero.hp=initial?120:p.hero?.hp>0?Math.min(120,p.hero.hp+25):72;
      return {...p,hero,energy:initial?30:Math.max(30,p.energy||0),dashCooldown:0,dashCharges:this.dashUnlocked?2:0,dashQueued:false,attackTimer:.35,manualCooldown:0,defending:false,defenseTransition:0,peaches:initial?1:p.peaches??1,naidanElapsed:-1,naidanCooldown:0,naidanPlaybackTime:null,slowRemaining:0,invulnerable:2,moveX:0,moveY:0,lastPotHit:0,combo:0,comboTimer:0,input:blankInput(),actions:[],lastInput:this.clock,reviveProgress:0};
    });
    if(this.players.length)this.loadPlayer(this.players[0]);this.superOwner=null;
  }
  start(){super.start();this.frame=0;this.effects=[];this.paused=false;}
  disconnect(id){const p=this.players.find(p=>p.id===id);if(!p)return;p.connected=false;p.input=blankInput();p.actions=[];p.hero.hp=0;this.fx('text',p.hero.x,p.hero.y-110,{text:p.name+' 已离开',color:0xffce87});if(!this.players.some(p=>p.connected&&p.hero.hp>0)&&this.phase==='playing')this.phase='defeat';}
  setInput(id,input,actions=[]){const p=this.players.find(p=>p.id===id&&p.connected);if(!p)return;p.input=cleanInput(input);p.lastInput=this.clock;for(const a of actions.slice(0,8)){if(a==='rapid'&&this.superCastRemaining>0){this.use(this.players.find(v=>v.id===this.superOwner)||p,()=>this.rapidLaugh());}else if(['dash','laugh','peach','jump','joke','rapid','naidan'].includes(a))p.actions.push(a);}p.actions=p.actions.slice(-12);}
  stepPlayers(dt){
    for(const p of this.players){if(!p.connected||p.hero.hp<=0)continue;
      if(this.clock-p.lastInput>.5)p.input=blankInput();
      this.use(p,()=>{this.setMove(p.input.mx,p.input.my);this.setDefending(p.input.defend);
        for(const action of p.actions.splice(0)){
          if(action==='joke'){const previous=this.superCastRemaining;this.joke();if(!previous&&this.superCastRemaining>0)this.superOwner=p.id;}
          else if(action==='rapid')this.rapidLaugh();else if(action==='naidan')this.summonNaidan();
          else if(action==='peach')this.usePeach();else this[action]();
        }
        if(p.input.attack)this.attack();this.stepOneHero(dt);
      });
      if(this.superCastRemaining>0)break;
    }
    for(const fallen of this.players.filter(p=>p.connected&&p.hero.hp<=0)){
      const helper=this.players.find(p=>p.connected&&p.hero.hp>0&&p.input.revive&&distance(p.hero,fallen.hero)<105);
      fallen.reviveProgress=helper?fallen.reviveProgress+dt:0;
      if(fallen.reviveProgress>=3){fallen.hero.hp=60;fallen.invulnerable=2;fallen.reviveProgress=0;this.fx('heal',fallen.hero.x,fallen.hero.y,{text:'队友扶起！',color:0xc8f6c7});}
    }
  }
  update(dt){
    const owner=this.players.find(p=>p.id===this.superOwner)||this.players.find(p=>p.connected&&p.hero.hp>0)||this.players[0];
    if(!owner)return;this.savePlayer();this.loadPlayer(owner);super.update(dt);this.savePlayer();
    this.frame++;for(const ev of this.drain()){if(ev.type==='fx')this.effects.push({...ev.fx,eid:++this.effectId,at:this.clock});}
    this.effects=this.effects.filter(e=>this.clock-e.at<(e.duration||1.15)).slice(-96);
  }
  tickAI(actor,dt){if(actor.kind==='boss')super.updateBoss(actor,dt);else if(isBoss(actor.kind))super.updateMiniboss(actor,dt);else super.updateEnemy(actor,dt);}
  stepEnemy(actor,dt){
    const alive=this.players.filter(p=>p.connected&&p.hero.hp>0);if(!alive.length)return;
    const target=alive.reduce((a,b)=>distance(a.hero,actor)<distance(b.hero,actor)?a:b);
    const previousState=actor.state;
    const needsProbe=alive.length>1&&(CONTACT_STATES.has(previousState)||actor.timer<=dt+1e-7&&!NO_IMPACT_STATES.has(previousState));
    const original=needsProbe?{...actor}:null,beforeEffects=this.events.length;
    this.fromBoss=isBoss(actor.kind);this.use(target,()=>this.tickAI(actor,dt));this.fromBoss=false;
    if(actor.state!==previousState&&/Warn$/.test(actor.state)){
      actor.timer*=BALANCE.bossTell*(isBoss(actor.kind)?1:1/BALANCE.bossTell);
      if(isBoss(actor.kind))for(const ev of this.events.slice(beforeEffects))if(ev.fx?.duration)ev.fx.duration*=BALANCE.bossTell;
    }
    // Evaluate the same committed attack against other heroes, without advancing AI twice.
    if(original)for(const other of alive){
      if(other===target||this.phase!=='playing')continue;
      const saved={actors:this.actors,shots:this.shots,seed:this.seed,bossPhase:this.bossPhase,comboCooldown:this.comboCooldown};
      this.actors=this.actors.map(a=>({...a}));this.shots=[];this.inProbe=true;
      try{this.use(other,()=>this.tickAI({...original},dt));}
      finally{this.inProbe=false;Object.assign(this,saved);}
    }
  }
  fx(...args){if(!this.inProbe)super.fx(...args);}
  tryCombo(a){return this.inProbe?false:super.tryCombo(a);}
  bossPhaseChange(...args){return this.inProbe?false:super.bossPhaseChange(...args);}
  enemyShot(...args){if(!this.inProbe)super.enemyShot(...args);}
  spawn(kind){
    if(this.inProbe)return super.makeActor(kind,0,0);
    const a=super.spawn(kind);if(a&&this.fromBoss&&!isBoss(kind))for(let i=1;i<this.partySize;i++)super.spawn(kind);return a;
  }
  bossPower(a,n){return super.bossPower(a,n)*BALANCE.bossDamage;}
  bossRecover(a,n=1.25){super.bossRecover(a,n*BALANCE.bossRecovery);}
  attack(){const first=this.shots.length;super.attack();for(const s of this.shots.slice(first))s.playerId=this.currentPlayer?.id;}
  autoAttack(){const first=this.shots.length;super.autoAttack();for(const s of this.shots.slice(first))s.playerId=this.currentPlayer?.id;}
  damage(...args){if(!this.inProbe)super.damage(...args);}
  hurt(amount,sourceX){
    if(this.hero.hp<=0||this.invulnerable>0||this.naidanStage==='call'||this.phase!=='playing'||this.superCastRemaining>0||this.defending&&this.defenseFrame<2)return false;
    const damage=amount*(this.defending?1-this.defenseReduction:1);
    this.hero.hp=Math.max(0,this.hero.hp-damage);this.hero.hit=.3;this.invulnerable=.9;
    this.hero.x=clamp(this.hero.x+Math.sign(this.hero.x-sourceX)*22,this.arenaBounds.minX,this.arenaBounds.maxX);
    this.fx(this.defending?'guardHit':'hurt',this.hero.x,this.hero.y,{amount:damage,z:65});
    this.savePlayer();if(this.hero.hp<=0){this.defending=false;this.hero.state='hurt';this.deaths++;
      if(!this.players.some(p=>p.connected&&p.hero.hp>0)){this.phase='defeat';this.resetSuperLaugh();}
    }return true;
  }
  progressWaves(dt){
    const alive=this.actors.filter(a=>!a.dead).length;
    if(this.waveRemaining>0){this.spawnTimer-=dt;if(this.spawnTimer<=0&&alive<Math.min(52,(5+this.zone+this.wave*2)*this.partySize)){
      const index=BASE_WAVES[this.zone][this.wave-1]*this.partySize-this.waveRemaining;
      const types=ENEMIES[this.zone];let kind=types[(index+this.wave-1)%types.length];
      if(!this.specialSpawned&&this.wave===BASE_WAVES[this.zone].length&&index===2&&(this.zone===1||this.zone===2)){kind=this.zone===1?'penguin':'dog';this.specialSpawned=true;}
      this.spawn(kind);this.waveRemaining--;this.spawnTimer=Math.max(.18,Math.max(.63,(this.zone===0?1.4:1.15)-(this.wave-1)*.16)/this.partySize);
    }return;}
    if(alive)return;this.nextWaveTimer-=dt;if(this.nextWaveTimer>0)return;
    if(this.wave===BASE_WAVES[this.zone].length){
      if(this.zone>=3&&this.zone<=5&&!this.minibossSpawned){this.minibossSpawned=true;const a=this.spawn(['captain','general','marshal'][this.zone-3]);a.x=980*this.arenaScale;a.y=535*this.arenaScale;a.state='intro';a.timer=2;return;}
      this.offerUpgrade('zone');this.savePlayer();for(const p of this.players)if(this.dashUnlocked)p.dashCharges=2;return;
    }
    this.wave++;this.waveRemaining=BASE_WAVES[this.zone][this.wave-1]*this.partySize;this.spawnTimer=.4;this.nextWaveTimer=1.2;
    this.fx('wave',640,270,{text:`第 ${this.wave} 波 · ${this.waveRemaining} 位守卫`});
  }
  updateShots(dt){
    for(const s of this.shots){if(s.life<=0)continue;s.life-=dt;const prior={x:s.x,y:s.y,z:s.z};s.x+=s.vx*dt;s.y+=s.vy*dt;s.z+=s.vz*dt;
      if(s.enemy){for(const p of this.players){if(p.hero.hp<=0||!p.connected)continue;if(shotHitsHero(prior,s,p.hero)){this.use(p,()=>{if(this.hurt(s.damage,s.x)&&s.slow)this.slowRemaining=1.5;});s.life=0;break;}}}
      else {
        const collisions=[];
        const order=a=>{const dx=s.x-prior.x,dy=s.y-prior.y;return ((a.x-prior.x)*dx+(a.y-prior.y)*dy)/(dx*dx+dy*dy||1);};
        for(const p of this.players)if(p.id!==s.playerId&&p.connected&&p.hero.hp>0&&!s.hits.has(p.hero.id)&&shotHitsHero(prior,s,p.hero))collisions.push({p,at:order(p.hero)});
        for(const a of this.actors){if(a.dead||s.hits.has(a.id)||a.state==='intro')continue;
        if((Math.abs(s.x-a.x)<a.radius+20||a.x>=Math.min(prior.x,s.x)&&a.x<=Math.max(prior.x,s.x))&&Math.abs(s.y-a.y)<a.radius*.72+16&&s.z>=a.z+8&&s.z<a.z+(isBoss(a.kind)?255:130)){
          collisions.push({a,at:order(a)});
        }
        }
        collisions.sort((a,b)=>a.at-b.at);
        for(const hit of collisions){
          if(hit.p){s.hits.add(hit.p.hero.id);this.use(hit.p,()=>{if(this.hurt(s.damage*BALANCE.friendlyFire,prior.x))this.fx('text',hit.p.hero.x,hit.p.hero.y-130,{text:'队友误伤',color:0xc396c5});});}
          else{s.hits.add(hit.a.id);const owner=this.players.find(p=>p.id===s.playerId)||this.players[0];this.use(owner,()=>this.damage(hit.a,s.damage,Math.sign(s.vx),0));}
          if(--s.pierce<=0){s.life=0;break;}
        }
      }
    }
    this.shots=this.shots.filter(s=>s.life>0&&s.x>-100&&s.x<1380*this.arenaScale&&s.y>250&&s.y<780*this.arenaScale&&s.z>-20).slice(-110*this.partySize);
  }
  chooseUpgrade(id){if(this.phase!=='upgrade')return;const active=this.currentPlayer;super.chooseUpgrade(id);this.savePlayer();for(const p of this.players)if(p!==active)p.energy=Math.min(100,p.energy+18);}
  retry(){if(this.phase!=='defeat')return;this.upgrades=[...this.checkpoint.upgrades];this.kills=this.checkpoint.kills;this.dashUnlocked=this.checkpoint.dashUnlocked;this.paused=false;this.enterZone(this.zone,true);}
  snapshot(){
    this.savePlayer();const pick=actorPacket;
    return {type:'state',v:2,sceneId:this.sceneId,frame:this.frame,clock:Math.round(this.clock*1000)/1000,phase:this.phase,paused:this.paused,zone:this.zone,wave:this.wave,waveTotal:BASE_WAVES[this.zone].length,waveRemaining:this.waveRemaining,partySize:this.partySize,kills:this.kills,elapsed:this.elapsed,arenaScale:this.arenaScale,worldWidth:1280*this.arenaScale,worldHeight:720*this.arenaScale,friendlyFire:BALANCE.friendlyFire,dashUnlocked:this.dashUnlocked,energy:this.energy,upgrades:this.upgrades,pending:this.pending,effects:this.effects,superCharge:this.superCharge,superCastRemaining:this.superCastRemaining,superClickRemaining:this.superClickRemaining,superUsed:this.superUsed,superLaughing:this.superLaughing,superLaughElapsed:this.superLaughElapsed,
      players:this.players.map(p=>({id:p.id,name:p.name,color:p.color,connected:p.connected,hero:pick(p.hero),energy:p.energy,peaches:p.peaches,dashCharges:p.dashCharges,defending:p.defending,reviveProgress:p.reviveProgress,naidanStage:p.naidanElapsed<0?'off':p.naidanElapsed<1.185?'call':p.naidanElapsed<5.202?'laugh':'linger',naidanElapsed:Math.round(p.naidanElapsed*1000)/1000,naidanCooldown:p.naidanCooldown})),
      actors:this.actors.map(pick),crates:this.crates,shots:this.shots.map(s=>({id:s.id,x:Math.round(s.x*100)/100,y:Math.round(s.y*100)/100,z:Math.round(s.z*100)/100,size:s.size,enemy:s.enemy,playerId:s.playerId}))};
  }
}
