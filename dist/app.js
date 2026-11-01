import {CoopBattle,ZONES,NAMES,COLORS} from './coop.js';
import {RoomNetwork,validCode} from './network.js';
import {Renderer} from './render.js';
import {GameAudio} from './audio.js';
import {LandscapeMode,joystickPosition} from './mobile.js';
const elements=new Map();const $=s=>{if(!elements.has(s))elements.set(s,document.querySelector(s));return elements.get(s);};
let model=null,state=null,solo=false,inGame=false,ready=false,lobby=null,modalKey='',lastZone=-1,lastSend=0,lastPublish=0,toastTimer=0,lastHUD=0,lastHUDPhase='',accumulator=0;
const receivedEffects=new Map(),teamNodes=[],abilityNodes=[];
const renderer=new Renderer($('#canvas'));
const landscape=new LandscapeMode($('#game'),$('#stage'),()=>{renderer.resize();if(inGame)resetInput();});
const audio=new GameAudio({mediaFactory:src=>{const track=new Audio(src);track.dataset.track=src.split('/').pop();$('#audio-bank').append(track);return track;},onChange:muted=>{
  for(const button of document.querySelectorAll('[data-audio-toggle]')){button.setAttribute('aria-label',muted?'开启声音':'关闭声音');button.setAttribute('title',muted?'开启声音':'关闭声音');button.setAttribute('aria-pressed',String(muted));button.classList.toggle('muted',muted);}
}});
for(const button of document.querySelectorAll('[data-audio-toggle]'))button.onclick=()=>audio.toggle();
document.addEventListener('pointerdown',()=>audio.unlock(),{capture:true});
document.addEventListener('keydown',()=>audio.unlock(),{capture:true});
const input={mx:0,my:0,attack:false,defend:false,revive:false},keys=new Set(),holds=new Set(),actions=[];
let joy={mx:0,my:0},selfId='solo',lastTick=performance.now();
renderer.load('characters/hero-poses-v3.png').ready.then(img=>{if(img.loaded)for(const figure of document.querySelectorAll('.hero-figure'))figure.classList.add('atlas');});
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4500);}
function status(message,error=false){$('#connection-status').textContent=message;$('#connection-status').classList.toggle('error',error);}
const net=new RoomNetwork({
  onLobby:updateLobby,onState:receive,
  onInput:(id,value,a)=>model?.setInput(id,value,a),
  onDisconnect:id=>{if(id==='host'){audio.stop();landscape.leave();model=null;inGame=false;state=null;renderer.state=null;$('#game').hidden=true;$('#home').hidden=false;net.close();showEntry();status('房主已离开，本局结束。可以重新创建房间。',true);toast('房主已离开房间');}else{model?.disconnect(id);toast('一位队友离开了，本关怪物倍率保持不变。');}},
  onStatus:status,onError:message=>{status(message,true);toast(message);},onLatency:ms=>$('#stage').dataset.rtt=String(Math.round(ms))
});
function showEntry(){$('#entry-panel').hidden=false;$('#lobby-panel').hidden=true;}
function updateLobby(value){
  lobby=value;selfId=value.selfId;$('#entry-panel').hidden=true;$('#lobby-panel').hidden=false;
  $('#room-code').textContent=value.code;$('#member-count').textContent=value.members.length+' / 4';
  const container=$('#members');container.replaceChildren();
  for(let i=0;i<4;i++){
    const p=value.members[i],row=document.createElement('div');row.className='member'+(p?'':' empty-member');
    if(p){const img=document.createElement('img');img.src='./assets/characters/hero-poster.webp';img.alt='';img.className='member-avatar';img.style.borderBottom='2px solid '+COLORS[i];row.append(img);const name=document.createElement('span');name.className='member-name';name.textContent=p.name+(p.id===selfId?'（你）':'');row.append(name);const tag=document.createElement('span');tag.className='member-tag';tag.textContent=p.id===value.members[0].id?'房主':p.ready?'已准备':'等待准备';row.append(tag);}
    else{const mark=document.createElement('span');mark.textContent='+';row.append(mark,document.createTextNode(' 等一位一起笑的朋友'));}
    container.append(row);
  }
  $('#start').hidden=!value.isHost;$('#ready').hidden=value.isHost;
  const allReady=value.members.every(p=>p.ready);$('#start').disabled=!allReady;
  const mine=value.members.find(p=>p.id===selfId);ready=mine?.ready===true;$('#ready').textContent=ready?'已准备 · 点击取消':'我准备好了';
  $('#lobby-tip').textContent=value.isHost?(allReady?'朋友到齐就出发，也可以独自开始。':'等所有朋友点击准备，就能一起出发。'):'准备好后点击按钮，等房主带队出发。';
  status('房间已连接 · '+value.members.length+' 位勇者在线');
  if(!value.started&&inGame){audio.stop();landscape.leave();model=null;state=null;inGame=false;renderer.state=null;$('#game').hidden=true;$('#home').hidden=false;resetInput();}
}
function setBusy(b){for(const id of ['create','join','solo'])$('#'+id).disabled=b;}
async function connect(host){
  audio.start();setBusy(true);try{solo=false;const name=$('#nickname').value;try{localStorage.setItem('naiwa-coop-name',name);}catch{}await net.open(host,$('#room-input').value,name);}
  catch(e){audio.stop();net.close();showEntry();status(e.message,true);}finally{setBusy(false);}
}
$('#create').onclick=()=>connect(true);$('#join').onclick=()=>connect(false);$('#room-input').oninput=e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'');};
$('#room-input').onkeydown=e=>{if(e.key==='Enter')connect(false);};
$('#ready').onclick=()=>net.setReady(!ready);
$('#start').onclick=async()=>{audio.start();void landscape.enter();const button=$('#start');button.disabled=true;await renderer.ready;if(net.start()){solo=false;selfId=net.selfId;model=new CoopBattle(net.members);model.start();receive(model.snapshot());}else button.disabled=false;};
$('#solo').onclick=async()=>{audio.start();void landscape.enter();setBusy(true);await renderer.ready;setBusy(false);net.close();solo=true;selfId='solo';model=new CoopBattle([{id:selfId,name:$('#nickname').value}]);model.start();receive(model.snapshot());};
$('#leave').onclick=()=>{audio.stop();net.close();lobby=null;showEntry();status('免下载 · 电脑与手机可一起玩');};
$('#copy').onclick=async()=>{const url=new URL(location.href);url.search='';url.searchParams.set('room',net.code);try{await navigator.clipboard.writeText('一起来玩《营救豆包》！房间码：'+net.code+'\n'+url.href);toast('邀请链接和房间码已复制');}catch{toast('房间码：'+net.code+'，可直接告诉朋友。');}};
$('#help-open').onclick=()=>$('#help').showModal();$('#help-close').onclick=()=>$('#help').close();
try{const name=localStorage.getItem('naiwa-coop-name');if(name)$('#nickname').value=name;}catch{}
const initialCode=new URL(location.href).searchParams.get('room');if(initialCode&&validCode(initialCode.toUpperCase())){$('#room-input').value=initialCode.toUpperCase();status('朋友在等你，输入昵称后点击加入。');}
function resetInput(){keys.clear();holds.clear();actions.length=0;joy={mx:0,my:0};Object.assign(input,{mx:0,my:0,attack:false,defend:false,revive:false});$('#knob').style.transform='';}
function isAuthority(){return solo||net.isHost;}
function updateControls(){input.mx=joy.mx+(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);input.my=joy.my+(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);const mag=Math.max(1,Math.hypot(input.mx,input.my));input.mx/=mag;input.my/=mag;input.attack=keys.has('KeyF')||holds.has('attack');input.defend=keys.has('Space')||holds.has('defend');input.revive=keys.has('KeyH')||holds.has('revive');}
const actionKeys={ShiftLeft:'dash',ShiftRight:'dash',KeyE:'laugh',KeyC:'peach',KeyV:'naidan',KeyJ:'jump',KeyQ:'joke',KeyR:'rapid'};
window.addEventListener('keydown',e=>{if(!inGame||e.target instanceof HTMLInputElement)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(!e.repeat){if(e.code==='Escape')togglePause();else if(actionKeys[e.code])actions.push(actionKeys[e.code]);}keys.add(e.code);flushInput(true);});
window.addEventListener('keyup',e=>{keys.delete(e.code);flushInput(true);});window.addEventListener('blur',()=>{resetInput();flushInput(true);});
document.addEventListener('visibilitychange',()=>{resetInput();if(document.hidden&&model&&inGame&&model.phase==='playing'){model.pause(true);toast('房主切到后台，战斗已暂停');}});
for(const button of document.querySelectorAll('[data-hold],[data-action]')){
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);button.classList.add('held');if(button.dataset.hold)holds.add(button.dataset.hold);else actions.push(state?.superCastRemaining>0&&button.dataset.action==='laugh'?'rapid':button.dataset.action);flushInput(true);});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>{if(button.dataset.hold)holds.delete(button.dataset.hold);button.classList.remove('held');flushInput(true);});
}
let stickPointer=null;const stick=$('#joystick');
function moveStick(e){const v=joystickPosition(e.clientX,e.clientY,stick.getBoundingClientRect(),landscape.layout.rotated);joy={mx:v.mx,my:v.my};$('#knob').style.transform=`translate(${v.x}px,${v.y}px)`;flushInput(true);}
stick.onpointerdown=e=>{e.preventDefault();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);};stick.onpointermove=e=>{if(e.pointerId===stickPointer)moveStick(e);};for(const type of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(type,()=>{stickPointer=null;joy={mx:0,my:0};$('#knob').style.transform='';flushInput(true);});
function togglePause(){if(!inGame)return;if(!isAuthority()){toast('由房主暂停或继续对局');return;}if(['playing','upgrade'].includes(model.phase))model.pause(!model.paused);}
$('#pause').onclick=togglePause;
$('#fullscreen').onclick=()=>landscape.toggle();
function exitGame(){landscape.leave();audio.stop();resetInput();model=null;state=null;inGame=false;renderer.state=null;renderer.liveModel=null;receivedEffects.clear();$('#game').hidden=true;$('#home').hidden=false;modalKey='';if(solo){solo=false;showEntry();}else if(net.isHost)net.backToLobby();else{net.close();showEntry();}status('可以重新组队，开始下一次冒险');}
$('#game-exit').onclick=exitGame;
function receive(value){
  if(!value||!ZONES[value.zone])return;
  if(value.effectsDelta){if(!state||state.sceneId!==value.sceneId||value.clock<state.clock)receivedEffects.clear();for(const e of value.effects)receivedEffects.set(e.eid,e);for(const [id,e]of receivedEffects)if(value.clock-e.at>(e.duration||1.15))receivedEffects.delete(id);value={...value,effects:[...receivedEffects.values()]};}
  state=value;if(!inGame){audio.start();inGame=true;$('#game').hidden=false;$('#home').hidden=true;landscape.setPlaying(true);resetInput();modalKey='';lastZone=-1;lastTick=performance.now();accumulator=0;renderer.resize();}
  renderer.selfId=selfId;renderer.liveModel=model;renderer.update(value);
  if(performance.now()-lastHUD>=95||lastHUDPhase!==value.phase){lastHUD=performance.now();lastHUDPhase=value.phase;updateHUD(value);}updateModal(value);
  if(value.zone!==lastZone){lastZone=value.zone;$('#chapter-banner').textContent='第 '+(value.zone+1)+' 章 · '+ZONES[value.zone].name;$('#chapter-banner').hidden=false;setTimeout(()=>$('#chapter-banner').hidden=true,2200);}
}
function updateHUD(s){
  const hud=$('#team-hud');if(teamNodes.length!==s.players.length){teamNodes.length=0;hud.replaceChildren();for(const p of s.players){const d=document.createElement('div');d.className='team-chip';const b=document.createElement('b'),track=document.createElement('div'),fill=document.createElement('i');track.className='hp-track';track.append(fill);d.append(b,track);hud.append(d);teamNodes.push({d,b,fill});}}
  s.players.forEach((p,i)=>{const {d,b,fill}=teamNodes[i];d.classList.toggle('down',p.hero.hp<=0);const text=p.name+(p.id===selfId?' · 你':'')+(!p.connected?' · 离线':p.hero.hp<=0?' · 待救援':' '+Math.ceil(p.hero.hp));if(b.textContent!==text)b.textContent=text;const width=Math.max(0,p.hero.hp/p.hero.maxHp*100)+'%';if(fill.style.width!==width)fill.style.width=width;if(fill.dataset.color!==p.color){fill.style.background=p.color;fill.dataset.color=p.color;}});
  $('#chapter-name').textContent=ZONES[s.zone].name;$('#wave-info').textContent=s.zone===6?'最终营救 · '+s.partySize+' 人合作':'第 '+s.wave+' / '+s.waveTotal+' 波 · '+s.partySize+' 人合作';
  const boss=s.actors.find(a=>a.hp>0&&['boss','captain','general','marshal'].includes(a.kind));$('#boss-hud').hidden=!boss;
  if(boss){$('#boss-name').textContent=NAMES[boss.kind]+(boss.combatPhase===2?' · 第二形态':'');$('#boss-fill').style.width=(boss.hp/boss.maxHp*100)+'%';$('#boss-numbers').textContent=Math.ceil(boss.hp)+' / '+boss.maxHp+' · 血量 ×'+s.partySize;}
  const me=s.players.find(p=>p.id===selfId);if(me){const texts=[me.hero.hp<=0?'你倒下了，等队友靠近扶起':'大笑能量 '+Math.floor(me.energy)+'%',s.dashUnlocked?'冲撞 '+me.dashCharges+'/2':'首章解锁冲撞','罐头 '+me.peaches,'队友奶球误伤 50%'];if(s.zone===6)texts.push(s.superCastRemaining>0?'连点 R / 大笑按钮':s.superUsed?'豆包庇护已使用':'Q 讲笑话 '+Math.round(s.superCharge)+'%');const ability=$('#ability-status');if(abilityNodes.length!==texts.length){abilityNodes.length=0;ability.replaceChildren();for(const text of texts){const span=document.createElement('span');span.className='ability-chip';abilityNodes.push(span);ability.append(span);}}texts.forEach((text,i)=>{if(abilityNodes[i].textContent!==text)abilityNodes[i].textContent=text;});
    $('#dash-touch').disabled=!s.dashUnlocked||me.dashCharges<=0;$('#laugh-touch').disabled=me.energy<100&&s.superCastRemaining<=0;$('#laugh-touch').classList.toggle('ready-glow',me.energy>=100);$('#joke-touch').hidden=s.zone!==6;$('#joke-touch').textContent=s.superCharge>=100?'超笑':'笑话';
    for(const b of document.querySelectorAll('[data-skill="dash"]'))b.disabled=!s.dashUnlocked||me.dashCharges<=0;
    for(const b of document.querySelectorAll('[data-skill="laugh"]')){b.disabled=me.energy<100&&s.superCastRemaining<=0;b.classList.toggle('ready-glow',me.energy>=100);}
  }
  $('#pause').textContent=s.paused?'▶':'Ⅱ';
}
function button(text,fn,style='primary'){const b=document.createElement('button');b.className=style;b.textContent=text;b.onclick=fn;return b;}
function updateModal(s){
  const key=s.paused?'pause':s.phase==='upgrade'?'upgrade:'+s.pending.map(p=>p.id).join(','):['defeat','won'].includes(s.phase)?s.phase:'';
  if(key===modalKey)return;modalKey=key;const visible=!!key;$('#game-modal').hidden=!visible;if(!visible)return;resetInput();
  const eyebrow=$('#modal-eyebrow'),title=$('#modal-title'),description=$('#modal-description'),cards=$('#upgrade-cards'),buttons=$('#modal-actions');cards.replaceChildren();cards.className='';buttons.replaceChildren();
  if(key==='pause'){eyebrow.textContent='歇会儿，再一起笑。';title.textContent='营救暂停中';description.textContent=isAuthority()?'队友的战斗与计时也已暂停。':'房主暂停了对局，请稍候。';if(isAuthority())buttons.append(button('继续营救',()=>model.pause(false)));buttons.append(button('返回大厅',exitGame,'secondary'));}
  else if(s.phase==='upgrade'){eyebrow.textContent='有点上头了';title.textContent='选一招，全队一起变强。';description.textContent=isAuthority()?'选择一个强化，对所有队友生效。':'房主正在为全队选择强化。';cards.className='upgrade-grid';for(const p of s.pending){const b=document.createElement('button');b.className='upgrade-card';b.disabled=!isAuthority();const icon=document.createElement('span'),name=document.createElement('strong'),detail=document.createElement('small');icon.textContent=p.icon;name.textContent=p.name;detail.textContent=p.description;b.append(icon,name,detail);b.onclick=()=>model.chooseUpgrade(p.id);cards.append(b);}}
  else if(s.phase==='defeat'){eyebrow.textContent='只是一起肚子着地了';title.textContent='再来，一定能救到。';description.textContent=isAuthority()?'从本关入口重试，保留进入时的全队强化。':'等房主重试这一关，大家一起重新出发。';if(isAuthority())buttons.append(button('全队重试本关',()=>{resetInput();model.retry();}));buttons.append(button('返回大厅',exitGame,'secondary'));}
  else{eyebrow.textContent='营救成功 · 全城堡都笑场了';title.textContent='豆包，我们一起救到了。';description.textContent=s.players.length+' 位勇者 · 击败 '+s.kills+' 个敌人 · 用时 '+Math.floor(s.elapsed/60)+':'+String(Math.floor(s.elapsed%60)).padStart(2,'0');if(isAuthority())buttons.append(button('再救一次',()=>model.start()));buttons.append(button('返回大厅',exitGame,'secondary'));}
}
function flushInput(immediate=false){
  if(!inGame)return;updateControls();const now=performance.now();
  if(model){model.setInput(selfId,input,actions.splice(0,8));lastSend=now;}
  else if(immediate||now-lastSend>=33){net.sendInput(input,actions.splice(0,8));lastSend=now;}
}
function frame(now){
  const dt=Math.min(.1,Math.max(0,(now-lastTick)/1000));lastTick=now;
  if(inGame){flushInput();renderer.input=input;renderer.liveModel=model;
    if(model){
      const before=model.phase,begin=performance.now();accumulator=model.paused?0:Math.min(.085,accumulator+dt);
      while(accumulator>=1/60){model.update(1/60);accumulator-=1/60;}
      $('#stage').dataset.stepMs=(performance.now()-begin).toFixed(2);
      if(now-lastPublish>=(solo?95:50)||before!==model.phase){lastPublish=now;const value=model.snapshot();receive(value);if(!solo)net.broadcast(value);}
    }
    audio.sync(model||state);renderer.draw(now);if(!solo)net.pulse(now);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
