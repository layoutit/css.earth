import test from 'node:test';import assert from 'node:assert/strict';
import { spatialIntervals, coveredLength, containsEvent } from './regions.mts';
const box = { min: [-1,-1,-1] as [number,number,number], max: [1,1,1] as [number,number,number] };
test('regional light and dust own disjoint half-open ray intervals',()=>{
 const ray:[number,number,number]=[0,0,-5],dir:[number,number,number]=[0,0,1],bounds:[number,number]=[0,10];
 const inside=spatialIntervals(ray,dir,bounds,{include:box}),outside=spatialIntervals(ray,dir,bounds,{exclude:[box]});
 assert.deepEqual(inside,[[4,6]]);assert.deepEqual(outside,[[0,4],[6,10]]);
 for(let x=0;x<10;x+=.125)assert.equal(Number(containsEvent(inside,x))+Number(containsEvent(outside,x)),1);
 assert.equal(coveredLength(inside,3.3,6.7)+coveredLength(outside,3.3,6.7),6.7-3.3);
 assert.deepEqual(spatialIntervals([2,0,-5],dir,bounds,{include:box}),[]);
});

import { projectCatalogue, catalogueBasis } from '../catalogue-render.mts';
import { makeRaster } from '../inputs.mts';import { outsideCamera } from '../render.mts';
import { volumeObject, planarBasis } from '../catalogue-volume.mts';import type { CatalogueScene } from '../catalogue-scene.mts';
import { slabDomain } from '../../milky-way-dust/galaxy-slab-domain.mts';
test('regional ownership neither duplicates emission nor doubles the dust column',()=>{
 const map=makeRaster(4,20);map.mask.fill(1);const source=volumeObject({id:'s',owner:'s',kind:'ball',component:4,center:[0,0,0],basis:planarBasis(0),axes:[.4,.4,.4],inner:0,color:[1,.5,.2],weight:.01,source:'Numerical fixture'});
 const scene:CatalogueScene={objects:[source],dust:[],owners:[{id:'s',kind:'region',component:4,prior:1,maximum:2,measuredAge:false,logAge:null,aliases:[]}],sources:{warp:map,dust:map,young:[map,map,map],youngCoverage:map,youngFraction:0,oldColor:[1,1,1],gas:map,metadata:{}},colors:[[.1,.1,.1],[.05,.05,.05],[0,0,0],[0,0,0]],dustArea:1,molecularFraction:1,metadata:{}};
 const camera=outsideCamera(45,16,1),region={min:[-.2,-.2,-.2]as[number,number,number],max:[.2,.2,.2]as[number,number,number]},domain=slabDomain(2,-12,12),render=(spatial?:import('./regions.mts').SpatialSelection)=>projectCatalogue(scene,camera,.06,undefined,domain,{objectSubpixels:4,spatial});
 const whole=catalogueBasis(render(),scene,Float64Array.from([1])),inside=catalogueBasis(render({include:region}),scene,Float64Array.from([1])),outside=catalogueBasis(render({exclude:[region]}),scene,Float64Array.from([1]));
 for(let k=0;k<5;k++)for(let i=0;i<whole.planes[k]!.length;i++)assert.ok(Math.abs(whole.planes[k]![i]!-inside.planes[k]![i]!-outside.planes[k]![i]!)<1e-10,'Regional emission must be a partition of the approved source');
 scene.dust=[volumeObject({...source,id:'d',kind:'dust',weight:.03,center:[0,0,.1]})];
 const a=render().transmittance!,b=render({include:region}).transmittance!,c=render({exclude:[region]}).transmittance!;
 for(let channel=0;channel<3;channel++)for(let i=0;i<a[channel]!.length;i++)assert.ok(Math.abs(a[channel]![i]!-b[channel]![i]!*c[channel]![i]!)<1e-10,'Dust optical depths must compose once, not twice');
});

test('ray direction does not reverse the inclusive physical face, including corner contacts',()=>{
 for(const axis of[0,1,2])for(const sign of[-1,1]){const ray:[number,number,number]=[0,0,0],dir:[number,number,number]=[0,0,0];ray[axis]=-5*sign;dir[axis]=sign;const inside=spatialIntervals(ray,dir,[0,10],{include:box}),outside=spatialIntervals(ray,dir,[0,10],{exclude:[box]});for(const t of[0,4,5,6,9.999]){const p=ray[axis]+sign*t;assert.equal(containsEvent(inside,t),p>=-1&&p<1);assert.equal(Number(containsEvent(inside,t))+Number(containsEvent(outside,t)),1);}}
 const origin:[number,number,number]=[-2,0,0],direction:[number,number,number]=[1,-1,0],a=spatialIntervals(origin,direction,[0,10],{include:box}),b=spatialIntervals(origin,direction,[0,10],{exclude:[box]});assert.equal(containsEvent(a,1),true);assert.equal(containsEvent(b,1),false);assert.equal(coveredLength(a,0,10),0);
});

import { projectObject } from '../catalogue-render.mts';
test('clipped objects and subpixel fallback retain exact pixels when unused tile samples are skipped',()=>{
 const camera=outsideCamera(0,16,.5),base={id:'edge',owner:'o',kind:'ball' as const,component:4 as const,center:[.45,0,0]as[number,number,number],basis:planarBasis(0),inner:0,color:[1,1,1]as[number,number,number],weight:1,source:'Numerical fixture'};
 for(const axes of[[.4,.4,.4],[.6,1e-8,1e-8]]as[number,number,number][]){const object=volumeObject({...base,axes}),whole=projectObject(object,camera,4);assert.ok(whole.length>0);for(let tile=0;tile<4;tile++){const mask=new Uint8Array(256);for(let y=0;y<16;y++)for(let x=0;x<16;x++)if(Math.floor(x/8)+2*Math.floor(y/8)===tile)mask[y*16+x]=1;assert.deepEqual(projectObject(object,camera,4,mask),whole.filter(p=>mask[p.pixel]));}}
});
