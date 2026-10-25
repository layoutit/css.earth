import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { createGalaxyStationSelection } from './galaxy-station-selection.js';
import { mountGalaxyStations } from './galaxy-stations.js';
import { watchFlightWrites } from '../galaxy/galaxy-flight-writes.test-support.mts';
import type { VolumeCameraPublication } from '../../volume/types.js';
const stations=[0,10,40,50,100].map((x,i)=>({id:'s'+i,positionM:[x,0,0] as const}));
const interpolation={paths:[stations.map(s=>s.id)]};
const at=(x:number):VolumeCameraPublication=>({world:{referenceFrame:'sun-icrf',epochJdTt:2451545,pose:{positionM:[x,0,0],orientationXyzw:[0,0,0,1]}},viewport:{widthPixels:1024,heightPixels:640,focalPixels:887,principalOffsetPixels:[0,0]}});
test('position interpolation brackets unequal intervals, preserves light and is independent of clock and direction',()=>{
 const owner=createGalaxyStationSelection(stations,{hysteresisM:1,fadeMs:500,interpolation}),ready=new Set(stations.map(s=>s.id));let previous=-1;
 for(let i=0;i<=1000;i++){const x=i/10,state=owner.publish(at(x),i,false,ready),weights=state.weights!;const light=stations.reduce((s,p)=>s+(weights[p.id]??0)*p.positionM[0],0);assert.ok(Math.abs(light-x)<1e-10);assert.ok(light>=previous);previous=light;assert.ok(Math.abs(Object.values(weights).reduce((s,v)=>s+v,0)-1)<1e-12);}
 const state=owner.publish(at(25),2000,false,ready),base=at(25),rotated={...base,world:{...base.world,pose:{...base.world.pose,orientationXyzw:[0,1,0,0] as const}}};assert.deepEqual(owner.publish(rotated,3000,false,ready),state);
});
test('default local window preserves light through driven travel, bounds decode residency and freezes coast membership',async()=>{
 const {document}=parseHTML('<html><body><div id="host"></div></body></html>'),host=document.getElementById('host') as unknown as HTMLElement,watch=watchFlightWrites(document);let coast=false;
 const mount=mountGalaxyStations({host,stations,interpolation,hysteresisM:1,fadeMs:500,coasting:()=>coast,load:async id=>{const root=document.createElement('div') as unknown as HTMLElement;root.dataset.light=String(stations.find(s=>s.id===id)!.positionM[0]);return{root,publish(){},destroy(){root.remove();}};}});
 for(let i=0;i<16;i++){mount.publish(at(25));await Promise.resolve();}assert.equal(host.children.length,3);mount.publish(at(25));await Promise.resolve();
 for(let i=0;i<=1000;i++){const x=i/10;mount.publish(at(x));await Promise.resolve();mount.publish(at(x));await Promise.resolve();let light=0,transmit=1;for(const n of [...host.children].reverse() as HTMLElement[]){const a=Number(n.style.opacity);light+=transmit*a*Number(n.dataset.light);transmit*=1-a;}assert.ok(Math.abs(light-x)<1e-10);assert.ok(mount.stats().loaded+mount.stats().pending<=4);}
 const frozen=[...host.children];watch.start();coast=true;for(let i=0;i<=1000;i++){mount.publish(at(i/10));await Promise.resolve();assert.ok(host.children.length===frozen.length&&[...host.children].every((n,i)=>n===frozen[i]),'coast changed retained membership');assert.deepEqual(watch.take(),[]);assert.ok(mount.stats().loaded+mount.stats().pending<=4);}
 coast=false;watch.destroy();mount.destroy();
});
test('driven travel never moves a retained station: a re-inserted sky re-uploads its faces and drops frames',async()=>{
 const {document}=parseHTML('<html><body><div id="host"></div></body></html>'),host=document.getElementById('host') as unknown as HTMLElement;let moves=0;
 const insert=host.insertBefore.bind(host);host.insertBefore=((node:Node,before:Node|null)=>{if(node.parentNode===host)moves++;return insert(node,before);}) as typeof host.insertBefore;
 const mount=mountGalaxyStations({host,stations,interpolation,hysteresisM:1,fadeMs:500,load:async id=>{const root=document.createElement('div') as unknown as HTMLElement;root.dataset.light=String(stations.find(s=>s.id===id)!.positionM[0]);return{root,publish(){},destroy(){root.remove();}};}});
 try{for(const direction of [1,-1])for(let i=0;i<=1000;i++){const x=direction>0?i/10:100-i/10;mount.publish(at(x));await Promise.resolve();mount.publish(at(x));await Promise.resolve();let light=0,transmit=1;for(const n of [...host.children].reverse() as HTMLElement[]){const a=Number(n.style.opacity);light+=transmit*a*Number(n.dataset.light);transmit*=1-a;}assert.ok(Math.abs(light-x)<1e-10);}
 assert.equal(moves,0,'a resident root was re-inserted');}finally{mount.destroy();}
});
test('a missing bracketing decode retains a complete bounded local scene',()=>{
 const owner=createGalaxyStationSelection(stations,{hysteresisM:1,fadeMs:500,interpolation}),ready=new Set(stations.map(s=>s.id));owner.publish(at(5),0,false,ready);ready.delete('s4');const held=owner.publish(at(80),1,false,ready);assert.ok(held.residentIds.length<=4);assert.equal(Object.values(held.weights!).reduce((s,v)=>s+v,0),1);assert.ok(!held.residentIds.includes('s4'));
});
test('a disjoint previous pair releases a decode slot and the requested local pair actually arrives',async()=>{
 const {document}=parseHTML('<html><body><div id="host"></div></body></html>'),host=document.getElementById('host') as unknown as HTMLElement;
 const mount=mountGalaxyStations({host,stations,interpolation,hysteresisM:1,fadeMs:500,load:async()=>{const root=document.createElement('div') as unknown as HTMLElement;return{root,publish(){},destroy(){root.remove();}};}});
 try{for(let i=0;i<20;i++){mount.publish(at(95));await Promise.resolve();}assert.ok(mount.stats().loadedIds.includes('s4'));
 for(let i=0;i<20;i++){mount.publish(at(5));await Promise.resolve();assert.ok(mount.stats().loaded+mount.stats().pending<=3);assert.ok(host.children.length>0);}
 assert.ok(['s0','s1'].every(id=>mount.stats().resident.includes(id)),'the previous pair must not deadlock the replacement');assert.equal(mount.stats().pending,0);
 }finally{mount.destroy();}
});
test('an explicit cache limit cannot silently undercut the prepared coast horizon',()=>{
 const {document}=parseHTML('<div></div>');for(const maximumLoadedStations of [4,5,14])assert.throws(()=>mountGalaxyStations({host:document.querySelector('div') as unknown as HTMLElement,stations,interpolation,hysteresisM:1,fadeMs:500,maximumLoadedStations,load:async()=>{throw Error('unused');}}),/reserve one of four sky slots/);
});
