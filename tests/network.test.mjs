import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {RoomNetwork,validCode,PROTOCOL} from '../dist/network.js';
class Connection extends EventEmitter {
  constructor(peer){super();this.peer=peer;this.open=false;}
  send(m){if(!this.open)throw new Error('closed');const copy=structuredClone(m);queueMicrotask(()=>{if(this.other?.open)this.other.emit('data',copy);});}
  close(){if(this.closing)return;this.closing=true;this.open=false;queueMicrotask(()=>this.emit('close'));if(this.other&&!this.other.closing)this.other.close();}
}
class FakePeer extends EventEmitter {
  static peers=new Map();static next=0;
  constructor(id){super();this.id=typeof id==='string'?id:'guest-'+(++FakePeer.next);this.connections=[];FakePeer.peers.set(this.id,this);queueMicrotask(()=>this.emit('open',this.id));}
  connect(id){const c=new Connection(id),peer=FakePeer.peers.get(id);if(!peer){queueMicrotask(()=>this.emit('error',{type:'peer-unavailable'}));return c;}const other=new Connection(this.id);c.other=other;other.other=c;this.connections.push(c);peer.connections.push(other);queueMicrotask(()=>{peer.emit('connection',other);c.open=other.open=true;other.emit('open');c.emit('open');});return c;}
  destroy(){FakePeer.peers.delete(this.id);for(const c of this.connections)c.close();}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('real room protocol: join, prepare, start, independent controls, state and leave',async()=>{
  let control,received;const host=new RoomNetwork({Peer:FakePeer,onInput:(...args)=>control=args});const guest=new RoomNetwork({Peer:FakePeer,onState:s=>received=s});
  try{
    const code=await host.open(true,'','房主');assert.ok(validCode(code));await guest.open(false,code,'队友');assert.equal(host.members.length,2);assert.equal(host.start(),false);
    guest.setReady(true);await flush();assert.equal(host.start(),true);
    guest.sendInput({mx:1,attack:true},['dash']);await flush();assert.equal(control[0],guest.selfId);assert.equal(control[1].attack,true);assert.deepEqual(control[2],['dash']);
    host.broadcast({type:'state',v:PROTOCOL,players:[{},{}],actors:[],shots:[],frame:42});await flush();assert.equal(received.frame,42);
    guest.close();await flush();assert.equal(host.members.length,1);
  }finally{host.close();guest.close();}
});
test('effect history is sent once per peer, while stalled peers do not queue old states',async()=>{
  let packets=[];const host=new RoomNetwork({Peer:FakePeer}),guest=new RoomNetwork({Peer:FakePeer,onState:s=>packets.push(s)});try{const code=await host.open(true,'','房主');await guest.open(false,code,'队友');const state={type:'state',v:PROTOCOL,players:[{}],actors:[],shots:[],effects:[{eid:1,type:'hit'}]};host.broadcast(state);host.broadcast(state);await flush();assert.equal(packets[0].effects.length,1);assert.equal(packets[1].effects.length,0);const c=host.connections.get(guest.selfId);c.dataChannel={bufferedAmount:100000};host.broadcast({...state,frame:3});await flush();assert.equal(packets.length,2);}finally{guest.close();host.close();}
});
test('starting a new scene resets each peer effect sequence',async()=>{const packets=[],host=new RoomNetwork({Peer:FakePeer}),guest=new RoomNetwork({Peer:FakePeer,onState:s=>packets.push(s)});try{const code=await host.open(true,'','房主');await guest.open(false,code,'队友');const base={type:'state',v:PROTOCOL,players:[{}],actors:[],shots:[]};host.broadcast({...base,sceneId:'first',effects:[{eid:50,type:'hit'}]});host.broadcast({...base,sceneId:'second',effects:[{eid:1,type:'laugh'}]});await flush();assert.equal(packets[1].effects[0].eid,1);}finally{guest.close();host.close();}});
test('rooms reject joining an active battle',async()=>{
  const host=new RoomNetwork({Peer:FakePeer}),guest=new RoomNetwork({Peer:FakePeer});try{const code=await host.open(true,'','房主');host.start();await assert.rejects(guest.open(false,code,'迟到'),/已经出发/);}finally{guest.close();host.close();}
});
test('room maximum is four, and replayed inputs do not execute twice',async()=>{
  const guests=[];let calls=0;const host=new RoomNetwork({Peer:FakePeer,onInput:()=>calls++});try{
    const code=await host.open(true,'','房主');for(let i=0;i<3;i++){const g=new RoomNetwork({Peer:FakePeer});guests.push(g);await g.open(false,code,'队友'+i);g.setReady(true);await flush();}
    const extra=new RoomNetwork({Peer:FakePeer});guests.push(extra);await assert.rejects(extra.open(false,code,'额外'),/房间已满/);
    assert.equal(host.members.length,4);host.start();const g=guests[0];g.hostConnection.send({type:'input',seq:1,input:{mx:1},actions:['laugh']});g.hostConnection.send({type:'input',seq:1,input:{mx:1},actions:['laugh']});await flush();assert.equal(calls,1);
  }finally{guests.forEach(g=>g.close());host.close();}
});
