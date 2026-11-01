import {BattleAudio,ImpactAudio,DogAudio,PenguinAudio,NaidanAudio} from './audio-original.js';

const original={BattleAudio,ImpactAudio,DogAudio,PenguinAudio,NaidanAudio};
const soundMap={slash:'dash',spring:'dash',frost:'ice',quake:'bossSlam',volley:'shoot',guardHit:'block',endingCut:'laugh'};
const impactTypes=new Set(['shoot','hit','hurt','dash','bossSlam','bossDefeat','explode','bossPhase','block','defend','guard','muzzle','swipe','crate','heal','peach','ice','shatter','rally','awakening','heavyImpact']);
const naidanStage=elapsed=>elapsed<0?'off':elapsed<1.18421768707483?'call':elapsed<5.201269841269841?'laugh':'linger';

// This adapter feeds the original game's audio controllers from authoritative
// co-op state. Each browser mixes locally; sound never waits for a network call.
export class GameAudio {
  constructor({mediaFactory=src=>new Audio(src),visibility=globalThis.document,storage,classes=original,onChange=()=>{}}={}){
    this.factory=mediaFactory;this.visibility=visibility;this.classes=classes;this.onChange=onChange;
    try{this.storage=storage??globalThis.localStorage;this.muted=this.storage?.getItem('naiwa-coop-muted')==='1';}catch{this.muted=false;}
    this.battle=new classes.BattleAudio(mediaFactory,visibility);this.impact=new classes.ImpactAudio();
    this.dog=new classes.DogAudio();
    this.super=new classes.NaidanAudio(()=>mediaFactory('./assets/audio/super-laugh.mp3'));
    this.penguins=new Map();this.companions=new Map();this.active=false;this.unlocked=false;this.lastEffect=0;this.sceneId=null;this.phase=null;
    this.onVisibility=()=>this.state&&this.sync(this.state);visibility?.addEventListener('visibilitychange',this.onVisibility);
    this.applySettings();
  }
  setImpactEnabled(enabled){if(this.impactEnabled!==enabled){this.impactEnabled=enabled;this.impact.setEnabled(enabled);}}
  applySettings(){const enabled=!this.muted;this.battle.setSettings(enabled,enabled);this.setImpactEnabled(enabled&&this.active&&!this.visibility?.hidden&&!this.state?.paused);this.onChange(this.muted);}
  unlock(){
    this.unlocked=true;if(this.muted)return;
    this.battle.unlock();this.impact.unlock();this.dog.unlock();this.super.unlock();
    for(const sound of this.companions.values())sound.unlock();for(const sound of this.penguins.values())sound.unlock();
  }
  start(){this.active=true;this.applySettings();if(!this.muted){this.battle.startMusic();this.unlock();}}
  toggle(){
    this.muted=!this.muted;try{this.storage?.setItem('naiwa-coop-muted',this.muted?'1':'0');}catch{}
    this.applySettings();if(!this.muted){if(this.active)this.battle.startMusic();this.unlock();}
    if(this.state)this.sync(this.state);return this.muted;
  }
  clearScene(){
    this.lastEffect=0;this.dog.reset();this.super.reset();
    for(const sound of this.penguins.values())this.release(sound);this.penguins.clear();
    for(const sound of this.companions.values())this.release(sound);this.companions.clear();
  }
  release(sound){sound.reset();for(const track of [sound.track,sound.rage,sound.death])track?.remove?.();}
  stop(){this.active=false;this.state=null;this.phase=null;this.sceneId=null;this.clearScene();this.battle.reset();this.setImpactEnabled(false);}
  sync(state){
    if(!state||!this.active)return;this.state=state;
    if(this.sceneId!==state.sceneId){this.clearScene();this.sceneId=state.sceneId;}
    const hidden=!!this.visibility?.hidden,paused=hidden||!!state.paused,enabled=!this.muted;
    const playing=state.phase==='playing',audible=enabled&&!paused;
    const superLaughing=state.superLaughing===true;
    this.battle.setPaused(paused||['rescue','won','title'].includes(state.phase));
    this.battle.setContext(state.phase==='defeat','normal',superLaughing);
    this.setImpactEnabled(audible);
    const actorPhase=['playing','transition','upgrade'].includes(state.phase),actorPaused=paused||state.phase==='upgrade';
    this.dog.sync(enabled&&actorPhase,actorPaused);
    if(this.phase!==state.phase){
      if(state.phase==='defeat'){this.battle.onDeath();if(audible)this.impact.play('defeat');}
      else if(state.phase==='upgrade'&&audible)this.impact.play('upgrade');
      this.phase=state.phase;
    }
    // Consume even muted events so turning sound back on cannot replay a volley.
    for(const effect of state.effects||[]){
      if(!(effect.eid>this.lastEffect))continue;this.lastEffect=effect.eid;
      if(audible&&playing&&state.clock-effect.at<.35)this.effect(effect);
    }
    const actors=new Map((state.actors||[]).filter(a=>a.kind==='penguin').map(a=>[a.id,a]));
    for(const [id,actor] of actors){
      if(!this.penguins.has(id))this.penguins.set(id,new this.classes.PenguinAudio(this.factory));
      const sound=this.penguins.get(id);sound.sync(actor,enabled&&actorPhase,actorPaused);
    }
    for(const [id,sound] of this.penguins)if(!actors.has(id)){
      sound.sync(undefined,enabled&&actorPhase,actorPaused);
      if(sound.mode!=='death'||sound.deathFinished){this.release(sound);this.penguins.delete(id);}
    }
    const connected=new Set();
    for(const player of state.players||[]){
      if(!player.connected)continue;connected.add(player.id);
      const stage=player.naidanStage??naidanStage(player.naidanElapsed??-1);
      if(!this.companions.has(player.id)&&['call','laugh'].includes(stage)){
        const sound=new this.classes.NaidanAudio(this.factory);this.companions.set(player.id,sound);
        sound.sync(stage,Math.max(0,player.naidanElapsed||0),audible&&playing);if(this.unlocked&&enabled)sound.unlock();
      }
      this.companions.get(player.id)?.sync(stage,Math.max(0,player.naidanElapsed||0),audible&&playing);
    }
    for(const [id,sound] of this.companions)if(!connected.has(id)){this.release(sound);this.companions.delete(id);}
    this.super.sync(superLaughing?'laugh':'off',Math.max(0,state.superLaughElapsed||0),audible&&playing&&superLaughing);
  }
  effect(effect){
    if(effect.type==='laugh'){this.battle.playLaugh();return;}
    if(effect.type==='dogCall'||effect.type==='dogTransform'){this.dog.play();return;}
    if(effect.type==='superLaugh'||effect.type==='superImpact'){
      this.super.reset();this.dog.reset();for(const sound of this.penguins.values())sound.reset();return;
    }
    if(effect.type==='skillTell'&&effect.text?.includes('铃')){this.impact.play('bell');return;}
    const type=soundMap[effect.type]||effect.type;
    if(type==='laugh')this.battle.playLaugh();else if(impactTypes.has(type))this.impact.play(type);
  }
  dispose(){this.stop();this.battle.dispose();this.impact.dispose();this.visibility?.removeEventListener('visibilitychange',this.onVisibility);}
}
