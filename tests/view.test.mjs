import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraTarget,backingSize,followCamera,walkCycle,interpolate} from '../dist/view.js';
test('camera follows the player without exposing outside the larger map',()=>{
  assert.deepEqual(cameraTarget({x:200,y:700},1.5),{x:0,y:180});assert.deepEqual(cameraTarget({x:1800,y:925},1.5),{x:640,y:360});assert.deepEqual(cameraTarget({x:1000,y:800},1.5),{x:390,y:280});
});
test('retina backing store is crisp and capped to a bounded pixel budget',()=>{
  assert.deepEqual(backingSize(800,450,2),{width:1600,height:900});const s=backingSize(3840,2160,3);assert.ok(s.width*s.height<3610000);assert.ok(s.width>0&&s.height>0);
});
test('camera stays still in its safe area and stops immediately at the boundary',()=>{
  const initial={x:100,y:180};assert.deepEqual(followCamera(initial,{x:700,y:720}),initial);
  const edge=followCamera(initial,{x:1000,y:840});assert.deepEqual(edge,{x:140,y:230});
  for(let i=0;i<120;i++)assert.deepEqual(followCamera(edge,{x:1000,y:840}),edge);
  assert.deepEqual(followCamera(edge,{x:990,y:830}),edge);
  assert.deepEqual(followCamera(edge,{x:4000,y:4000}),{x:640,y:360});
});
test('walk animation uses eight distinct frames and stops on released input',()=>{
  let gait=walkCycle(null,{x:0,y:700},true);const frames=new Set([gait.frame]);
  for(let i=1;i<=40;i++){gait=walkCycle(gait,{x:i*4.5,y:700},true);frames.add(gait.frame);}
  assert.equal(frames.size,8);assert.equal(gait.frame,0);
  gait=walkCycle(gait,{x:180,y:700},false);assert.equal(gait.moving,false);assert.equal(gait.travel,0);
});
test('duplicate display frames preserve gait; blocked movement settles to idle',()=>{
  let gait=walkCycle(null,{x:0,y:700},true);gait=walkCycle(gait,{x:30,y:700},true);
  const frame=gait.frame;
  gait=walkCycle(gait,{x:30,y:700},true,1/144);assert.equal(gait.moving,true);assert.equal(gait.frame,frame);
  for(let i=0;i<20;i++)gait=walkCycle(gait,{x:30,y:700},true,1/144);
  assert.equal(gait.moving,false);
});
test('vertical and horizontal movement have the same cadence, teleports reset gait',()=>{
  let x=walkCycle(null,{x:200,y:700},true),y=walkCycle(null,{x:200,y:700},true);
  for(let i=1;i<=20;i++){x=walkCycle(x,{x:200+4.5*i,y:700},true);y=walkCycle(y,{x:200,y:700+2.75*i},true);assert.equal(x.frame,y.frame);}
  assert.equal(walkCycle(x,{x:1500,y:700},true).moving,false);
});
test('snapshot interpolation never overshoots the confirmed position',()=>{
  assert.equal(interpolate(100,200,1.4),200);assert.equal(interpolate(200,100,1.4),100);assert.equal(interpolate(100,200,-.2),100);
});
