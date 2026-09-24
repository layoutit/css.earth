import { cross3 as cross, array, number, shape, text } from '@cssearth/core';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {loadObjShape} from '../terrestrial-layers/obj-shape.mts';
import {decodeNewHorizonsLorri,newHorizonsCamera,multiplyCameraMatrices} from '../terrestrial-layers/new-horizons-geo.mts';
import { readFitsHeader } from '@cssearth/fits';
import {observedLimb,limbThreshold,type LimbEdgePoint} from '../terrestrial-layers/limb-refinement.mts';

const root=resolve('src/objects/arrokoth/source'),read=async(path:string)=>JSON.parse(await readFile(resolve(root,path),'utf8'));
const profile=shape({mesh:text,frames:array(shape({id:text,image:text,output:text,bodyToJ2000:array(array(number)),offsetPixels:array(number)}))})(await read('preparation/photography.json'));
const mesh=await loadObjShape(resolve(root,profile.mesh),{metersPerUnit:1000,expectedVertices:20484,expectedFaces:40960});
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((s,n,i)=>s+n*b[i],0);
const sub=(a:readonly number[],b:readonly number[])=>a.map((n,i)=>n-b[i]);

const unit=(a:number[])=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
const normals=mesh.indices.map(face=>{const[a,b,c]=face.map(i=>mesh.positions[i]);return unit(cross(sub(b,a),sub(c,a)));});

/** Audit only. All camera values are frozen before inspecting these residuals;
 * the additional exposure below is neither fitted nor used to paint the mesh. */
function audit(bytes:Buffer,control:unknown){
 const camera=newHorizonsCamera(bytes,control),frame=decodeNewHorizonsLorri(bytes,camera),eye=camera.positionKm.map(v=>v*1000);
 const threshold=limbThreshold(frame.planes.IMAGE,frame.acceptPixel),points=observedLimb(frame,threshold.threshold,1000,threshold.bodyMean,.3);
 function residual(point:LimbEdgePoint){
  let lit=false;
  const hit=(s:number)=>{const p=frame.rayPixel(point.x+s*point.normal[0],point.y+s*point.normal[1]),ray=unit(camera.rayMatrix.map(row=>dot(row,[...p,1]))),h=mesh.intersect(eye,ray);if(h)lit=dot(normals[h.faceId],camera.sunDirection)>.01;return h;};
  const probes=[.5,1,2,4,8,16,32];let inside=0,outside:number|null=null,found=hit(0);
  if(found){for(const s of probes){if(!hit(s)){outside=s;break;}inside=s;}}
  else{let previous=0;for(const s of probes){const h=hit(-s);if(h){found=h;inside=-s;outside=-previous;break;}previous=s;}}
  if(outside===null||!found)return null;
  let boundary:number=outside;
  for(let i=0;i<8;i++){const middle:number=(inside+boundary)/2;if(hit(middle))inside=middle;else boundary=middle;}
  return {pixels:(inside+boundary)/2,lit};
 }
 const measured=points.map(p=>({partition:p.partition,...residual(p)}));
 const statistics=(partition:string)=>{const part=measured.filter(p=>p.partition===partition),lit=part.filter(p=>p.lit&&p.pixels!==undefined).map(p=>number(p.pixels));
  return{candidateEdges:part.length,matchedLitEdges:lit.length,unlitOrUnmatched:part.length-lit.length,rmsPixels:Math.sqrt(lit.reduce((s,v)=>s+v*v,0)/lit.length),maximumPixels:Math.max(...lit.map(Math.abs))};};
 return {midpointUtc:camera.startTime,threshold,fit:statistics('fit'),holdout:statistics('holdout')};
}
const reports=[];
for(const frame of profile.frames){const bytes=await readFile(resolve(root,frame.image));reports.push({id:frame.id,path:frame.image,...audit(bytes,frame)});}
const reference=profile.frames.find(frame=>frame.id==='ca06');if(!reference)throw new Error('Missing CA06 camera.');
const holdoutPath=process.argv[2]??'observations/lor_0408626333_0x636_sci.fit';
const independent=await readFile(resolve(root,holdoutPath)),original=await readFile(resolve(root,reference.image));
const elapsedSeconds=number(readFitsHeader(independent).header.SPCSCET)-number(readFitsHeader(original).header.SPCSCET);
// Buie et al. 2020, 15.9380 hours. This one-second prediction changes phase by
// only 0.0063 degrees and does not install a precision display spin ephemeris.
const angle=elapsedSeconds/(15.938*3600)*2*Math.PI,c=Math.cos(angle),s=Math.sin(angle);
const held=audit(independent,{...reference,bodyToJ2000:multiplyCameraMatrices(reference.bodyToJ2000,[[c,-s,0],[s,c,0],[0,0,1]])});
reports.push({id:'ca06-independent-exposure',path:holdoutPath,...held});
const report={schema:'cssearth-arrokoth-registration-audit@1',meshSha256:createHash('sha256').update(await readFile(resolve(root,profile.mesh))).digest('hex'),
 controlSha256:createHash('sha256').update(await readFile(resolve(root,'preparation/photography.json'))).digest('hex'),
 generator:{path:'tools/objects/arrokoth/qualify-photographs.mts',sha256:createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex')},
 elapsedSeconds,method:'Frozen mesh attitude and pointing offsets; original TAN-SIP ray distortion. Along-normal ray-hit/miss limb residuals. No correction is fitted by this audit.',
 limits:{maximumHoldoutRmsPixels:3,minimumMatchedHoldoutEdges:100},reports};
await writeFile(resolve(root,'../evidence/photography/registration.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(reports.some(r=>r.holdout.matchedLitEdges<100||r.holdout.rmsPixels>3))process.exitCode=1;
