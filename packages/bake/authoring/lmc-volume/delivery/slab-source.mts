/** LMC-only physical adapter. The shared galaxy pipeline owns intervals, encoding, fitting and compilation. */
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {projectGalaxyBank,type GalaxyBankSpec,type GalaxyPlane} from '../../milky-way-dust/galaxy-fitted-bank.mts';
import type {GalaxySlabDomain} from '../../milky-way-dust/galaxy-slab-domain.mts';
import {approvedScene,REFERENCE_STEP_KPC} from './reference.mts';
import {catalogueBasis,projectCatalogue} from '../catalogue-render.mts';
import {gradedPrediction} from '../grade.mts';
import type {CatalogueScene} from '../catalogue-scene.mts';
import type {VolumeObject} from '../catalogue-volume.mts';
import {need,rec,num,json} from '../inputs.mts';
export function intersectsSlab(object:VolumeObject,domain:GalaxySlabDomain):boolean {
 const radius=Math.sqrt(object.axes.reduce((s,r,k)=>s+(object.basis[k][domain.axis]*r)**2,0));return object.center[domain.axis]+radius>=domain.min&&object.center[domain.axis]-radius<domain.max;
}
export function localScene(scene:CatalogueScene,domain:GalaxySlabDomain):CatalogueScene {
 const out={...scene,objects:scene.objects.filter(v=>intersectsSlab(v,domain)),dust:scene.dust.filter(v=>intersectsSlab(v,domain))};
 if(scene.dustLayer?.clouds){need(!scene.dustLayer.cloudExtinctionRgb,'Per-cloud extinction needs index-preserving slab selection');out.dustLayer={...scene.dustLayer,clouds:scene.dustLayer.clouds.filter(v=>intersectsSlab(v,domain))};}
 if(scene.oldPopulation){const p=scene.oldPopulation.points,indices=[];for(let i=0;i<p.count;i++){const v=p.positions[i*3+domain.axis];if(v>=domain.min&&v<domain.max)indices.push(i);}
  const positions=new Float64Array(indices.length*3),rgb=new Float32Array(indices.length*3),components=new Uint8Array(indices.length);
  for(let j=0;j<indices.length;j++){const i=indices[j];for(let c=0;c<3;c++){positions[j*3+c]=p.positions[i*3+c];rgb[j*3+c]=p.rgb[i*3+c];}components[j]=p.components[i];}
  out.oldPopulation={...scene.oldPopulation,points:{count:indices.length,positions,rgb,components}};
 }return out;
}
export function projectLmcSlab(source:Pick<Awaited<ReturnType<typeof approvedScene>>,'scene'|'amplitudes'|'grade'>,domain:GalaxySlabDomain,camera:Parameters<typeof projectCatalogue>[1],native=false,pixels?:Uint8Array){
 const{scene,amplitudes,grade}=source,local=localScene(scene,domain),projection=projectCatalogue(local,camera,native ? .015 : REFERENCE_STEP_KPC,pixels,domain,native?{objectSubpixels:4,cacheFinishedDust:true,gaussianTailSigma:10}:undefined),basis=catalogueBasis(projection,local,amplitudes),rgb=gradedPrediction(basis,grade);need(projection.transmittance,'The local transfer must return its own dust transmittance');const tau=Float64Array.from(projection.transmittance[0],(_,p)=>-Math.log(Math.max(1e-30,Math.max(...projection.transmittance!.map(a=>a[p])))));return{rgb,tau};
}
export async function lmcSlabProjections(directory:string,spec:GalaxyBankSpec):Promise<GalaxyPlane[]>{
 await mkdir(directory,{recursive:true});const {scene,amplitudes,grade}=await approvedScene(),started=performance.now();
 const planes=await projectGalaxyBank(spec,async(domain,camera)=>{
  const t=performance.now(),local=localScene(scene,domain),projection=projectCatalogue(local,camera,REFERENCE_STEP_KPC,undefined,domain),basis=catalogueBasis(projection,local,amplitudes),rgb=gradedPrediction(basis,grade);
  need(projection.transmittance,'The local transfer must return its own dust transmittance');
  const tau=Float64Array.from(projection.transmittance[0],(_,p)=>-Math.log(Math.max(1e-30,Math.max(...projection.transmittance!.map(a=>a[p])))));
  console.log(JSON.stringify({sentinel:'LMC_LOCAL_SLAB',axis:domain.axis,min:domain.min,max:domain.max,seconds:(performance.now()-t)/1000}));return{rgb,tau};
 });
 for(const p of planes){const prefix=directory+`local-${p.axis}-${p.index}`;await writeFile(prefix+'-rgb.f64le',Buffer.from(p.rgb.buffer));await writeFile(prefix+'-tau.f64le',Buffer.from(p.tau.buffer));}
 await writeFile(directory+'local-planes.json',JSON.stringify({spec,seconds:(performance.now()-started)/1000,planes:planes.map(({rgb:_,tau:__,...p})=>p)},null,2)+'\n');return planes;
}
export async function readLocalPlanes(directory:string):Promise<GalaxyPlane[]>{
 const raw=rec(await json(directory+'local-planes.json'));need(Array.isArray(raw.planes),'Missing local plane records');const planes:GalaxyPlane[]=[];
 for(const value of raw.planes){const p=rec(value),axis=num(p.axis),index=num(p.index),width=num(p.width),height=num(p.height);need([0,1,2].includes(axis)&&Number.isSafeInteger(index)&&index>=0&&Number.isSafeInteger(width)&&Number.isSafeInteger(height)&&width>0&&height>0,'Invalid local plane');
  const prefix=directory+`local-${axis}-${index}`,rgb=await readFile(prefix+'-rgb.f64le'),tau=await readFile(prefix+'-tau.f64le');need(rgb.length===width*height*3*8&&tau.length===width*height*8,'Truncated local plane');
  need(axis===0||axis===1||axis===2,'Invalid slab axis');planes.push({axis,index,width,height,center:num(p.center),rgb:new Float64Array(Uint8Array.from(rgb).buffer),tau:new Float64Array(Uint8Array.from(tau).buffer)});
 }return planes;
}
