import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { createSceneLifetime, cameraPoseToReferenceFrame } from '@cssearth/engine';
import { parseCatalogueProximity, parseDensityVolumeObjectDescriptor, parsePreparedDensityVolumeText, parsePreparedWorldContextSummary } from '@cssearth/objects';
import { catalogueDiscOpacity, catalogueLevelOpacity } from './catalogue-proximity.js';
import { createUniverseBackground } from './universe-background.js';
import { mountCataloguePoints } from './catalogue-points.js';

const frame = {referenceFrame:'sun-icrf',epochJdTt:2451545,originM:[0,0,0],localToReferenceXyzw:[0,0,0,1],metersPerUnit:1,boundsUnits:{min:[-26,-26,-1],max:[26,26,1]}};
const index = parseCatalogueProximity({schema:'cssearth-catalogue-proximity@1',frame,disc:{centerUnits:[0,0,0],radiusUnits:26,halfHeightUnits:.3,fadeFraction:.5},
  levels:[{file:'wide.bin',nearOpacity:.5},{file:'near.bin',nearOpacity:1,appearUnits:[9,2.4]}]});
const world=(x:number,z=0)=>({referenceFrame:'sun-icrf',epochJdTt:2451545,pose:{positionM:[x,0,z] as const,orientationXyzw:[0,0,0,1] as const}});

test('catalogue admission is camera position inside the disc, never orientation or view width',()=>{
  for(const w of [world(27),world(1,.31),world(1,-.31)])assert.equal(catalogueDiscOpacity(index,w),0);
  assert.equal(catalogueDiscOpacity(index,world(0)),1);
  assert.ok(Math.abs(catalogueDiscOpacity(index,world(0,.225))-.5)<1e-12);
  assert.equal(catalogueLevelOpacity(index,1,world(10)),0);
  assert.ok(Math.abs(catalogueLevelOpacity(index,1,world(Math.sqrt(9*2.4)))-.5)<1e-12);
  assert.equal(catalogueLevelOpacity(index,1,world(2)),1);
  const turned={...world(2),pose:{...world(2).pose,orientationXyzw:[0,1,0,0] as const}};
  assert.equal(catalogueLevelOpacity(index,1,turned),catalogueLevelOpacity(index,1,world(2)));
  assert.throws(()=>parseCatalogueProximity({...index,levels:[{file:'../outside.bin',nearOpacity:1}]}),/Invalid/);
});

test('the mounted galaxy initiates zero dot bank requests outside, and only the wanted level inside',async()=>{
  const object=new URL('../../../../src/objects/milky-way-volume/',import.meta.url);
  const descriptor=parseDensityVolumeObjectDescriptor(JSON.parse(await readFile(new URL('object.json',object),'utf8')));
  const payload=parsePreparedDensityVolumeText(await readFile(new URL('prepared/volume.json',object),'utf8'),descriptor);
  const plan=parsePreparedWorldContextSummary(JSON.parse(await readFile(new URL('../../../../src/objects/observable-universe/prepared/world.json',import.meta.url),'utf8')));
  const {document}=parseHTML('<div id="host"><span></span></div>'),root=document.getElementById('host')!,lifetime=createSceneLifetime();
  const actual=parseCatalogueProximity(JSON.parse(await readFile(new URL('prepared/catalogue-proximity.json',object),'utf8'))),requests:string[]=[];
  const fetcher=mock.method(globalThis,'fetch',async(input:string|URL|Request)=>{requests.push(String(input));return new Response(await readFile(new URL(`prepared/${String(input).split('/').at(-1)}`,object)));});
  const background=createUniverseBackground({root,end:root.firstChild!,lifetime,plan,payload,sky:false,resolveResource:p=>p,prefetchUrls:[],prefetchDistanceM:Infinity,
    cataloguePointUrls:['/dots.bin','/old-star-dots.bin'],catalogueProximity:{host:'milky-way',plan:actual,resolve:file=>'/'+file}});
  const publish=(p:readonly[number,number,number],focal=900)=>background.publish({referenceFrame:actual.frame.referenceFrame,epochJdTt:actual.frame.epochJdTt,
    pose:cameraPoseToReferenceFrame({positionM:p.map(n=>n*actual.frame.metersPerUnit) as unknown as readonly[number,number,number],orientationXyzw:[0,0,0,1]},actual.frame)},
    {focalPixels:focal,widthPixels:1024,heightPixels:640,principalOffsetPixels:[0,0]},1e20,plan.focus.positionM,1);
  try{background.mount();publish([0,34,0]);publish([0,0,34],100000);await new Promise(r=>setTimeout(r,20));assert.deepEqual(requests,[],'no fetch or decode of a dot bank from outside, even with a narrow lens');
    publish([0,10,0]);await new Promise(r=>setTimeout(r,100));assert.deepEqual(requests,['/dots-level-0.bin'],'the 3 kpc and smaller levels stay unloaded');
    publish([0,34,0]);assert.equal(root.querySelector<HTMLElement>('[data-catalogue-points]')!.style.opacity,'0','loaded dots leave the outside view too');
  }finally{lifetime.destroy();fetcher.mock.restore();}
});

test('a wanted dot never disappears for one paint during a proximity zoom, including pacer arrivals',async()=>{
  const {document}=parseHTML('<div id="host"></div>'),host=document.getElementById('host')!;
  const count=5000,points=Array.from({length:count},(_,i)=>[(i%100-50)/100,(Math.floor(i/100)-25)/100,-10]);
  const bank={schema:'cssearth-catalogue-points@1',id:'proximity',frame:{...frame,boundsUnits:{min:[-20,-20,-20],max:[20,20,20]}},
    appearance:{colorCss:'#ffffff',opacity:1,radiusPx:.75,screenBudget:200},points,spread:{normal:[0,0,1],across:20,along:20},cells:{boxes:[[-20,-20,-20,20,20,20]],of:Array(count).fill(0)}};
  const field=mountCataloguePoints({host,url:'/near.bin',loadBank:async()=>bank,fullDetail:true});
  const viewport={focalPixels:400,widthPixels:1024,heightPixels:640,principalOffsetPixels:[0,0] as const};
  const paint=(z:number)=>field.publish({world:world(0,z),viewport},.5);
  try{paint(1);await new Promise(r=>setTimeout(r,0));
    for(let z=1;z>.01;z*=.965){paint(z);const dots=[...field.root.querySelectorAll('path')].reduce((n,p)=>n+(p.getAttribute('d')?.match(/M/g)?.length??0),0);assert.equal(dots,count,'all 5000 remain wanted and painted; no preceding-frame budget drops them');}
  }finally{field.destroy();}
});
