import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {requireRecord,requireString} from '../../source-values.mts';
import {parseCameraColor,parseCameraFrame} from './source-records.mts';
import {loadCameraShape,controlledShapeCamera,decodeCalibratedCamera} from './shape-camera-mosaic.mts';

// Preparation-only feature registration. The job retains the original camera seeds.
const jobPath=process.argv[2],outputPath=process.argv[3];
if(!jobPath||!outputPath)throw new Error('Usage: register-camera-bands.mts JOB.json REPORT.json [--check-only]');
const checkOnly=process.argv.includes('--check-only');
const recipeText=await readFile(jobPath,'utf8'),job=requireRecord(JSON.parse(recipeText));
const body=requireString(job.body),root=resolve(dirname(jobPath),requireString(job.sourceRoot));
const recipe=parseCameraColor(job.color),profile=requireRecord(job.shape);
const mesh=await loadCameraShape(root,profile);
const reference=parseCameraFrame(job.referenceFrame),camera=controlledShapeCamera(reference);
const sourceBytes=await readFile(`${root}/${reference.path}`), ref=decodeCalibratedCamera(sourceBytes);
function sample(a:ArrayLike<number>,x:number,y:number,validity?:ArrayLike<number>):number|null{
 // Correlation uses a 31-pixel convolution: retain its complete detector support,
 // including the neighboring sample used for bilinear interpolation.
 if(x<16||y<16||x>=1008||y>=1008)return null;
 const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,i=iy*1024+ix;
 const ns=[a[i],a[i+1],a[i+1024],a[i+1025]];
 if(ns.some(n=>!Number.isFinite(n))||(validity?[validity[i],validity[i+1],validity[i+1024],validity[i+1025]]:ns).some(n=>!Number.isFinite(n)||n<0.002))return null;
 return (ns[0]*(1-u)+ns[1]*u)*(1-v)+(ns[2]*(1-u)+ns[3]*u)*v;
}
function detail(values:ArrayLike<number>){
 const integral=new Float64Array(1025*1025);
 for(let y=0;y<1024;y++){let row=0;for(let x=0;x<1024;x++){row+=Number.isFinite(values[y*1024+x])?values[y*1024+x]:0;integral[(y+1)*1025+x+1]=integral[y*1025+x+1]+row;}}
 const mean=(x:number,y:number,r:number)=>{const x0=Math.max(0,x-r),y0=Math.max(0,y-r),x1=Math.min(1024,x+r+1),y1=Math.min(1024,y+r+1);return (integral[y1*1025+x1]-integral[y0*1025+x1]-integral[y1*1025+x0]+integral[y0*1025+x0])/((x1-x0)*(y1-y0));};
 return Float32Array.from(values,(_,i)=>mean(i%1024,Math.floor(i/1024),2)-mean(i%1024,Math.floor(i/1024),15));
}
if(ref.width!==1024||ref.height!==1024)throw new Error('Feature registration requires an unbinned 1024-square reference');
const referenceDetail=detail(ref.data);
// The largest connected bright region locates a search window only. It never controls delivered coverage.
function box(values:ArrayLike<number>){
 const seen=new Uint8Array(values.length),queue=new Int32Array(values.length);let biggest:number[]=[];
 for(let i=0;i<values.length;i++)if(!seen[i]&&values[i]>.02){
  let first=0,last=1;queue[0]=i;seen[i]=1;
  while(first<last){const j=queue[first++],x=j%1024;for(const k of [j-1024,j+1024,...(x?[j-1]:[]),...(x<1023?[j+1]:[])])if(k>=0&&k<values.length&&!seen[k]&&values[k]>.02){seen[k]=1;queue[last++]=k;}}
  if(last>biggest.length)biggest=Array.from(queue.subarray(0,last));
 }
 let x0=1024,y0=1024,x1=0,y1=0;for(const i of biggest){x0=Math.min(x0,i%1024);x1=Math.max(x1,i%1024);y0=Math.min(y0,Math.floor(i/1024));y1=Math.max(y1,Math.floor(i/1024));}
 return {x0,y0,x1,y1};
}
const bbox=box(ref.data),radius=13,step=Math.max(2*radius+2,Math.round(Math.sqrt((bbox.x1-bbox.x0)*(bbox.y1-bbox.y0)/180)));
interface Patch {pixel:number[];point:number[];normal:number[];points:number[][];values:number[];partition:'fit'|'holdout'}
const patches:Patch[]=[];
for(let y=bbox.y0+radius;y<bbox.y1-radius;y+=step)for(let x=bbox.x0+radius;x<bbox.x1-radius;x+=step){
 const points:number[][]=[],values:number[]=[];let ok=true;
 for(let dy=-radius;dy<=radius&&ok;dy+=2)for(let dx=-radius;dx<=radius;dx+=2){
  const value=sample(referenceDetail,x+dx,y+dy,ref.data);if(value===null){ok=false;break;}
  const ray=camera.ray(x+dx,y+dy),h=mesh.intersect(camera.position,Array.from(ray));if(!h){ok=false;break;}
  points.push(camera.position.map((n,k)=>n+ray[k]*h.radius));values.push(value);
 }
 if(!ok)continue;
 const mean=values.reduce((a,b)=>a+b,0)/values.length,variance=values.reduce((a,b)=>a+(b-mean)**2,0)/values.length;
 if(variance<1e-6)continue;
 const ray=camera.ray(x,y),h=mesh.intersect(camera.position,Array.from(ray));if(!h)continue;
 const point=camera.position.map((n,k)=>n+ray[k]*h.radius),[a,b,c]=mesh.indices[h.faceId].map(i=>mesh.positions[i]);
 const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);let normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const sign=normal.reduce((s,n,i)=>s+n*point[i],0)<0?-1:1,length=Math.hypot(...normal);normal=normal.map(n=>n/length*sign);
 if(normal.reduce((s,n,i)=>s-n*ray[i],0)<Math.cos(65*Math.PI/180)||normal.reduce((s,n,i)=>s+n*camera.sun[i],0)<Math.cos(75*Math.PI/180))continue;
 patches.push({pixel:[x,y],point,normal,points,values,partition:(Math.round((x-bbox.x0-radius)/step)+Math.round((y-bbox.y0-radius)/step))%2?'holdout':'fit'});
}
function solve(a:number[][],b:number[]){const m=a.map((r,i)=>[...r,b[i]]),n=b.length;for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[p][i]))p=j;[m[i],m[p]]=[m[p],m[i]];const d=m[i][i];if(Math.abs(d)<1e-14)throw new Error('Degenerate controls');for(let k=i;k<=n;k++)m[i][k]/=d;for(let j=0;j<n;j++)if(j!==i){const f=m[j][i];for(let k=i;k<=n;k++)m[j][k]-=f*m[i][k];}}return m.map(r=>r[n]);}
function ncc(a:number[],b:number[]){const ma=a.reduce((s,n)=>s+n,0)/a.length,mb=b.reduce((s,n)=>s+n,0)/b.length;let aa=0,bb=0,ab=0;for(let i=0;i<a.length;i++){const da=a[i]-ma,db=b[i]-mb;aa+=da*da;bb+=db*db;ab+=da*db;}return ab/Math.sqrt(aa*bb);}
const reports=[];
for(const channel of recipe.channels){
 const frame=channel.frames[0], targetBytes=await readFile(`${root}/${frame.path}`),target=decodeCalibratedCamera(targetBytes),projector=controlledShapeCamera(frame),targetDetail=detail(target.data);
 const center=frame.center,northAzimuthDegrees=frame.northAzimuthDegrees;
 if(!center||center.length!==2||!center.every(Number.isFinite)||typeof northAzimuthDegrees!=='number'||!Number.isFinite(northAzimuthDegrees))throw new Error('A controlled detector centre and north azimuth are required');
 if(target.width!==1024||target.height!==1024)throw new Error('Feature registration requires unbinned 1024-square bands');
 const origin=[0,0],search=9;
 const controls=[];
 for(const patch of patches){
  const toward=projector.position.map((n,i)=>n-patch.point[i]),length=Math.hypot(...toward);
  if(patch.normal.reduce((s,n,i)=>s+n*toward[i]/length,0)<Math.cos(65*Math.PI/180))continue;
  const visible=patch.points.every(p=>{const delta=p.map((n,i)=>n-projector.position[i]),distance=Math.hypot(...delta),hit=mesh.intersect(projector.position,delta.map(n=>n/distance));return hit&&Math.abs(hit.radius-distance)<1;});
  if(!visible)continue;
  const xy=patch.points.map(p=>projector.project(p));if(xy.some(v=>!v))continue;
  const score=(dx:number,dy:number)=>{const b=xy.map(p=>p?sample(targetDetail,p[0]+dx,p[1]+dy,target.data):null);return b.some(v=>v===null)?-1:ncc(patch.values,b.filter((v):v is number=>v!==null));};
  let best=-1,bx=0,by=0;
  for(let dy=origin[1]-search;dy<=origin[1]+search;dy++)for(let dx=origin[0]-search;dx<=origin[0]+search;dx++){const s=score(dx,dy);if(s>best){best=s;bx=dx;by=dy;}}
  if(best<.9||Math.abs(bx-origin[0])===search||Math.abs(by-origin[1])===search)continue;
  const separatedPeak=Math.max(...[-3,0,3].flatMap(dx=>[-3,0,3].filter(dy=>dx!==0||dy!==0).map(dy=>score(bx+dx,by+dy))));
  if(best-separatedPeak<.01)continue;
  if(2*best-score(bx-1,by)-score(bx+1,by)<.002||2*best-score(bx,by-1)-score(bx,by+1)<.002)continue;
  const peak=(a:number,b:number,c:number)=>{const d=a-2*b+c;return Math.abs(d)>1e-8?Math.max(-.75,Math.min(.75,.5*(a-c)/d)):0;};
  const dx=bx+peak(score(bx-1,by),best,score(bx+1,by)),dy=by+peak(score(bx,by-1),best,score(bx,by+1));
  const p=projector.project(patch.point);if(!p)continue;
  controls.push({partition:patch.partition,referencePixel:patch.pixel,pointMeters:patch.point,predictedPixel:p,measuredPixel:[p[0]+dx,p[1]+dy],offset:[dx,dy],correlation:best});
 }
 const fit=controls.filter(c=>c.partition==='fit');
 if(fit.length<6){reports.push({filter:channel.filter,id:frame.id,accepted:false,reason:'Insufficient independent feature patches',controls:controls.length,patches:patches.length});continue;}
 const normal=Array.from({length:3},()=>[0,0,0]),rhs=[0,0,0];
 for(const c of fit){const [x,y]=c.predictedPixel.map((n,i)=>n-center[i]);for(const [r,value] of [[[1,0,-y],c.offset[0]],[[0,1,x],c.offset[1]]] as const){for(let i=0;i<3;i++){rhs[i]+=r[i]*value;for(let j=0;j<3;j++)normal[i][j]+=r[i]*r[j];}}}
 const [dx,dy,roll]=checkOnly?[0,0,0]:solve(normal,rhs),corrected={...frame,center:[center[0]+dx,center[1]+dy],northAzimuthDegrees:northAzimuthDegrees+roll*180/Math.PI};
 const accepted=controlledShapeCamera(corrected);
 const residuals=controls.map(c=>({...c,residualPixels:Math.hypot(...accepted.project(c.pointMeters)!.map((n,i)=>n-c.measuredPixel[i]))}));
 const stats=(partition:'fit'|'holdout')=>{const cs=residuals.filter(c=>c.partition===partition);return {count:cs.length,rmsPixels:Math.sqrt(cs.reduce((s,c)=>s+c.residualPixels**2,0)/cs.length),maximumPixels:Math.max(...cs.map(c=>c.residualPixels))};};
 const holdout=stats('holdout');
 reports.push({filter:channel.filter,id:frame.id,accepted:holdout.count>=6&&holdout.rmsPixels<=1&&holdout.maximumPixels<=2,seedCamera:frame,correctedCamera:corrected,fit:stats('fit'),holdout,
  reference:{id:reference.id,sha256:createHash('sha256').update(sourceBytes).digest('hex')},targetSha256:createHash('sha256').update(targetBytes).digest('hex'),controls:residuals});
 console.log(body,channel.filter,'correction',dx,dy,roll*180/Math.PI,'fit',stats('fit'),'holdout',holdout);
}
await writeFile(outputPath,JSON.stringify({body,mode:checkOnly?'fixed-camera-validation':'feature-fit',recipeSha256:createHash('sha256').update(recipeText).digest('hex'),referenceCamera:reference,
 implementationSha256:createHash('sha256').update(await readFile(import.meta.filename)).digest('hex'),
 mesh:{path:profile.path,sha256:createHash('sha256').update(await readFile(resolve(root,requireString(profile.path)))).digest('hex')},
 settings:{patchRadiusPixels:radius,patchSampleStepPixels:2,patchGridStepPixels:step,searchRadiusPixels:9,detailBoxWidthsPixels:[5,31],maximumEmissionDegrees:65,maximumReferenceIncidenceDegrees:75,minimumValidSignal:.002,minimumDetailVariance:1e-6,minimumConvolutionMarginPixels:16,maximumSourceMeshVisibilityResidualMeters:1},
 method:'Rigid detector translation and roll fitted to interior image features through the published source mesh; disjoint checkerboard patches held out. A 5-pixel minus31-pixel box-mean image isolates detail for correlation only; original I/F stays unchanged. Fixed source range, focal scale, body and solar directions.',
 criteria:{minimumCorrelation:.9,minimumSeparatedPeakMargin:.01,minimumPeakCurvature:.002,minimumFitControls:6,minimumHoldoutControls:6,maximumHoldoutRmsPixels:1,maximumHoldoutResidualPixels:2},reports},null,2)+'\n');
