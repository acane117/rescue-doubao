const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function backingSize(width,height,dpr=1){
  const density=Math.min(2,Math.max(1,dpr),Math.sqrt(3600000/Math.max(1,width*height)));
  return {width:Math.max(1,Math.round(width*density)),height:Math.max(1,Math.round(height*density))};
}
export function cameraTarget(hero,scale=1.5){
  return {x:clamp((hero?.x||640)-610,0,1280*scale-1280),y:clamp((hero?.y||530)-520,0,720*scale-720)};
}
// Only move the view when the player leaves this rectangle. No delayed pursuit
// remains after movement ends, and small direction changes keep the scene still.
export function followCamera(camera,hero,scale=1.5){
  if(!hero)return camera;
  return {x:clamp(camera.x+Math.min(0,hero.x-camera.x-420)+Math.max(0,hero.x-camera.x-860),0,Math.max(0,1280*scale-1280)),
    y:clamp(camera.y+Math.min(0,hero.y-camera.y-420)+Math.max(0,hero.y-camera.y-610),0,Math.max(0,720*scale-720))};
}
// One complete eight-frame gait spans 180 world units. Normalize the vertical
// axis for this game's shallower walking plane; blocked feet stay planted.
export function walkCycle(previous,position,active,dt=1/60){
  const distance=previous?Math.hypot(position.x-previous.x,(position.y-previous.y)*270/165):0;
  const stillTime=distance>.05?0:(previous?.stillTime||0)+dt;
  // A display can draw twice between fixed 60Hz physics steps. Preserve the
  // gait across that duplicate frame instead of flickering back to idle.
  const moving=Boolean(active&&distance<90&&(!previous||distance>.05||(previous.moving&&stillTime<.1)));
  const travel=moving?(previous?.travel||0)+distance:0;
  return {x:position.x,y:position.y,travel:travel%180,frame:Math.floor((travel%180)/22.5),moving,stillTime};
}
export function interpolate(from,to,factor){return from+(to-from)*Math.min(1,Math.max(0,factor));}
