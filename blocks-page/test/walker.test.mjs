import test from 'node:test';
import assert from 'node:assert/strict';
import {Walker,PLACES,PITCH,frameOf,streetName} from '../dist/walker.mjs';
const run=(walker,seconds,input={},step=1/30)=>{const events=[];for(let t=0;t<seconds;t+=step)events.push(...walker.update(step,input));return events;};

test('cruising north passes junctions and queued right turns happen at the next junction',()=>{
  const w=new Walker();w.x=0;w.z=10;w.h=0;
  w.queue('right');assert.equal(w.queued.side,'right');
  run(w,8);
  assert.equal(w.h,1);assert.ok(Math.abs(w.z)<1e-9,'turned exactly on the junction');assert.ok(w.x>0,'continued east');
});

test('a queued side turn enters a matching door before the next junction',()=>{
  const w=new Walker();w.x=0;w.z=-5;w.h=0;w.queue('left');
  const events=run(w,12);
  assert.ok(events.includes('entered:ramen'));assert.equal(w.mode,'inside');assert.equal(w.place.id,'ramen');
});

test('inside a room movement is bounded and walking out of the door returns to the street',()=>{
  const w=new Walker();w.placeAt('ramen',8,0);
  run(w,10,{forward:true});
  const {a,b}=frameOf(PLACES.ramen).local(w.x,w.z);assert.ok(a<=PLACES.ramen.areas[0][1]+1e-9&&Math.abs(b)<=6.6+1e-9);
  w.yaw+=Math.PI;const events=run(w,12,{forward:true});
  assert.ok(events.includes('left:ramen'));assert.equal(w.mode,'street');
});

test('station gates block the platform until opened, then the train edge boards',()=>{
  const w=new Walker();w.placeAt('station',18,0);
  const blocked=run(w,6,{forward:true});
  assert.ok(blocked.includes('gate-closed'));assert.ok(frameOf(PLACES.station).local(w.x,w.z).a<=20.5+1e-9);
  assert.equal(w.y,-6);
  w.gate=true;const events=run(w,6,{forward:true});assert.ok(events.includes('board'));
});

test('routes reach every door from a distant junction',()=>{
  for(const id of ['gallery','ramen','station']){
    const w=new Walker();w.x=PITCH*3;w.z=PITCH*2+10;w.h=3;w.route(id);
    const events=run(w,120);
    assert.ok(events.includes('entered:'+id),id);assert.equal(w.place.id,id);
  }
});

test('the overview wander stays near the start and never enters doors',()=>{
  const w=new Walker();w.wander();const events=run(w,400,{},1/15);
  assert.ok(!events.some(e=>e.startsWith('enter')));assert.ok(Math.abs(w.x)<=PITCH*3&&Math.abs(w.z)<=PITCH*3);
});

test('street names are stable',()=>{
  assert.deepEqual(streetName(0,-10,0),{jp:'中央通り',en:'CHUO-DORI',chome:1});
  assert.equal(streetName(10,-46,1).en,'AMAOTO-GAI'.length?streetName(10,-46,1).en:'');
});
