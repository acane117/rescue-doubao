import test from 'node:test';
import assert from 'node:assert/strict';
import {landscapeLayout,joystickPosition} from '../dist/mobile.js';
test('portrait phones use the same 16:9 arena as physically landscape phones',()=>{
  for(const [w,h] of [[390,844],[375,667],[320,568],[430,932]]){
    const portrait=landscapeLayout(w,h),landscape=landscapeLayout(h,w);
    assert.equal(portrait.mobile,true);assert.equal(portrait.rotated,true);assert.equal(landscape.rotated,false);
    assert.equal(portrait.width,landscape.width);assert.equal(portrait.height,landscape.height);
    assert.ok(portrait.width<=h);assert.ok(portrait.height<=w);assert.ok(Math.abs(portrait.width/portrait.height-16/9)<.0001);
  }
});
test('touch tablets rotate while normal desktop windows keep their existing layout',()=>{
  assert.equal(landscapeLayout(834,1194,true).rotated,true);assert.equal(landscapeLayout(1440,900).mobile,false);
});
test('rotated joystick maps physical screen motion back to game directions',()=>{
  const rect={left:0,top:0,width:100,height:100};
  const right=joystickPosition(50,85,rect,true),up=joystickPosition(85,50,rect,true);
  assert.equal(right.mx,1);assert.equal(right.my,0);assert.equal(up.mx,0);assert.equal(up.my,-1);
  const normal=joystickPosition(85,50,rect);assert.equal(normal.mx,1);assert.equal(normal.my,0);
  const diagonal=joystickPosition(150,150,rect,true);assert.ok(Math.abs(Math.hypot(diagonal.mx,diagonal.my)-1)<.0001);
});
