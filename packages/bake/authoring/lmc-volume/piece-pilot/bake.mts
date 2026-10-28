/** Tiny, reversible representation pilot. Uses the approved source and shared galaxy slab machinery. */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { hybridOpticalOpacity } from '@cssearth/core';
import { validatePreparedCssVolume, type PreparedCssVolume } from '@cssearth/objects';
import { readVolumeDatasetBank } from '@cssearth/objects/node';
import { bankSpec, planeLayout, planeCamera, writeGalaxyModelBank, encodeGalaxyPlane, hybridGalaxyPlanes, selectDenseSlabs, type GalaxyBankSpec, type GalaxyPlane, type GalaxyBankFit } from '../../milky-way-dust/galaxy-fitted-bank.mts';
import { compileGalaxySliceVolume } from '../../milky-way-dust/galaxy-slice-compile.mts';
import { projectPiece } from './project.mts';
import { deliveryPhysicalFrame } from '../delivery/delivery-frame.mts';
import { NEAR_DIR } from '../delivery/near-pilot.mts';
import { APPROVED_COMMIT } from '../delivery/reference.mts';
import { pilotSource, PILOT_DIR } from './source.mts';
import type { RegionBox, SpatialSelection } from './regions.mts';
import { need, json, rec, array, num, numbers } from '../inputs.mts';
export interface Piece { id: string; spec: GalaxyBankSpec; selection: SpatialSelection; }
export function planPieces(regions: readonly {id:string;box:RegionBox}[], size=128): Piece[] {
  need(size===128,'Only the tiny rung is approved for this experiment');
  const make=(id:string,box:RegionBox,counts:[number,number,number],dense:[number,number,number],selection:SpatialSelection):Piece=>({id,spec:bankSpec({box,counts,size,hybrid:{densePerAxis:dense},record:'source/preparation/l36/fit.json',texturePrefix:'l36-piece-'+id}),selection});
  const pieces=[make('background',{min:[-10,-10,-2.1],max:[10,10,2.1]},[4,4,3],[2,2,2],{exclude:regions.map(r=>r.box)}),...regions.map(r=>make(r.id,r.box,[3,3,2],[0,0,0],{include:r.box}))];
  need(regions.length===2&&pieces.reduce((s,p)=>s+p.spec.counts.reduce((a,b)=>a+b,0)+p.spec.hybrid!.densePerAxis.reduce((a,b)=>a+b,0),0)===33,'The pilot must stay at exactly 33 optical layers');
  for(let a=0;a<3;a++)need(pieces.reduce((sum,p)=>sum+p.spec.counts[a]!,0)<=[13,13,7][a]!,'Physical axis count exceeds the accepted galaxy budget');
  return pieces;
}
async function atomic(path:string,bytes:Uint8Array|string){const temporary=path+'.tmp-'+process.pid;await writeFile(temporary,bytes);await rename(temporary,path);}
const stem=(piece:string,axis:number,index:number)=>PILOT_DIR+`raw/${piece}-${axis}-${index}`;
export async function batch(pilot:boolean){
 const source=await pilotSource(),pieces=planPieces(source.regions);await mkdir(PILOT_DIR+'raw/',{recursive:true});
 const configuration={revision:1,approvedCommit:APPROVED_COMMIT,size:128,stepPc:15,subpixels:4,pieces,regions:source.regions};
 const old=await json(PILOT_DIR+'configuration.json').catch(e=>{if(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT')return null;throw e;});if(old)need(isDeepStrictEqual(old,configuration),'The pilot checkpoint configuration changed');else await atomic(PILOT_DIR+'configuration.json',JSON.stringify(configuration,null,2)+'\n');
 const jobs=pieces.flatMap(piece=>([0,1,2]as const).flatMap(axis=>Array.from({length:piece.spec.counts[axis]},(_,index)=>({piece,layout:planeLayout(piece.spec,axis,index)}))));
 const first=jobs.filter(j=>j.layout.axis===2&&(j.piece.id==='background'?j.layout.index===1:j.layout.index===0));
 if(!pilot)need(rec(await json(PILOT_DIR+'timing-pilot.json')).complete===true,'Measure the exact three-job pilot before continuing');
 const selected=pilot?first:[...first,...jobs.filter(j=>!first.includes(j))],started=performance.now(),timings=[];
 for(const{piece,layout}of selected){
  const prefix=stem(piece.id,layout.axis,layout.index),previous=await json(prefix+'.json').catch(e=>{if(e&&typeof e==='object'&&'code'in e&&e.code==='ENOENT')return null;throw e;});
  if(previous){need(rec(previous).complete===true,'Incomplete plane checkpoint');need((await readFile(prefix+'-rgb.f64le')).length===layout.width*layout.height*24&&(await readFile(prefix+'-tau.f64le')).length===layout.width*layout.height*8,'Incomplete plane bytes');continue;}
  const t=performance.now(),camera=planeCamera(piece.spec,layout),{rgb,tau}=projectPiece(source,camera,layout.domain,piece.selection);
  need(rgb.every(v=>Number.isFinite(v)&&v>=0)&&tau.every(v=>Number.isFinite(v)&&v>=0),'Invalid regional optical transfer');
  await atomic(prefix+'-rgb.f64le',Buffer.from(rgb.buffer));await atomic(prefix+'-tau.f64le',Buffer.from(tau.buffer));
  const seconds=(performance.now()-t)/1000,row={complete:true,piece:piece.id,...layout,seconds};await atomic(prefix+'.json',JSON.stringify(row)+'\n');timings.push(row);console.log('PIECE_PLANE_COMPLETE '+piece.id+' '+layout.axis+' '+layout.index+' '+seconds.toFixed(3));
 }
 const result={complete:true,pilot,planes:selected.length,seconds:(performance.now()-started)/1000,timings};await atomic(PILOT_DIR+(pilot?'timing-pilot.json':'batch.json'),JSON.stringify(result,null,2)+'\n');console.log(pilot?'PIECE_TIMING_PILOT_COMPLETE':'PIECE_BATCH_COMPLETE');
}
export async function loadPiecePlanes(pieces:readonly Piece[]) {
 const sets=[];for(const piece of pieces){const planes:GalaxyPlane[]=[];for(const axis of[0,1,2]as const)for(let index=0;index<piece.spec.counts[axis];index++){
  const p=planeLayout(piece.spec,axis,index),rgb=await readFile(stem(piece.id,axis,index)+'-rgb.f64le'),tau=await readFile(stem(piece.id,axis,index)+'-tau.f64le');need(rgb.length===p.width*p.height*24&&tau.length===p.width*p.height*8,'Truncated piece plane');planes.push({...p,rgb:new Float64Array(Uint8Array.from(rgb).buffer),tau:new Float64Array(Uint8Array.from(tau).buffer)});
 }sets.push({piece,planes});}return sets;
}
export async function frozenFits():Promise<GalaxyBankFit[]>{const raw=rec(await json(NEAR_DIR+'compression-fit.json'));return array(raw.fits).map(v=>{const r=rec(v),rgb=numbers(r.rgb,3);return{rgb:[rgb[0]!,rgb[1]!,rgb[2]!],gamma:num(r.gamma),dust:num(r.dust),emissionOpacity:num(r.emissionOpacity)};});}
export async function verifyTiles(){const source=await pilotSource(),piece=planPieces(source.regions).find(p=>p.id==='compact')!,layout=planeLayout(piece.spec,2,0),result=projectPiece(source,planeCamera(piece.spec,layout),layout.domain,piece.selection);for(const key of['rgb','tau']as const)need((await readFile(stem(piece.id,2,0)+'-'+key+'.f64le')).equals(Buffer.from(result[key].buffer)),'Fixed-camera tiles changed a completed physical plane');await atomic(PILOT_DIR+'tile-replay.json',JSON.stringify({complete:true,decodedBytesIdentical:true,piece:piece.id,channels:['rgb','tau']})+'\n');console.log('PIECE_TILE_REPLAY_IDENTICAL');}
export async function encode(){
 need(rec(await json(PILOT_DIR+'batch.json')).complete===true,'The tiny projection batch must finish');const config=rec(await json(PILOT_DIR+'configuration.json'));need(config.size===128,'The pilot may not scale silently');
 const source=await pilotSource(),pieces=planPieces(source.regions),sets=await loadPiecePlanes(pieces),fits=await frozenFits(),volumes:PreparedCssVolume[]=[];
 for(const{piece,planes}of sets){const dir=PILOT_DIR+'banks/'+piece.id+'/';await writeGalaxyModelBank(dir,piece.spec,planes,fits);const volume=compileGalaxySliceVolume(await json(dir+'prototype.json'),deliveryPhysicalFrame(),dir,'lmc-volume',{record:piece.spec.record,texturePrefix:piece.spec.texturePrefix});volumes.push(volume);}
 const volume=validatePreparedCssVolume({...volumes[0]!,id:'lmc-volume',stacks:(['x','y','z']as const).map(axis=>({axis,leaves:volumes.flatMap((v,i)=>v.stacks.find(s=>s.axis===axis)!.leaves.map(l=>({...l,id:pieces[i]!.id+'-'+l.id,opticalSlab:l.opticalSlab?{...l.opticalSlab,id:pieces[i]!.id+'-'+l.opticalSlab.id}:undefined})))})),resources:volumes.flatMap(v=>v.resources),provenance:{model:'l36',pilot:true,source:'source/preparation/l36/recipe.json',generator:'packages/bake/authoring/lmc-volume/piece-pilot/bake.mts',method:'Disjoint regional boxes share the existing XYZ renderer and depth sorting. All emitters and extinction inside each box belong only to that piece.'},approximation:{pilot:true,size:128,physicalParametersChanged:0,physicalSlabs:27,opticalLayers:33,encoding:'Frozen accepted near-bank coefficients, not refitted for this pilot.',parts:pieces.map(p=>({id:p.id,box:p.spec.box,counts:p.spec.counts}))}});
 need(volume.stacks.reduce((s,p)=>s+p.leaves.length,0)===33,'The merged pilot exceeds its optical budget');await atomic(PILOT_DIR+'volume.json',JSON.stringify(volume)+'\n');
 const alphaRows=sets.map(({piece,planes})=>{const decoded=hybridGalaxyPlanes(planes,fits,selectDenseSlabs(planes,piece.spec));let originalAlpha=0,deliveredAlpha=0;const area=(piece.spec.box.max[0]-piece.spec.box.min[0])*(piece.spec.box.max[1]-piece.spec.box.min[1]);for(const p of planes.filter(p=>p.axis===2)){const original=encodeGalaxyPlane(p,fits[2]!,false),parts=decoded.filter(v=>v.axis===2&&v.index===p.index);for(let i=3;i<original.rgba.length;i+=4){let t=1;for(const v of parts)t*=1-v.rgba[i]!/255*hybridOpticalOpacity(v.opticalRole!,1);originalAlpha+=original.rgba[i]!/255*area/(p.width*p.height);deliveredAlpha+=(1-t)*area/(p.width*p.height);}}return{id:piece.id,originalAlpha,deliveredAlpha,lossFraction:1-deliveredAlpha/originalAlpha};});const alphaTotal=alphaRows.reduce((s,r)=>s+r.originalAlpha,0),alphaDelivered=alphaRows.reduce((s,r)=>s+r.deliveredAlpha,0);
 const baseline=await readVolumeDatasetBank('src/objects/lmc-volume/prepared');need(baseline.datasets[0]!.volume.stacks.reduce((n,s)=>n+s.leaves.length,0)===33,'The comparison needs the accepted baseline');
 await atomic(PILOT_DIR+'encoding.json',JSON.stringify({complete:true,size:128,fits,physicalSlabs:27,opticalLayers:33,mergedAlphaFaceOn:{areaWeightedLossFraction:1-alphaDelivered/alphaTotal,perPiece:alphaRows,meaning:'Effective per-slab alpha at normal incidence versus original encoded alpha. Integrated over physical texel area across disjoint pieces. This is not luminosity loss.'},perAxis:volume.stacks.map(s=>({axis:s.axis,layers:s.leaves.length,physical:new Set(s.leaves.map(l=>l.centerUnits[['x','y','z'].indexOf(s.axis)])).size}))},null,2)+'\n');console.log('PIECE_ENCODING_COMPLETE 33');
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){if(process.argv[2]==='replay')await verifyTiles();else if(process.argv[2]==='pilot')await batch(true);else if(process.argv[2]==='batch')await batch(false);else{need(process.argv[2]==='encode','Choose pilot, batch or encode');await encode();}}
