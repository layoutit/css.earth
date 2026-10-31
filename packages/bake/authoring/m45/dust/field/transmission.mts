import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import {worldRotationFromQuaternion,rotateWorldPosition} from '@cssearth/engine';
import {parsePointTransmission,PREPARED_POINT_TRANSMISSION_SCHEMA,type PreparedBank} from '@cssearth/objects';
import {packPreparedBank,unpackPreparedBank} from '@cssearth/objects/node';
import {PC,type Vec} from '../physics/types.mts';
import {createField,type Field} from './density.mts';

const BASELINE='src/objects/milky-way-pleiades-dust/source/inputs/coarse-transmission.bin';
const CURRENT='src/objects/milky-way-pleiades-dust/prepared/point-transmission.bin';
const CONFIG={min:[-13.2,-13.2,-16],max:[13.2,13.2,12],shape:[107,107,113],maximumRayStepPc:.5,cacheNominalStepPc:.25,tauQuantization:1000} as const;
interface DeltaGrid {values:Float32Array;min:Vec;max:Vec;step:Vec;shape:Vec;minimum:number;maximum:number;seconds:number}
function numeric(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value))throw Error('Expected finite number');return value;}
function record(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected record');return value as Record<string,unknown>;}
function cacheDelta(field:Field):DeltaGrid{
 const start=performance.now(),min:Vec=[...CONFIG.min],max:Vec=[...CONFIG.max],shape:Vec=[...CONFIG.shape],step:Vec=[0,1,2].map(a=>(max[a]!-min[a]!)/(shape[a]!-1)) as Vec,values=new Float32Array(shape[0]*shape[1]*shape[2]);let minimum=0,maximum=0;
 for(let z=0;z<shape[2];z++)for(let y=0;y<shape[1];y++)for(let x=0;x<shape[0];x++){
  const px=min[0]+x*step[0],py=min[1]+y*step[1],pz=min[2]+z*step[2],near=numeric(field.near(px,py,pz)),removed=numeric(field.removed(px,py,pz));
  if(near<0||removed<0)throw Error('Negative extinction density');const delta=near-removed;values[(z*shape[1]+y)*shape[0]+x]=delta;minimum=Math.min(minimum,delta);maximum=Math.max(maximum,delta);
 }
 const seconds=(performance.now()-start)/1000;console.log('PLEIADES_TRANSMISSION_CACHE_READY',JSON.stringify({nodes:values.length,minDeltaDensity:minimum,maxDeltaDensity:maximum,seconds}));return {values,min,max,step,shape,minimum,maximum,seconds};
}
function sampleDelta(g:DeltaGrid,x:number,y:number,z:number):number{
 const fx=(x-g.min[0])/g.step[0],fy=(y-g.min[1])/g.step[1],fz=(z-g.min[2])/g.step[2],nx=g.shape[0],ny=g.shape[1],nz=g.shape[2];if(fx<0||fy<0||fz<0||fx>nx-1||fy>ny-1||fz>nz-1)return 0;
 const ix=Math.min(nx-2,Math.floor(fx)),iy=Math.min(ny-2,Math.floor(fy)),iz=Math.min(nz-2,Math.floor(fz)),u=fx-ix,v=fy-iy,w=fz-iz,a=g.values,k=(iz*ny+iy)*nx+ix,plane=nx*ny;
 const low=(a[k]!*(1-u)+a[k+1]!*u)*(1-v)+(a[k+nx]!*(1-u)+a[k+nx+1]!*u)*v;
 const high=(a[k+plane]!*(1-u)+a[k+plane+1]!*u)*(1-v)+(a[k+plane+nx]!*(1-u)+a[k+plane+nx+1]!*u)*v;return low*(1-w)+high*w;
}
function clip(eye:Vec,d:Vec,min:readonly number[],max:readonly number[]):[number,number]|null{
 let low=0,high=1;for(let a=0;a<3;a++){if(Math.abs(d[a]!)<1e-15){if(eye[a]!<min[a]!||eye[a]!>max[a]!)return null;}else{const v0=(min[a]!-eye[a]!)/d[a]!,v1=(max[a]!-eye[a]!)/d[a]!;low=Math.max(low,Math.min(v0,v1));high=Math.min(high,Math.max(v0,v1));}}return high>low?[low,high]:null;
}
function directRaw(field:Field,eye:Vec,target:Vec):number{
 const d:Vec=[target[0]-eye[0],target[1]-eye[1],target[2]-eye[2]],distance=Math.hypot(...d),segment=clip(eye,d,field.bounds.min,field.bounds.max);if(!segment||distance===0)return 0;
 const [low,high]=segment,n=Math.max(1,Math.ceil(distance*(high-low)/.25)),ds=distance*(high-low)/n;let tau=0;
 for(let j=0;j<n;j++){const f=low+(j+.5)*(high-low)/n;tau+=field.raw(eye[0]+d[0]*f,eye[1]+d[1]*f,eye[2]+d[2]*f)*ds;}return numeric(tau);
}
function directDelta(field:Field,eye:Vec,target:Vec):number{
 const d:Vec=[target[0]-eye[0],target[1]-eye[1],target[2]-eye[2]],distance=Math.hypot(...d),segment=clip(eye,d,CONFIG.min,CONFIG.max);if(!segment||distance===0)return 0;
 const [low,high]=segment,n=Math.max(1,Math.ceil(distance*(high-low)/.125)),ds=distance*(high-low)/n;let tau=0;
 for(let j=0;j<n;j++){const f=low+(j+.5)*(high-low)/n,x=eye[0]+d[0]*f,y=eye[1]+d[1]*f,z=eye[2]+d[2]*f;tau+=(field.near(x,y,z)-field.removed(x,y,z))*ds;}return numeric(tau);
}
function cachedDelta(g:DeltaGrid,eye:Vec,target:Vec):number{
 const dx=target[0]-eye[0],dy=target[1]-eye[1],dz=target[2]-eye[2],d:Vec=[dx,dy,dz],distance=Math.hypot(dx,dy,dz),segment=clip(eye,d,g.min,g.max);if(!segment||distance===0)return 0;
 const [low,high]=segment,n=Math.max(1,Math.ceil(distance*(high-low)/CONFIG.maximumRayStepPc)),ds=distance*(high-low)/n;let tau=0;for(let j=0;j<n;j++){const f=low+(j+.5)*(high-low)/n;tau+=sampleDelta(g,eye[0]+dx*f,eye[1]+dy*f,eye[2]+dz*f)*ds;}return tau;
}
export async function prepareTransmission(field:Field,{pilot=false}:{pilot?:boolean}={}):Promise<Record<string,unknown>>{
 const start=performance.now(),out=pilot?'.local/pleiades-dust/pilot':'.local/pleiades-dust/bake';await mkdir(out,{recursive:true});
 const baseline=parsePointTransmission(unpackPreparedBank(await readFile(BASELINE))),palette=parsePointTransmission(unpackPreparedBank(await readFile(CURRENT)));
 for(const key of ['frame','targetAxes','observerAxes','thresholds'] as const)assert.equal(JSON.stringify(baseline[key]),JSON.stringify(palette[key]),`Current/baseline ${key} mismatch`);
 if(!pilot){const prior=record(JSON.parse(await readFile('.local/pleiades-dust/pilot/transmission.json','utf8')));if(prior.executionComplete!==true||prior.pilot!==true||prior.guardsPassed!==true||JSON.stringify(prior.config)!==JSON.stringify(CONFIG))throw Error('Matching positive pilot sentinel required before full transmission');}
 const rotation=worldRotationFromQuaternion(baseline.frame.localToReferenceXyzw),ref=field.inputs.reference;
 // Preserve Pleiades's shared frame conversion: bank units→pc, then rotation and the ICRF origin.
 const local=(x:number,y:number,z:number):Vec=>{const p=rotateWorldPosition(rotation,[x*baseline.frame.metersPerUnit/PC,y*baseline.frame.metersPerUnit/PC,z*baseline.frame.metersPerUnit/PC]),q:Vec=[p[0]+baseline.frame.originM[0]/PC,p[1]+baseline.frame.originM[1]/PC,p[2]+baseline.frame.originM[2]/PC];return [q.reduce((s,v,k)=>s+v*ref.east[k]!,0),q.reduce((s,v,k)=>s+v*ref.north[k]!,0),q.reduce((s,v,k)=>s+v*ref.normal[k]!,0)-136];};
 if(Math.hypot(...local(0,0,0))>5)throw Error('Transmission origin no longer matches the cluster frame');
 const targets:Vec[]=[],observers:Vec[]=[];for(const x of baseline.targetAxes[0]!)for(const y of baseline.targetAxes[1]!)for(const z of baseline.targetAxes[2]!)targets.push(local(x,y,z));for(const x of baseline.observerAxes[0]!)for(const y of baseline.observerAxes[1]!)for(const z of baseline.observerAxes[2]!)observers.push(local(x,y,z));
 assert.equal(observers.length*targets.length,baseline.tau.length);
 const g=cacheDelta(field),tau=baseline.tau.slice(),pilotObserver=Math.floor(observers.length/2),traceStart=performance.now();let changed=0,intersected=0,processed=0,minDelta=0,maxDelta=0,clampedLow=0,clampedHigh=0,minimumUnclampedTau=Infinity;
 for(let oi=0;oi<observers.length;oi++){
  if(pilot&&oi!==pilotObserver)continue;const eye=observers[oi]!;
  for(let ti=0;ti<targets.length;ti++){
   const target=targets[ti]!,delta=cachedDelta(g,eye,target);processed++;if(delta===0)continue;intersected++;const index=oi*targets.length+ti,raw=baseline.tau[index]!/1000+numeric(delta);minDelta=Math.min(minDelta,delta);maxDelta=Math.max(maxDelta,delta);minimumUnclampedTau=Math.min(minimumUnclampedTau,raw);if(raw<0)clampedLow++;if(raw>65.535)clampedHigh++;tau[index]=Math.round(Math.max(0,Math.min(65.535,raw))*1000);if(tau[index]!==baseline.tau[index])changed++;
  }
  if(oi%32===0){console.log('PLEIADES_TRANSMISSION_PROGRESS',JSON.stringify({observer:oi,total:observers.length,changed,seconds:(performance.now()-traceStart)/1000}));await new Promise<void>(done=>setImmediate(done));}
 }
 const traceSeconds=(performance.now()-traceStart)/1000,baselineChecks=[],deltaChecks=[];
 let earthObserver=0;for(let oi=1;oi<observers.length;oi++)if(Math.hypot(observers[oi]![0],observers[oi]![1],observers[oi]![2]+136)<Math.hypot(observers[earthObserver]![0],observers[earthObserver]![1],observers[earthObserver]![2]+136))earthObserver=oi;
 const targetIndices=new Set([0,Math.floor(targets.length/2),targets.length-1]);for(const star of field.inputs.stars.slice(0,5)){let closest=0;for(let ti=1;ti<targets.length;ti++)if(Math.hypot(...targets[ti]!.map((v,a)=>v-star.at[a]!))<Math.hypot(...targets[closest]!.map((v,a)=>v-star.at[a]!)))closest=ti;targetIndices.add(closest);}
 for(const oi of new Set([0,pilotObserver,earthObserver,observers.length-1]))for(const ti of targetIndices){const stored=baseline.tau[oi*targets.length+ti]!/1000,direct=directRaw(field,observers[oi]!,targets[ti]!);baselineChecks.push({observer:oi,target:ti,baselineTau:stored,directRawTau:direct,differenceTau:stored-direct});}
 for(const ti of targetIndices){const cached=cachedDelta(g,observers[pilotObserver]!,targets[ti]!),direct=directDelta(field,observers[pilotObserver]!,targets[ti]!);deltaChecks.push({observer:pilotObserver,target:ti,cachedDeltaTau:cached,directDeltaTau:direct,differenceTau:cached-direct});}
 if(!baselineChecks.some(v=>v.directRawTau>0)||!changed||processed!==(pilot?targets.length:tau.length))throw Error('Transmission numerical/coverage guard failed');
 const projectedFullTraceSeconds=pilot?traceSeconds*observers.length:traceSeconds;if(pilot&&projectedFullTraceSeconds>600)throw Error(`Transmission pilot projected ${projectedFullTraceSeconds.toFixed(1)}s exceeds600s`);
 const bank:PreparedBank={schema:PREPARED_POINT_TRANSMISSION_SCHEMA,fields:{frame:baseline.frame,targetAxes:baseline.targetAxes,observerAxes:baseline.observerAxes,thresholds:baseline.thresholds},columns:{tau,colors:palette.colors.slice()}};parsePointTransmission(bank);
 const destination=`${out}/point-transmission.bin`;await writeFile(destination,packPreparedBank(bank));
 const readback=parsePointTransmission(unpackPreparedBank(await readFile(destination)));assert.equal(readback.tau.length,tau.length);assert.deepEqual(readback.tau,tau);assert.deepEqual(readback.colors,palette.colors);assert.deepEqual(readback.frame,baseline.frame);
 const maxAbs=(rows:{differenceTau:number}[])=>Math.max(...rows.map(v=>Math.abs(v.differenceTau)));
 const result={executionComplete:true,guardsPassed:true,pilot,config:CONFIG,destination,entries:tau.length,observers:observers.length,targets:targets.length,processedEntries:processed,pilotObserver,changed,intersected,minDelta,maxDelta,clampedLow,clampedHigh,minimumUnclampedTau:Number.isFinite(minimumUnclampedTau)?minimumUnclampedTau:null,cache:{nodes:g.values.length,actualStepPc:g.step,minDeltaDensity:g.minimum,maxDeltaDensity:g.maximum,seconds:g.seconds},traceSeconds,projectedFullTraceSeconds,seconds:(performance.now()-start)/1000,baselineValidation:{directStepPc:.25,checks:baselineChecks,maxAbsDifferenceTau:maxAbs(baselineChecks),interpretation:'Direct integration uses current raw nativeEdenhofer1pc-grid density and the exact prepared observer/target nodes. Differences expose inherited baseline integration/quantization error; baseline is preserved rather than silently replaced.'},deltaValidation:{directStepPc:.125,checks:deltaChecks,maxAbsDifferenceTau:maxAbs(deltaChecks),interpretation:'Cached0.25pc density and0.5pc ray steps intentionally resolve the coarse prepared lookup; they do not resolve every IR filament or cavity.'},method:'tau_new=tau_baseline+integral(field.near−field.removed)ds; the removed component uses the exact same field partition. Prepared frames/axes/thresholds retained; colors copied byte-for-byte from optical palette.',limitations:['Observer/target lookup remains coarse; this is not a per-star new extinction measurement.','Small negative totals from inherited baseline/coarse sampling are clamped only at the final uint16 encoding and explicitly counted.','No prepared asset was overwritten; dataset installation is a separate action.']};
 await writeFile(`${out}/transmission.json`,JSON.stringify(result,null,2)+'\n');console.log('PLEIADES_TRANSMISSION_COMPLETE',JSON.stringify(result));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const pilot=process.argv.includes('--pilot');await prepareTransmission(await createField(),{pilot});}
