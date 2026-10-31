/** Approved l36 at native input resolution. No fitting and no cached/upscaled projection. */
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import sharp from 'sharp';
import {loadParent,parentRung,versionDir,sceneControls} from '../sequence-state.mts';
import {readGrade,gradedPrediction} from '../grade.mts';
import {loadObservation} from '../observation.mts';
import {earthCamera,outsideCamera} from '../render.mts';
import {projectCatalogue,catalogueBasis} from '../catalogue-render.mts';
import {normalized,saveGradedSheet} from '../grade-report.mts';
import {writeContrastBasis} from '../contrast-cache.mts';
import {metrics,targetOf,imageBytes} from '../report.mts';
import {json,rec,num,need} from '../inputs.mts';
import {pinsFor,measure,pngRgb} from '../owner-rounds/pins.mts';

export const APPROVED_MODEL=36;
export const APPROVED_COMMIT='e4ebd6c94263f73dc020ad0d1443901182310329';
export const REFERENCE_STEP_KPC=.06;
export function referenceSize(value:number):512|1024 {
 need(value===512||value===1024,'Approved delivery supports the 512 px pilot and the native 1024 px reference only');return value;
}
export function requireNativeAgreement(colorRatioChange:number,brightnessChange:number):void {
 need(Number.isFinite(colorRatioChange)&&Number.isFinite(brightnessChange)&&colorRatioChange>=0&&brightnessChange>=0&&colorRatioChange<=.02&&brightnessChange<=.02,'Native sampling changed an approved owner pin by more than 2%');
}
export function requireApprovedCommit(commit:string):void {need(commit===APPROVED_COMMIT,'The approved model tag differs; never move it to a later stage');}
export function approvedTag():void {
 const commit=execFileSync('git',['rev-parse','lmc-approved-model^{commit}'],{encoding:'utf8'}).trim();
 requireApprovedCommit(commit);
}
export async function approvedScene(){
 approvedTag();const {scene,cfg}=await loadParent(APPROVED_MODEL);
 const accepted=await parentRung(APPROVED_MODEL,false,scene);
 const grade=readGrade(accepted.result.grade);
 const pinned=(name:string)=>rec(JSON.parse(execFileSync('git',['show',APPROVED_COMMIT+':src/objects/lmc-volume/source/preparation/l36/'+name+'.json'],{encoding:'utf8'})));
 need(isDeepStrictEqual(cfg,pinned('recipe').configuration),'Working model configuration differs from the approved commit');
 need(isDeepStrictEqual({...grade,score:0},{...readGrade(pinned('fit').grade),score:0}),'Working model grade differs from the approved commit');
 return{scene,cfg,amplitudes:accepted.amplitudes,grade};
}
export function downsampleLinear(rgb:Float64Array,width:number,height:number,factor:number):Float64Array {
 need(Number.isSafeInteger(factor)&&factor>0&&width%factor===0&&height%factor===0&&rgb.length===width*height*3,'Invalid reference reduction');
 const w=width/factor,h=height/factor,out=new Float64Array(w*h*3);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)for(let c=0;c<3;c++)out[(Math.floor(y/factor)*w+Math.floor(x/factor))*3+c]+=rgb[(y*width+x)*3+c]/factor**2;
 return out;
}
async function pinCrops(dir:string,size:number,o:Awaited<ReturnType<typeof loadObservation>>,prediction:Float64Array){
 const rgb=size===512?prediction:downsampleLinear(prediction,1024,768,2),reduced=await sharp(imageBytes(normalized(rgb,o),o,true),{raw:{width:512,height:384,channels:3}}).png().toBuffer();
 await writeFile(dir+'earth-512.png',reduced);
 const rows=[];
 const photo=await pngRgb(versionDir(36)+'horalek.png'),previous=await pngRgb(versionDir(36)+'earth.png'),current=await pngRgb(dir+'earth-512.png');
 for(const pin of pinsFor(36)){
  const panels=await Promise.all([versionDir(36)+'horalek.png',versionDir(36)+'earth.png',dir+'earth-512.png'].map(path=>sharp(path).extract({left:pin.x-15,top:pin.y-15,width:31,height:31}).resize(248,248,{kernel:'nearest'}).png().toBuffer()));
  const title=Buffer.from(`<svg width="744" height="290" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#101216"/><text x="8" y="27" fill="white" font-family="Arial" font-size="17">${pin.id}: Horálek | approved l36 | ${size} px reference (same 31 px window)</text></svg>`);
  await sharp(title).composite(panels.map((input,i)=>({input,left:i*248,top:42}))).png().toFile(dir+'pin-'+pin.id+'.png');
  rows.push({pin,photo:measure(photo,pin),approved:measure(previous,pin),native:measure(current,pin)});
 }
 const maximumColorRatioChange=Math.max(...rows.flatMap(r=>[Math.abs(r.native.rg/r.approved.rg-1),Math.abs(r.native.bg/r.approved.bg-1)])),light=(rgb:readonly number[])=>rgb.reduce((s,v,c)=>s+v*[.2126,.7152,.0722][c]!,0),maximumBrightnessChange=Math.max(...rows.map(r=>Math.abs(light(r.native.rgb)/light(r.approved.rgb)-1)));
 await writeFile(dir+'pins.json',JSON.stringify({method:'Area mean in linear display light, then frozen sky and sRGB encoding',maximumColorRatioChange,maximumBrightnessChange,pins:rows},null,2)+'\n');requireNativeAgreement(maximumColorRatioChange,maximumBrightnessChange);
}
export async function verifyPilotReplay(){
 for(const name of ['earth','face','tilt45','edge']){
  const [approved,pilot]=await Promise.all([sharp(versionDir(36)+name+'.png').raw().toBuffer(),sharp(versionDir(36)+'delivery/512/'+name+'.png').raw().toBuffer()]);
  need(approved.equals(pilot),'Fresh 512 px physical pilot differs from approved l36: '+name);
 }return{views:4,decodedPixelsIdentical:true};
}
export async function runReference(size:512|1024,finishLog?:string){
 const dir=versionDir(36)+'delivery/'+size+'/',started=performance.now();await mkdir(dir,{recursive:true});
 if(size===1024){const pilot=rec(await json(versionDir(36)+'delivery/512/result.json'));need(pilot.complete===true&&num(pilot.size)===512,'The exact 512 px reference pilot must complete before scale');}
 const {scene,cfg,amplitudes,grade}=await approvedScene();
 // Freeze the approved display nuisance values too. Changing the pixel grid never remeasures the sky or exposure.
 const small=await loadObservation(8),display={sky:small.metadata.sky.rgbLinearDisplay,commonFactor:small.metadata.normalization.commonFactor};
 const o=size===512?small:await loadObservation(16,undefined,display),cameras=[earthCamera(o.width,o.height,o.rayAt,o.pixelOf),...[0,45,90].map(a=>outsideCamera(a,size))];
 const names=['earth','face','tilt45','edge'],predictions:Float64Array[]=[],timings=[];
 const frozen=JSON.stringify({approvedCommit:APPROVED_COMMIT,configuration:cfg,grade,sceneControls:sceneControls(scene),amplitudes:[...amplitudes],stepKpc:REFERENCE_STEP_KPC,display},null,2)+'\n';
 if(size===1024){need(await readFile(versionDir(36)+'delivery/512/frozen-model.json','utf8')===frozen,'Full resolution changed the physical pilot configuration');await verifyPilotReplay();}
 if(finishLog)need(await readFile(dir+'frozen-model.json','utf8')===frozen,'Completed projections do not have the approved configuration');else await writeFile(dir+'frozen-model.json',frozen);
 const completed=finishLog?(await readFile(finishLog,'utf8')).split('\n').filter(line=>line.startsWith('{')).map(line=>rec(JSON.parse(line))).filter(row=>row.sentinel==='APPROVED_REFERENCE_VIEW'&&row.size===size):[];
 if(finishLog)need(completed.length===4&&names.every(name=>completed.filter(row=>row.camera===name&&num(row.seconds)>0).length===1),'Report recovery requires all four completed physical projections');
 for(let i=0;i<cameras.length;i++){
  if(finishLog){const bytes=await readFile(dir+names[i]+'.f64le'),camera=cameras[i]!;need(bytes.length===camera.width*camera.height*3*8,'Incomplete physical reference');const rgb=new Float64Array(Uint8Array.from(bytes).buffer);need(rgb.every(v=>Number.isFinite(v)&&v>=0),'Invalid physical reference');predictions.push(rgb);timings.push({camera:names[i],seconds:num(completed.find(row=>row.camera===names[i])!.seconds)});continue;}
  const t=performance.now(),basis=catalogueBasis(projectCatalogue(scene,cameras[i]!,REFERENCE_STEP_KPC),scene,amplitudes);
  await writeContrastBasis(names[i]!,basis,dir);const prediction=gradedPrediction(basis,grade);predictions.push(prediction);
  await writeFile(dir+names[i]+'.f64le',Buffer.from(prediction.buffer,prediction.byteOffset,prediction.byteLength));
  const seconds=(performance.now()-t)/1000;timings.push({camera:names[i],seconds});console.log(JSON.stringify({sentinel:'APPROVED_REFERENCE_VIEW',size,camera:names[i],seconds}));
 }
 await saveGradedSheet(dir,36,o,predictions[0]!,predictions.slice(1),grade,'Approved l36. Fresh physical projection; no fit.','approved native reference',versionDir(36)+'../inputs/ngc4027-eso.jpg');
 await pinCrops(dir,size,small,predictions[0]!);const pilotReplay=await verifyPilotReplay();
 const seconds=finishLog?timings.reduce((sum,row)=>sum+row.seconds,0)+(performance.now()-started)/1000:(performance.now()-started)/1000;
 const result={complete:true,size,width:o.width,height:o.height,approvedCommit:APPROVED_COMMIT,stepKpc:REFERENCE_STEP_KPC,seconds,timings,residuals:metrics(normalized(predictions[0]!,o),targetOf(o),o),estimated1024Seconds:size===512?seconds*4:null,configurationUnchanged:true,parametersFitted:0,pilotReplay};
 await writeFile(dir+'result.json',JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({sentinel:'APPROVED_REFERENCE_COMPLETE',...result}));
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url)await runReference(referenceSize(Number(process.argv[2])),process.argv[3]);
