import {test} from 'node:test';
import assert from 'node:assert/strict';
import {galaxyAutoExposure} from './galaxy-auto-exposure.js';
import {parsePreparedGalaxyStations} from '@cssearth/objects';
import {flightInputs,flightViewport} from './galaxy-flight-harness.test-support.mts';
import {createSceneLifetime,cameraPoseToReferenceFrame,type WorldCameraPose} from '@cssearth/engine';
import {parseHTML} from 'linkedom';
import {createUniverseBackground} from '../universe-background.js';
const at=(x:number):WorldCameraPose=>({referenceFrame:'sun-icrf',epochJdTt:2451545,pose:{positionM:[x,0,0],orientationXyzw:[0,0,0,1]}});
const places=[{positionM:[0,0,0] as const,insideOpacity:.16,innerDistanceM:10,outerDistanceM:700},{positionM:[270,0,0] as const,insideOpacity:.058,innerDistanceM:30,outerDistanceM:700}];
test('one C1 position gain adapts monotonically from outside to both inside anchors and between them',()=>{
 for(const [start,end] of [[-700,0],[970,270],[0,270]]){let previous=1;for(let i=0;i<=10000;i++){const x=start!+(end!-start!)*i/10000,e=galaxyAutoExposure({places},at(x));assert.ok(e<=previous+1e-12);assert.ok(e>0&&e<=1);previous=e;const w=at(x);assert.equal(galaxyAutoExposure({places},{...w,pose:{...w.pose,orientationXyzw:[0,1,0,0]}}),e);}}
 assert.ok(Math.abs(galaxyAutoExposure({places},at(0))-.16)<1e-14);assert.ok(Math.abs(galaxyAutoExposure({places},at(270))-.058)<1e-14);
 for(const x of [-700,-10,0,270,300,970]){const h=1e-4,l=(galaxyAutoExposure({places},at(x))-galaxyAutoExposure({places},at(x-h)))/h,r=(galaxyAutoExposure({places},at(x+h))-galaxyAutoExposure({places},at(x)))/h;assert.ok(Math.abs(l-r)<1e-6);}
});
test('the installed default applies the SAME gain to the far image and stations; NASA stays unchanged',async()=>{
 const inputs=await flightInputs(),{document}=parseHTML('<div id="host"><i></i></div>'),root=document.getElementById('host')!,lifetime=createSceneLifetime();let received=NaN;
 const bg=createUniverseBackground({root,end:root.firstChild!,lifetime,plan:inputs.plan,payload:inputs.payload,sky:true,resolveResource:f=>f,prefetchUrls:[],prefetchDistanceM:Infinity,
 stations:{...inputs.tuner,load:async()=>{const node=document.createElement('div') as unknown as HTMLElement;return{root:node,publish(){},setExposure(e){received=e;},destroy(){node.remove();}};}}});
 const publish=(ly:number)=>{const world:WorldCameraPose={referenceFrame:inputs.payload.frame.referenceFrame,epochJdTt:inputs.payload.frame.epochJdTt,pose:cameraPoseToReferenceFrame({positionM:[-ly*9.4607304725808e15,0,0],orientationXyzw:[0,0,0,1]},inputs.payload.frame)};bg.publish(world,flightViewport,ly*9.4607304725808e15,inputs.plan.focus.positionM,1);};
 try{bg.mount();for(let i=0;i<20;i++){publish(12900);await Promise.resolve();}const e=bg.inspect()!.exposure;assert.ok(e>.16&&e<1);assert.ok(Math.abs(Number(root.querySelector<HTMLElement>('.prepared-volume-image')!.style.opacity)-e)<1e-12);assert.equal(received,e);assert.ok(bg.inspect()!.layers>.1,'clouds must remain visible at 12,900 ly');publish(1);assert.ok(Math.abs(bg.inspect()!.exposure-.16)<1e-14);assert.equal(root.querySelector<HTMLElement>('[data-sky-contribution]')!.style.opacity,'1');}finally{lifetime.destroy();}
});
test('external exposure records reject invalid gains, positions, ranges and unsupported place counts',async()=>{
 const {tuner}=await flightInputs();for(const bad of [0,1.01,Infinity,'0.16'])assert.throws(()=>parsePreparedGalaxyStations({...tuner,autoExposure:{places:[{...places[0],insideOpacity:bad}]}}));
 for(const bad of [[],[places[0],places[1],places[0]],[places[0],places[0]],[{...places[0],positionM:[NaN,0,0]}],[{...places[0],outerDistanceM:5}]])assert.throws(()=>parsePreparedGalaxyStations({...tuner,autoExposure:{places:bad}}));
});
