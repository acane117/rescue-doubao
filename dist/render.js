import {ZONES,isBoss} from './coop.js';
import {backingSize,cameraTarget,followCamera,walkCycle,interpolate} from './view.js';
const SIZES={hero:185,chaser:126,shooter:148,bomber:127,boss:355,shield:135,bell:127,jester:139,mimic:109,hammer:148,scribe:143,dog:157,penguin:151,captain:230,general:260,marshal:282};
const hex=(n=0xd7af73)=>'#'+Math.max(0,Number(n)||0).toString(16).padStart(6,'0').slice(-6);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const warning=t=>t.endsWith('Warning')||t==='warning';
export class Renderer {
  constructor(canvas){
    this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.images=new Map();this.labels=new Map();this.tracks=new Map();this.walks=new Map();this.state=null;this.liveModel=null;this.last=0;this.lastZone=-1;this.camera={x:0,y:0};this.selfId='';this.input={mx:0,my:0};this.packetAt=0;this.frames=[];this.drawCosts=[];this.entities=[];
    this.bullets={friendly:this.bullet('#ffedac','#fffdf0'),enemy:this.bullet('#cfa9f4','#f1deff')};
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(canvas.parentElement);
    this.ready=Promise.all(['characters/hero-walk-v3.png','characters/hero-poses-v3.png','characters/hero-run','characters/hero-idle','backgrounds/village','characters/chaser','characters/shooter','characters/crate'].map(k=>this.load(k).ready));
  }
  resize(){const width=this.canvas.clientWidth,height=this.canvas.clientHeight;if(width<2||height<2)return;const size=backingSize(width,height,devicePixelRatio||1);if(this.canvas.width!==size.width||this.canvas.height!==size.height){this.canvas.width=size.width;this.canvas.height=size.height;}this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';}
  load(name){
    if(this.images.has(name))return this.images.get(name);const img=new Image();
    img.ready=new Promise(resolve=>{img.onload=()=>{img.loaded=true;resolve(img);};img.onerror=()=>{img.failed=true;resolve(img);};});
    img.src='./assets/'+name+(/\.(png|webp)$/.test(name)?'':'.webp');this.images.set(name,img);return img;
  }
  update(s){
    const previous=this.state;this.packetAt=performance.now();this.state=s;
    if(s.sceneId!==this.lastSceneId||s.zone!==this.lastZone){this.tracks.clear();this.walks.clear();this.lastZone=s.zone;this.lastSceneId=s.sceneId;const p=s.players.find(p=>p.id===this.selfId)||s.players[0];this.camera=cameraTarget(p?.hero,s.arenaScale);}
    this.load('backgrounds/'+ZONES[s.zone].background);
    if(!this.liveModel){
      const duration=previous&&previous.zone===s.zone?clamp(s.clock-previous.clock,1/120,.1):.05;
      for(const [key,a] of [...s.actors.map(a=>['a'+a.id,a]),...s.players.map(p=>['p'+p.id,p.hero]),...s.shots.map(a=>['s'+a.id,a])]){
        let t=this.tracks.get(key);if(!t)t={x:a.x,y:a.y,z:a.z||0,fromX:a.x,fromY:a.y,fromZ:a.z||0,predictX:a.x,predictY:a.y,errorX:0,errorY:0};
        t.fromX=t.renderX??t.x;t.fromY=t.renderY??t.y;t.fromZ=t.renderZ??t.z;t.x=a.x;t.y=a.y;t.z=a.z||0;t.duration=duration;
        if(key==='p'+this.selfId){const errX=a.x+this.input.mx*270*.045-t.predictX,errY=a.y+this.input.my*165*.045-t.predictY;if(Math.hypot(errX,errY)>120||a.hp<=0){t.predictX=a.x;t.predictY=a.y;t.errorX=t.errorY=0;}else{t.errorX=errX;t.errorY=errY;}}
        this.tracks.set(key,t);
      }
    }
  }
  position(key,a,dt){
    if(this.liveModel)return a;const t=this.tracks.get(key);if(!t)return a;
    const age=Math.min(.13,(performance.now()-this.packetAt)/1000);
    if(key==='p'+this.selfId){
      if(!this.state.paused&&a.hp>0&&['idle','run'].includes(a.state)){t.predictX+=this.input.mx*270*dt;t.predictY+=this.input.my*165*dt;}
      const factor=1-Math.exp(-dt*18),cx=t.errorX*factor,cy=t.errorY*factor;t.predictX+=cx;t.predictY+=cy;t.errorX-=cx;t.errorY-=cy;
      const scale=this.state.arenaScale;t.predictX=clamp(t.predictX,60*scale,1210*scale);t.predictY=clamp(t.predictY,432*scale,617*scale);
      return{x:t.predictX,y:t.predictY,z:interpolate(t.fromZ,t.z,Math.min(1,age/t.duration))};
    }
    // Finish at the last confirmed position instead of overshooting it and
    // reversing on the next packet. Begin each packet at the displayed point.
    const factor=clamp(age/t.duration,0,1);
    t.renderX=interpolate(t.fromX,t.x,factor);t.renderY=interpolate(t.fromY,t.y,factor);t.renderZ=interpolate(t.fromZ,t.z,factor);
    return{x:t.renderX,y:t.renderY,z:t.renderZ};
  }
  bullet(color,center){const canvas=document.createElement('canvas');canvas.width=canvas.height=48;const c=canvas.getContext('2d');const g=c.createRadialGradient(24,24,2,24,24,23);g.addColorStop(0,center);g.addColorStop(.2,color);g.addColorStop(.45,color+'9c');g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(0,0,48,48);return canvas;}
  label(text,size=13,color='#766080',background='#fffcf3eb'){
    const key=text+'|'+size+'|'+color+'|'+background;if(this.labels.has(key))return this.labels.get(key);
    const canvas=document.createElement('canvas'),c=canvas.getContext('2d');c.font=`600 ${size}px "Microsoft YaHei",sans-serif`;const w=Math.ceil(c.measureText(text).width+16),h=size+12;
    canvas.width=w*2;canvas.height=h*2;c.scale(2,2);c.font=`600 ${size}px "Microsoft YaHei",sans-serif`;
    c.fillStyle=background;c.beginPath();c.roundRect(0,0,w,h,8);c.fill();c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.fillText(text,w/2,h/2+.5);
    const label={canvas,w,h};if(this.labels.size>=160)this.labels.delete(this.labels.keys().next().value);this.labels.set(key,label);return label;
  }
  text(text,x,y,size=13,color,background,alpha=1){const l=this.label(text,size,color,background);this.ctx.globalAlpha=alpha;this.ctx.drawImage(l.canvas,x-l.w/2,y-l.h/2,l.w,l.h);this.ctx.globalAlpha=1;}
  draw(now){
    const s=this.liveModel||this.state;if(!s)return;const start=performance.now(),dt=Math.min(.05,(now-this.last)/1000||1/60);if(this.last>0)this.frames.push(now-this.last);this.last=now;
    const c=this.ctx;
    // Replace every physical pixel at full opacity before drawing this frame.
    c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';c.filter='none';c.shadowBlur=0;c.shadowOffsetX=c.shadowOffsetY=0;c.fillStyle='#e5e4c9';c.fillRect(0,0,this.canvas.width,this.canvas.height);
    c.setTransform(this.canvas.width/1280,0,0,this.canvas.height/720,0,0);c.imageSmoothingEnabled=true;
    const me=s.players.find(p=>p.id===this.selfId&&p.connected)||s.players.find(p=>p.connected),local=me?this.position('p'+me.id,me.hero,dt):null;
    this.camera=followCamera(this.camera,local,s.arenaScale);
    const worldWidth=1280*s.arenaScale,worldHeight=720*s.arenaScale,bg=this.load('backgrounds/'+ZONES[s.zone].background);
    if(bg.loaded)c.drawImage(bg,-this.camera.x,-this.camera.y,worldWidth,worldHeight);
    c.save();c.translate(-this.camera.x,-this.camera.y);
    for(const e of s.effects||[])if(warning(e.type))this.effect(e,s.clock,true);
    this.entities.length=0;for(const a of s.actors)this.entities.push({a,key:'a'+a.id});for(const p of s.players)if(p.connected)this.entities.push({a:p.hero,p,key:'p'+p.id});for(const a of s.crates||[])this.entities.push({a:{...a,kind:'crate',z:0,face:1},key:'c'+a.id});
    this.entities.sort((a,b)=>a.a.y-b.a.y);
    for(const {a,p,key}of this.entities){const at=p===me?local:this.position(key,a,dt);if(at.x<this.camera.x-230||at.x>this.camera.x+1510||at.y<this.camera.y-250||at.y>this.camera.y+970)continue;this.actor(a,p,at,dt);}
    for(const shot of s.shots){const at=this.position('s'+shot.id,shot,dt),x=at.x,y=at.y-at.z;if(x<this.camera.x-25||x>this.camera.x+1305||y<this.camera.y-25||y>this.camera.y+745)continue;c.drawImage(this.bullets[shot.enemy?'enemy':'friendly'],x-20,y-20,40,40);}
    for(const e of s.effects||[])if(!warning(e.type))this.effect(e,s.clock,false);
    if(['rescue','won'].includes(s.phase)){const img=this.load('characters/princess');if(img.loaded){const h=195,w=h*img.width/img.height;c.drawImage(img,(s.arenaCenter?.x||960)-w/2,560*s.arenaScale-h,w,h);}}
    c.restore();
    if(s.superCastRemaining>0){c.fillStyle='#b58ac433';c.fillRect(0,0,1280,720);this.text(s.superClickRemaining>0?'哈哈哈哈哈哈！':'连点 R / 大笑，让笑声继续',640,250,24,'#8a6a4f','#fff5d9eb');}
    this.minimap(s,bg,worldWidth,worldHeight);
    this.drawCosts.push(performance.now()-start);
    if(this.frames.length>=120){const values=this.frames.slice().sort((a,b)=>a-b),stage=this.canvas.parentElement;stage.dataset.fps=(1000/(this.frames.reduce((a,b)=>a+b)/this.frames.length)).toFixed(1);stage.dataset.frameP95=values[Math.floor(values.length*.95)].toFixed(2);stage.dataset.renderMs=(this.drawCosts.reduce((a,b)=>a+b)/this.drawCosts.length).toFixed(2);this.frames.length=this.drawCosts.length=0;}
  }
  actor(a,p,at,dt=1/60){
    const c=this.ctx,x=at.x,y=at.y,z=at.z||0,height=SIZES[a.kind]||88,fallen=p&&a.hp<=0;
    c.save();c.fillStyle=p?p.color+'70':'#48384524';c.beginPath();c.ellipse(x,y+3,p?27:Math.min(58,height*.24),p?9:Math.min(15,height*.07),0,0,Math.PI*2);c.fill();if(p){c.strokeStyle=p.color;c.lineWidth=2;c.stroke();}
    const guard=p?.defending,laugh=a.state==='laugh'||a.state==='superLaugh';let name='characters/'+a.kind;
    if(isBoss(a.kind)&&a.combatPhase===2)name='characters/boss-variants/'+a.kind+'-'+(/Warn$/.test(a.state)?'attack':'phase2');else if(a.kind==='penguin'&&a.rageTime>0)name='characters/penguin-rage';
    let gait;
    if(p){const active=!fallen&&!guard&&!laugh&&(['run','dash'].includes(a.state)||(p.id===this.selfId&&a.state==='idle'&&Math.hypot(this.input.mx,this.input.my)>.05));gait=walkCycle(this.walks.get(p.id),at,active,dt);this.walks.set(p.id,gait);}
    const running=gait?.moving;
    const img=p?this.load(running?'characters/hero-walk-v3.png':'characters/hero-poses-v3.png'):this.load(name),art=img.failed?this.load(p?(running?'characters/hero-run':'characters/hero-idle'):'characters/'+a.kind):img;
    c.translate(x,y-z);if(fallen){c.rotate(-Math.PI/2);c.globalAlpha=.48;}else if(a.dead)c.globalAlpha=clamp(a.timer/.65,0,1);
    const face=p&&p.id===this.selfId&&!this.liveModel&&Math.abs(this.input.mx)>.05?Math.sign(this.input.mx):a.face;if(face<0)c.scale(-1,1);
    if(art.loaded){
      if(p&&art===img&&!img.failed){
        const cell=running?gait.frame:guard?2:laugh?1:0,cols=running?4:3,rows=running?2:1,fw=art.width/cols,fh=art.height/rows,w=height*fw/fh;
        // The generated rows have different padding; align actual soles, not
        // cell bottoms. Exclude the two-pixel neighbor spill at frame seven.
        const baseline=running?(cell<4?530:498)/543:812/887,inset=running&&cell===7?20:0,ratio=height/fh;
        c.drawImage(art,(cell%cols)*fw+inset,Math.floor(cell/cols)*fh,fw-inset,fh,-w/2+inset*ratio,-height*baseline,w-inset*ratio,height);
      }
      else if(p){const frames=running?8:6,fw=art.width/frames,w=height*fw/art.height;c.drawImage(art,(running?gait.frame:0)*fw,0,fw,art.height,-w/2,-height,w,height);}
      else{const w=height*art.width/art.height;c.drawImage(art,-w/2,-height,w,height);}
    }
    c.restore();
    if(p){this.text(p.name,x,y-z-height*.91-7,12);if(fallen){this.text('按住 H 扶起',x,y-36,11,'#9c7a9f');if(p.reviveProgress){c.fillStyle='#d5c7db';c.fillRect(x-30,y-22,60,5);c.fillStyle='#b8d898';c.fillRect(x-30,y-22,60*p.reviveProgress/3,5);}}
      if(guard){c.strokeStyle='#d4c1e699';c.lineWidth=4;c.beginPath();c.ellipse(x,y-z-78,48,72,0,0,Math.PI*2);c.stroke();}
      const stage=p.naidanStage||(p.naidanElapsed<0?'off':p.naidanElapsed<1.185?'call':p.naidanElapsed<5.202?'laugh':'linger');if(stage!=='off'){const egg=this.load('characters/naidan-'+(stage==='call'?'call':stage==='laugh'?'laugh':'idle'));if(egg.loaded)c.drawImage(egg,x-110,y-z-130,100,100);}
    }else if(a.hp>0&&a.hp<a.maxHp&&!isBoss(a.kind)&&a.kind!=='crate'){c.fillStyle='#ecddd9';c.fillRect(x-21,y-z-height-8,42,4);c.fillStyle='#c5a2af';c.fillRect(x-21,y-z-height-8,42*a.hp/a.maxHp,4);}
  }
  effect(e,clock,ground){
    const c=this.ctx,age=clock-e.at,duration=Number(e.duration)||1.1;if(age<0||age>duration)return;const x=e.x,y=e.y,alpha=Math.max(0,1-age/duration);c.save();
    if(ground){c.fillStyle=hex(e.color)+'22';c.strokeStyle=hex(e.color)+'b0';c.lineWidth=2;
      if(e.type==='rectWarning'){c.beginPath();c.roundRect(x-e.width/2,y-e.height/2,e.width,e.height,12);c.fill();c.stroke();}
      else if(e.type==='laneWarning'){c.fillRect(0,y-33,1920,66);c.strokeRect(0,y-33,1920,66);}
      else{const r=Math.max(25,Number(e.amount)||90);c.beginPath();c.ellipse(x,y,r,r/1.6,0,0,Math.PI*2);c.fill();c.stroke();}
    }else if(['laugh','shock','quake','superPulse','bossDefeat','heal'].includes(e.type)){c.globalAlpha=alpha;c.strokeStyle=e.type==='heal'?'#b6e6b7':'#fff0ba';c.lineWidth=4;const r=Math.max(30,(Number(e.amount)||100)*(Math.min(1,age*3)+.15));c.beginPath();c.ellipse(x,y,r,r/1.6,0,0,Math.PI*2);c.stroke();}
    else if(e.text||e.type==='hit'||e.type==='hurt'){const content=e.text||(e.type==='hurt'?'-':'')+Math.round(Number(e.amount)||0);this.text(content,x,y-(e.z||50)-age*28,e.type==='skillTell'?16:12,e.type==='hurt'?'#c4868c':'#9a80a6','#fffaf1e6',alpha);}
    c.restore();
  }
  minimap(s,bg,w,h){const c=this.ctx,x=1120,y=77,mw=132,mh=62;c.save();c.fillStyle='#fffcf0eb';c.beginPath();c.roundRect(x-5,y-5,mw+10,mh+10,11);c.fill();if(bg.loaded){c.globalAlpha=.45;c.drawImage(bg,x,y,mw,mh);c.globalAlpha=1;}c.strokeStyle='#aa96b68a';c.lineWidth=1;c.strokeRect(x+this.camera.x/w*mw,y+this.camera.y/h*mh,1280/w*mw,720/h*mh);for(const p of s.players)if(p.connected){c.fillStyle=p.hero.hp>0?p.color:'#b8a8bd';c.strokeStyle='#7d6489';c.beginPath();c.arc(x+p.hero.x/w*mw,y+p.hero.y/h*mh,p.id===this.selfId?3.5:2.5,0,Math.PI*2);c.fill();c.stroke();}c.restore();}
}
