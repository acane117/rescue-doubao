export function landscapeLayout(width,height,touch=false){
  const mobile=touch||Math.min(width,height)<=600;
  const rotated=mobile&&height>width;
  const availableWidth=rotated?height:width,availableHeight=rotated?width:height;
  const stageWidth=Math.min(availableWidth,availableHeight*16/9);
  return {mobile,rotated,width:stageWidth,height:stageWidth*9/16};
}
export function joystickPosition(clientX,clientY,rect,rotated=false){
  const dx=clientX-rect.left-rect.width/2,dy=clientY-rect.top-rect.height/2;
  const radius=Math.max(1,(rotated?rect.height:rect.width)*.35);
  let x=rotated?dy:dx,y=rotated?-dx:dy;const length=Math.max(1,Math.hypot(x,y)/radius);
  x/=length;y/=length;return {mx:x/radius||0,my:y/radius||0,x,y};
}
export class LandscapeMode {
  constructor(game,stage,onResize=()=>{}){
    this.game=game;this.stage=stage;this.onResize=onResize;this.playing=false;this.ownsFullscreen=false;
    this.update=()=>{
      const touch=window.matchMedia('(pointer: coarse)').matches;
      this.layout=landscapeLayout(window.innerWidth,window.innerHeight,touch);
      game.classList.toggle('mobile-play',this.layout.mobile);game.classList.toggle('portrait-play',this.layout.rotated);
      stage.style.setProperty('--play-width',this.layout.width+'px');stage.style.setProperty('--play-height',this.layout.height+'px');
      document.body.classList.toggle('mobile-battle',this.playing&&this.layout.mobile);this.onResize();
    };
    window.addEventListener('resize',this.update);window.addEventListener('orientationchange',this.update);document.addEventListener('fullscreenchange',this.update);window.visualViewport?.addEventListener('resize',this.update);this.update();
  }
  setPlaying(value){this.playing=value;this.update();}
  async enter(force=false){
    if(!force&&!window.matchMedia('(pointer: coarse)').matches)return;
    try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen({navigationUI:'hide'});this.ownsFullscreen=true;}}catch{}
    if(this.layout.mobile)try{await screen.orientation?.lock?.('landscape');}catch{}
    this.update();
  }
  async toggle(){if(document.fullscreenElement){try{screen.orientation?.unlock?.();await document.exitFullscreen();}catch{}this.ownsFullscreen=false;}else await this.enter(true);}
  leave(){
    this.setPlaying(false);try{screen.orientation?.unlock?.();}catch{}
    if(this.ownsFullscreen&&document.fullscreenElement)document.exitFullscreen?.().catch(()=>{});this.ownsFullscreen=false;
  }
}
