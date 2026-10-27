/** Numerical resolution pilot on native-pitch crops. No fit, sharpening or new image structure. */
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {approvedScene,APPROVED_COMMIT} from './reference.mts';
import {equalScale,equalOutside,cropCamera,RESOLUTION_DIR} from './resolution-cameras.mts';
import {earthCamera} from '../render.mts';
import {projectCatalogue,catalogueBasis} from '../catalogue-render.mts';
import {gradedPrediction} from '../grade.mts';
import {need,type Raster} from '../inputs.mts';
import {rayPlane,type V3} from '../geometry.mts';
import {refineFields} from './refined-fields.mts';

export function pixelDelta(a:Float64Array,b:Float64Array){need(a.length===b.length,'Resolution grids differ');let d=0,s=0;for(let i=0;i<a.length;i++){d+=Math.abs(a[i]-b[i]);s+=Math.abs(b[i]);}return d/Math.max(s,1e-20);}
function png(rgb:Float64Array,width:number,height:number){return sharp(Buffer.from(Uint8Array.from(rgb,v=>{const x=Math.max(0,Math.min(1,v));return Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055));})),{raw:{width,height,channels:3}}).png().toBuffer();}
function grid(name:string,r:Raster|undefined){return r?{name,n:r.n,widthKpc:2*r.half,cellPc:2000*r.half/r.n}:null;}
export async function runResolutionPilot(only?:string,refined=false){
 need(only===undefined||['earth','face','tilt45','edge'].includes(only),'Invalid resolution camera');
 const started=performance.now(),{scene,cfg,amplitudes,grade}=await approvedScene(),{observation:o,widthKpc,heightKpc,pcPerPixel}=await equalScale(),directory=RESOLUTION_DIR+(refined?'refined-pilot/':'pilot/');await mkdir(directory,{recursive:true});
 const refinement=refined?await refineFields(scene):null;
 const full=[earthCamera(o.width,o.height,o.rayAt,o.pixelOf),...[0,45,90].map(a=>equalOutside(a,1024,widthKpc))],names=['earth','face','tilt45','edge'];
 // Two real physical regions, selected before comparisons. Every camera follows the same mid-plane point.
 const anchors:[string,V3][]=[['bar',[0,0,0]],['gas',rayPlane(o.rayAt(286,122))]],rows=[];
 for(const[region,p]of anchors)for(let index=0;index<full.length;index++){
  if(only!==undefined&&only!==names[index])continue;
  const camera=full[index]!,center=camera.pixelOf!(p);need(center,'Crop anchor is behind camera');const left=Math.max(0,Math.min(camera.width-128,Math.round(center[0]-64))),top=Math.max(0,Math.min(camera.height-128,Math.round(center[1]-64))),crop=cropCamera(camera,left,top,128,128),predictions:Float64Array[]=[],times=[];
  for(const[step,subpixels]of (refined?[[.015,4]] as const:[[.06,2],[.015,4],[.0075,4]] as const)){
   const stem=directory+region+'-'+names[index]+'-'+step,t=performance.now();let rgb:Float64Array;
   try{const bytes=await readFile(stem+'.f64le');need(bytes.length===128*128*3*8,'Incomplete resolution projection');rgb=new Float64Array(Uint8Array.from(bytes).buffer);}catch{
    const basis=catalogueBasis(projectCatalogue(scene,crop,step,undefined,undefined,{objectSubpixels:subpixels,cacheFinishedDust:refined}),scene,amplitudes);rgb=gradedPrediction(basis,grade);await writeFile(stem+'.f64le',Buffer.from(rgb.buffer));await writeFile(stem+'.png',await png(rgb,128,128));
   }
   const seconds=(performance.now()-t)/1000;predictions.push(rgb);times.push(seconds);console.log(JSON.stringify({sentinel:'RESOLUTION_CROP',region,camera:names[index],step,subpixels,seconds,rssBytes:process.memoryUsage().rss}));
  }
  rows.push({region,camera:names[index],crop:{left,top,width:128,height:128},pcPerPixel: index===0?[pcPerPixel,heightKpc*1000/o.height]:[pcPerPixel,pcPerPixel],coarseToFineRelativeL1:refined?null:pixelDelta(predictions[0]!,predictions[2]!),mediumToFineRelativeL1:refined?null:pixelDelta(predictions[1]!,predictions[2]!),seconds:times});
 }
 if(refined){const result={complete:true,rows,refinement,seconds:(performance.now()-started)/1000};await writeFile(directory+'result'+(only?'-'+only:'')+'.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({sentinel:'REFINED_CROPS_COMPLETE',...result}));return;}
 const panels=[];for(const row of rows)for(const step of[.06,.015,.0075])panels.push(await sharp(directory+row.region+'-'+row.camera+'-'+step+'.png').resize(384,384,{kernel:'nearest'}).png().toBuffer());
 await sharp({create:{width:1152,height:rows.length*424,channels:3,background:'#101216'}}).composite([...rows.map((row,i)=>({input:Buffer.from(`<svg width="1152" height="40" xmlns="http://www.w3.org/2000/svg"><text x="8" y="28" fill="white" font-family="Arial" font-size="20">${row.region} ${row.camera}: 60 pc / 15 pc / 7.5 pc ray step · same 9.25 pc pixels</text></svg>`),left:0,top:i*424})),...panels.map((input,i)=>({input,left:i%3*384,top:Math.floor(i/3)*424+40}))]).png().toFile(directory+'sheet'+(only?'-'+only:'')+'.png');
 const result={complete:true,approvedCommit:APPROVED_COMMIT,configuration:cfg,physicalParametersFitted:0,widthKpc,heightKpc,pcPerPixel,oldOutsidePcPerPixel:16000/1024,representation:'Continuous analytic vertical densities and finite object chords, with 2D source maps; no global voxel cube.',grids:[grid('warp',scene.sources.warp),grid('old disc',scene.oldPopulation?.disc),grid('bar',scene.oldPopulation?.bar),grid('young',scene.youngDensity),grid('dust diffuse',scene.dustLayer?.column),grid('diffuse gas',scene.diffuseGas)],objects:scene.objects.length,dustObjects:scene.dustLayer?.clouds?.length,points:scene.oldPopulation?.points.count,rows,seconds:(performance.now()-started)/1000,maxRssBytes:process.resourceUsage().maxRSS*1024};
 await writeFile(directory+'result'+(only?'-'+only:'')+'.json',JSON.stringify({...result,refinement},null,2)+'\n');console.log(JSON.stringify({sentinel:'RESOLUTION_PILOT_COMPLETE',seconds:result.seconds,rows:rows.map(r=>({region:r.region,view:r.camera,coarse:r.coarseToFineRelativeL1,medium:r.mediumToFineRelativeL1})),grids:result.grids}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await runResolutionPilot(process.argv.find(v=>v.startsWith('--view='))?.slice(7),process.argv.includes('--refined'));
