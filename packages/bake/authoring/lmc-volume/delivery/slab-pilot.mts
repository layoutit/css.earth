/** Tiny first, then small: the approved model is the target of the shared galaxy compression fit. */
import {hybridOpticalOpacity} from '@cssearth/core';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';

import {approvedScene,REFERENCE_STEP_KPC} from './reference.mts';
import {lmcSlabProjections,readLocalPlanes} from './slab-source.mts';
import {versionDir} from '../sequence-state.mts';
import {loadObservation} from '../observation.mts';
import {outsideCamera,earthCamera,type Camera} from '../render.mts';
import {projectCatalogue,catalogueBasis} from '../catalogue-render.mts';
import {gradedPrediction} from '../grade.mts';
import {need,json,rec,num} from '../inputs.mts';
import {type V3,dot,add,mul} from '../geometry.mts';
import {fitGalaxyBank,evaluateGalaxyBank,type GalaxyFitTarget,galaxyResiduals} from '../../milky-way-dust/galaxy-bank-fit.mts';
import {bankSpec,writeGalaxyModelBank,IDENTITY_BANK_FIT,type GalaxyDecodedPlane,compositeGalaxyStack,encodeGalaxyPlane} from '../../milky-way-dust/galaxy-fitted-bank.mts';
export function rotatedCamera(tilt:number,azimuth:number,size:number):Camera {
 const base=outsideCamera(tilt,size),angle=azimuth*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),rotate=(v:V3,inverse=false):V3=>[v[0]*cos-v[1]*sin*(inverse?-1:1),v[0]*sin*(inverse?-1:1)+v[1]*cos,v[2]];
 return{...base,name:`tilt-${tilt}-azimuth-${azimuth}`,ray(x,y){const ray=base.ray(x,y);return{origin:rotate(ray.origin),direction:rotate(ray.direction)};},pixelOf:p=>base.pixelOf!(rotate(p,true))};
}
function annuli(camera:Camera):Uint8Array {
 const out=new Uint8Array(camera.width*camera.height);
 for(let y=0;y<camera.height;y++)for(let x=0;x<camera.width;x++){
  const ray=camera.ray(x+.5,y+.5),t=-dot(ray.origin,ray.direction)/dot(ray.direction,ray.direction),closest=add(ray.origin,mul(ray.direction,t)),r=Math.hypot(...closest);out[y*camera.width+x]=r<1?0:r<2?1:r<4?2:3;
 }return out;
}
function encodedRgb(linear:Float64Array):Buffer {return Buffer.from(Uint8Array.from(linear,v=>{const x=Math.min(1,Math.max(0,v));return Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055));}));}
export async function slabReferences(directory:string,size:64|128|512,reuse:boolean):Promise<GalaxyFitTarget[]>{
 const o=await loadObservation(size===64?1:size===128?2:8),cameras=[{name:'earth',camera:earthCamera(o.width,o.height,o.rayAt,o.pixelOf),axis:2 as const},...[0,22.5,45,67.5,90].flatMap(tilt=>[0,90,180,270].map(azimuth=>({name:`tilt-${tilt}-azimuth-${azimuth}`,camera:rotatedCamera(tilt,azimuth,size),axis:tilt===90?(azimuth===90||azimuth===270?0 as const:1 as const):2 as const})))],targets:GalaxyFitTarget[]=[];
 const source=reuse?undefined:await approvedScene();
 for(const view of cameras){const path=(reuse&&size===64?versionDir(36)+'delivery/slabs-64/':directory)+'reference-'+view.name+'.f64le';let rgb:Float64Array;
  if(reuse){const bytes=await readFile(path);need(bytes.length===view.camera.width*view.camera.height*3*8,'Incomplete bake reference');rgb=new Float64Array(Uint8Array.from(bytes).buffer);}
  else{need(source,'Missing approved physical model');rgb=gradedPrediction(catalogueBasis(projectCatalogue(source.scene,view.camera,REFERENCE_STEP_KPC),source.scene,source.amplitudes),source.grade);await writeFile(path,Buffer.from(rgb.buffer));console.log(JSON.stringify({sentinel:'LMC_BAKE_REFERENCE',camera:view.name,size}));}
  targets.push({name:view.name,camera:view.camera,axis:view.axis,linear:rgb,annuli:annuli(view.camera)});
 }return targets;
}
export async function runSlabPilot(size:64|128|512,reuse=false,reuseReferences=false){
 const full=rec(await json(versionDir(36)+'delivery/1024/result.json'));need(full.complete===true,'The approved full-resolution model must complete before a slab bake');
 const directory=versionDir(36)+`delivery/hybrid-${size}/`,started=performance.now();await mkdir(directory,{recursive:true});
 if(size>64){const previous=versionDir(36)+`delivery/hybrid-${size===128?64:128}/`,pilot=rec(await json(previous+'result.json')),browser=rec(await json(previous+'browser/result.json'));need(pilot.passed===true&&browser.passed===true,'Do not scale a slab fit that failed its preceding decoded or browser rung');}
 // The bank covers 20 kpc, while the registered Earth picture covers 9.47 kpc.
 // Twice as many bank texels keeps the physical texel pitch close to the reference pixel pitch.
 const spec=bankSpec({box:{min:[-10,-10,-2.1],max:[10,10,2.1]},counts:[10,9,7],size:size*2,record:'source/preparation/l36/fit.json',texturePrefix:'l36-hybrid',hybrid:{densePerAxis:[2,2,3]}});
 if(reuse){const saved=rec(await json(directory+'local-planes.json'));need(JSON.stringify(saved.spec)===JSON.stringify(spec),'Cached slab projections use a different physical layout');}
 const planes=reuse?await readLocalPlanes(directory):await lmcSlabProjections(directory,spec),targets=await slabReferences(directory,size,reuse||reuseReferences),identity=Array.from({length:3},()=>structuredClone(IDENTITY_BANK_FIT)),baseline=evaluateGalaxyBank(planes,spec,targets,identity);
 console.log(JSON.stringify({sentinel:'LMC_SLAB_BASELINE',score:baseline.score,passed:baseline.passed,rows:baseline.rows}));
 const fit=fitGalaxyBank(planes,spec,targets);await writeFile(directory+'compression-fit.json',JSON.stringify({fits:fit.fits,trajectory:fit.trajectory,score:fit.score,baselineScore:baseline.score,rows:fit.rows,passed:fit.passed},null,2)+'\n');
 const bank=directory+'bank/';await mkdir(bank,{recursive:true});await writeGalaxyModelBank(bank,spec,planes,fit.fits,new Set(fit.dense));
 const decoded:GalaxyDecodedPlane[]=[];
 const prototype=rec(await json(bank+'prototype.json'));need(Array.isArray(prototype.leaves),'Missing encoded layers');
 for(const value of prototype.leaves){const leaf=rec(value),axis='xyz'.indexOf(String(leaf.axis));need(axis===0||axis===1||axis===2,'Invalid decoded axis');const source=planes.find(p=>p.axis===axis&&p.index===leaf.index);need(source,'Orphaned optical layer');const optical=rec(leaf.opticalSlab),role=optical.role;need(role==='merged-three'||role==='single'||role==='merged-two','Invalid optical layer role');
  const {data,info}=await sharp(bank+String(leaf.texturePath)).ensureAlpha().raw().toBuffer({resolveWithObject:true});decoded.push({...source,width:info.width,height:info.height,rgba:data,border:3,opticalRole:role});}
 need(decoded.length===33&&planes.length===26,'Hybrid budget must remain exactly 26 slabs and 33 optical layers');
 const checked=targets.map(t=>({target:t,image:compositeGalaxyStack(decoded,spec.box,t.camera,t.axis)})),rows=checked.map(row=>galaxyResiduals(row.image,row.target));
 let alpha=0,delivered=0;for(const plane of planes.filter(p=>p.axis===2)){
  const original=encodeGalaxyPlane(plane,fit.fits[plane.axis]!,false),parts=decoded.filter(p=>p.axis===2&&p.index===plane.index);
  for(let y=0;y<plane.height;y++)for(let x=0;x<plane.width;x++){const a=original.rgba[(y*plane.width+x)*4+3]!/255;let t=1;for(const p of parts)t*=1-p.rgba[((y+3)*p.width+x+3)*4+3]!/255*hybridOpticalOpacity(p.opticalRole!,1);alpha+=a;delivered+=1-t;}
 }
 const exampleNames=['earth','tilt-0-azimuth-0','tilt-45-azimuth-0','tilt-90-azimuth-0'],panels=[];
 for(const name of exampleNames){const row=checked.find(r=>r.target.name===name)!;for(const [kind,raw]of [['reference',encodedRgb(row.target.linear)],['slabs',Buffer.from(Uint8Array.from(row.image,v=>Math.round(v*255)))]] as const){const png=await sharp(raw,{raw:{width:row.target.camera.width,height:row.target.camera.height,channels:3}}).png().toBuffer();await writeFile(directory+name+'-'+kind+'.png',png);panels.push(await sharp(png).resize(512,512,{fit:'contain',background:'#000'}).png().toBuffer());}}
 await sharp({create:{width:1024,height:2048,channels:3,background:'#000'}}).composite(panels.map((input,i)=>({input,left:i%2*512,top:Math.floor(i/2)*512}))).png().toFile(directory+'sheet.png');
 const result={complete:true,passed:rows.every(r=>r.passed),lightWithinTolerance:rows.every(r=>r.lightDifferencePercent>=-5&&r.lightDifferencePercent<=2),physicalSlabs:26,opticalLayers:33,denseSlabs:fit.dense,size,seconds:(performance.now()-started)/1000,spec,freeCompressionParameters:15,physicalModelParametersChanged:0,baselineScore:baseline.score,score:fit.score,rows,mergedAlphaFaceOnLossFraction:alpha>0?1-delivered/alpha:0,qualification:'Decoded hybrid PNGs use the same optical coefficient function as the real renderer. Light, radial and color residuals use the owner’s unchanged tolerances; the optical coefficient rule is separately checked against the exact optical path. Browser conformance is recorded separately. Physical model and dust are frozen.'};
 await writeFile(directory+'result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sentinel:'LMC_SLAB_PILOT_COMPLETE',...result}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){const size=Number(process.argv[2]??64);need(size===64||size===128||size===512,'Invalid slab rung');await runSlabPilot(size,process.argv.includes('--reuse'),process.argv.includes('--reuse-references'));}
