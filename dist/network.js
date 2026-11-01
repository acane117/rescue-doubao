import {cleanName,cleanInput} from './coop.js';
export const PROTOCOL=2;
const PREFIX='naiwa-coop-2-';
const alphabet='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export function roomCode(){const a=new Uint8Array(6);crypto.getRandomValues(a);return [...a].map(x=>alphabet[x%alphabet.length]).join('');}
export function validCode(s){return /^[23456789A-HJ-NP-Z]{6}$/.test(s);}
export class RoomNetwork {
  constructor({Peer=globalThis.Peer,onLobby=()=>{},onState=()=>{},onInput=()=>{},onDisconnect=()=>{},onError=()=>{},onStatus=()=>{},onLatency=()=>{}}={}){
    Object.assign(this,{Peer,onLobby,onState,onInput,onDisconnect,onError,onStatus,onLatency});
    this.peer=null;this.connections=new Map();this.members=[];this.selfId='';this.code='';this.isHost=false;this.started=false;this.seq=0;this.closed=false;this.generation=0;
  }
  async open(host,code,name){
    this.close();this.closed=false;const gen=++this.generation;this.isHost=host;this.code=host?roomCode():String(code).toUpperCase().trim();
    if(!validCode(this.code))throw new Error('请输入 6 位房间码');
    if(!this.Peer)throw new Error('联机组件未加载，请刷新重试');
    this.name=cleanName(name);this.onStatus('正在连接房间服务…');
    return new Promise((resolve,reject)=>{
      let settled=false;const timer=setTimeout(()=>fail(new Error('连接超时，请换一个网络重试')),16000);
      const fail=e=>{if(gen!==this.generation)return;if(!settled){settled=true;clearTimeout(timer);reject(e);}else this.onError(e.message||'连接中断');};
      this.peer=host?new this.Peer(PREFIX+this.code,{debug:0}):new this.Peer({debug:0});
      this.peer.on('open',id=>{
        if(gen!==this.generation)return;this.selfId=id;
        if(host){this.members=[{id,name:this.name,ready:true}];this.notifyLobby();settled=true;clearTimeout(timer);resolve(this.code);}
        else{
          const c=this.peer.connect(PREFIX+this.code,{reliable:true,serialization:'json',metadata:{v:PROTOCOL}});this.hostConnection=c;
          c.on('open',()=>c.send({type:'hello',v:PROTOCOL,name:this.name}));
          c.on('data',m=>{if(gen!==this.generation)return;
            if(m?.type==='lobby'&&m.v===PROTOCOL&&Array.isArray(m.members)&&m.members.length<=4){this.members=m.members;this.started=m.started===true;this.onLobby(this.lobby());if(!settled){settled=true;clearTimeout(timer);resolve(this.code);}}
            else if(m?.type==='state'&&m.v===PROTOCOL&&Array.isArray(m.players)&&m.players.length<=4&&Array.isArray(m.actors)&&m.actors.length<=200&&Array.isArray(m.shots)&&m.shots.length<=500)this.onState(m);
            else if(m?.type==='ping')c.send({type:'pong',sent:m.sent});
            else if(m?.type==='pong'&&Number.isFinite(m.sent))this.onLatency(Math.max(0,Date.now()-m.sent));
            else if(m?.type==='reject')fail(new Error(m.reason||'无法进入房间'));
          });
          c.on('close',()=>{if(gen===this.generation&&!this.closed){if(!settled)fail(new Error('房间连接已关闭'));else this.onDisconnect('host');}});
          c.on('error',fail);
        }
      });
      this.peer.on('connection',c=>{if(host&&gen===this.generation)this.accept(c);else c.close();});
      this.peer.on('error',e=>fail(new Error(({ 'peer-unavailable':'没有找到房间，请检查房间码，确认房主仍在线。','unavailable-id':'房间码冲突，请重新创建房间。','network':'房间服务暂时无法连接，请检查网络。','webrtc':'当前网络无法建立直连，请双方切换网络后重试。'})[e.type]||'联机连接失败，请重试。')));
      this.peer.on('disconnected',()=>{if(!this.closed){this.onStatus('房间服务重连中，已建立的对局仍可继续');try{this.peer.reconnect();}catch{}}});
    });
  }
  accept(c){
    const generation=this.generation;let admitted=false;let lastSeq=-1;let recent=0;let count=0;
    const timeout=setTimeout(()=>{if(!admitted)c.close();},8000);
    c.on('data',m=>{
      if(generation!==this.generation||!m||typeof m!=='object')return;
      if(!admitted){
        if(m.type!=='hello'||m.v!==PROTOCOL)return;
        const reason=this.started?'本局已经出发，请等房主返回大厅后再加入。':this.members.length>=4?'房间已满，最多 4 人。':null;
        if(reason){c.send({type:'reject',reason});setTimeout(()=>c.close(),250);return;}
        admitted=true;clearTimeout(timeout);this.connections.set(c.peer,c);this.members.push({id:c.peer,name:cleanName(m.name),ready:false});this.notifyLobby();return;
      }
      if(m.type==='ping'&&Number.isFinite(m.sent))c.send({type:'pong',sent:m.sent});
      else if(m.type==='pong'&&Number.isFinite(m.sent))this.onLatency(Math.max(0,Date.now()-m.sent));
      else if(m.type==='ready'&&!this.started){const p=this.members.find(p=>p.id===c.peer);if(p)p.ready=m.ready===true;this.notifyLobby();}
      else if(m.type==='input'&&this.started&&Number.isSafeInteger(m.seq)&&m.seq>lastSeq){
        const now=Date.now();if(now-recent>=1000){recent=now;count=0;}if(++count>60)return;lastSeq=m.seq;
        this.onInput(c.peer,cleanInput(m.input),Array.isArray(m.actions)?m.actions.slice(0,8):[]);
      }
    });
    c.on('close',()=>{clearTimeout(timeout);if(!admitted||generation!==this.generation)return;this.connections.delete(c.peer);this.members=this.members.filter(p=>p.id!==c.peer);this.onDisconnect(c.peer);this.notifyLobby();});
    c.on('error',()=>c.close());
  }
  lobby(){return {code:this.code,members:this.members,isHost:this.isHost,selfId:this.selfId,started:this.started};}
  notifyLobby(){const m={type:'lobby',v:PROTOCOL,members:this.members,started:this.started};this.broadcast(m);this.onLobby(this.lobby());}
  setReady(ready){if(this.isHost)return;this.hostConnection?.send({type:'ready',ready});}
  start(){if(!this.isHost||this.members.some(p=>!p.ready))return false;this.started=true;this.notifyLobby();return true;}
  backToLobby(){if(this.isHost){this.started=false;for(const p of this.members)p.ready=p.id===this.selfId;this.notifyLobby();}}
  broadcast(m){for(const c of this.connections.values())if(c.open){try{if(m.type==='state'){if(c.dataChannel?.bufferedAmount>64000)continue;if(c.lastSceneId!==m.sceneId){c.lastSceneId=m.sceneId;c.lastEffectId=0;}const effects=m.effects?.filter(e=>e.eid>(c.lastEffectId||0))||[];c.send({...m,effects,effectsDelta:true});if(effects.length)c.lastEffectId=effects[effects.length-1].eid;}else c.send(m);}catch{}}}
  pulse(now){if(!this.started||now-(this.lastPing||0)<2000)return;this.lastPing=now;const message={type:'ping',sent:Date.now()};if(this.isHost)this.broadcast(message);else if(this.hostConnection?.open)this.hostConnection.send(message);}
  sendInput(input,actions){if(this.isHost)this.onInput(this.selfId,input,actions);else if(this.hostConnection?.open)this.hostConnection.send({type:'input',seq:++this.seq,input,actions});}
  close(){this.closed=true;this.generation++;for(const c of this.connections.values())try{c.close();}catch{}this.connections.clear();try{this.hostConnection?.close();this.peer?.destroy();}catch{}this.hostConnection=null;this.peer=null;this.members=[];this.started=false;}
}
