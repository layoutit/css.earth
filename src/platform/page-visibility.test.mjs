import test from 'node:test';
import assert from 'node:assert/strict';
import {projectCityPage} from '../renderers/css/dist/testing.js';
const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const outside=[[40,80],[80,40],[180,140],[140,180]];
const crossing=[[0,80],[80,0],[100,20],[20,100]];
const enclosing=[[-100,-100],[100,-100],[100,100],[-100,100]];
for(const physical of [false,true])test(`prepared quad visibility rejects empty bounding-box overlap (${physical?'physical':'legacy'})`,()=>{
  const viewport={width:100,height:100,...(physical?{projection:{focalPixels:100,principalOffsetPixels:[0,0]}}:{})};
  const project=(points,extra={})=>projectCityPage({corners:points.map(([x,y])=>[x,y,physical?-100:0]),normal:[0,0,1],...extra},identity,1,viewport);
  assert.equal(project(outside).visible,false);
  // All four vertices lie outside the viewport, but the face crosses its corner.
  assert.equal(project(crossing).visible,true);
  assert.equal(project(enclosing).visible,true);
  assert.equal(project(enclosing,{coverageCorners:outside.map(([x,y])=>[x,y,physical?-100:0])}).visible,false);
  const shifted={...viewport,originX:0,originY:0};
  assert.equal(projectCityPage({corners:outside.map(([x,y])=>[x,y,physical?-100:0]),normal:[0,0,1]},identity,1,shifted).visible,true);
});

test('near-plane crossings and volume bounds remain conservative',()=>{
  const viewport={width:100,height:100,projection:{focalPixels:100,principalOffsetPixels:[0,0]}};
  const normal=[0,0,1];
  assert.equal(projectCityPage({normal,corners:[[-20,-20,-100],[20,-20,-100],[20,20,1],[-20,20,1]]},identity,1,viewport).visible,true);
  const corners=[...outside.map(([x,y])=>[x,y,-100]),...outside.map(([x,y])=>[x,y,-101])];
  assert.equal(projectCityPage({normal,corners},identity,1,viewport).visible,true);
});

test('opaque prepared support rejects only fully hidden pages from its front side',()=>{
  const disc={center:[0,0,-5],normal:[0,0,1],radius:3};
  const viewport={width:100,height:100,projection:{focalPixels:100,principalOffsetPixels:[0,0]},opaqueDiscs:[disc]};
  const page=(size,z)=>({normal:[0,0,1],corners:[[-size,-size,z],[size,-size,z],[size,size,z],[-size,size,z]]});
  const project=(p,v=viewport)=>projectCityPage(p,identity,1,v).visible;
  assert.equal(project(page(1,-10)),false);
  assert.equal(project(page(10,-10)),true,'A partially exposed page keeps its source group');
  assert.equal(project(page(1,-3)),true,'Fine geometry in front of the opaque surface stays visible');
  assert.equal(project(page(1,-5.00000001)),true,'Nearly coplanar paint order remains conservative');
  assert.equal(project(page(1,-10),{...viewport,opaqueDiscs:[{...disc,normal:[0,0,-1]}]}),true);
  assert.equal(project(page(1,-10),{...viewport,opaqueDiscs:[]}),true);
});
