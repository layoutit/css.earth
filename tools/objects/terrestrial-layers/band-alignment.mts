/**
 * Feature registration of calibrated filter cameras against a reference image, through the published source mesh.
 * A fit solves one rigid detector translation and roll per target; a check keeps the authored cameras and measures them.
 * Correlation reads a 5-minus-31-pixel detail image only; original I/F is never changed. Disjoint checkerboard patches are
 * held out, and a camera is accepted when its held-out residuals stay within the criteria below.
 */
import type {loadCameraShape} from './shape-camera-mosaic.mts';

export interface AlignmentImage {data:ArrayLike<number>;width:number;height:number}
export interface AlignmentCamera {position:readonly number[];sun:readonly number[];ray(x:number,y:number):ArrayLike<number>;project(point:readonly number[]):readonly number[]|null}
export interface AlignmentFrame {id:string;center?:readonly number[];northAzimuthDegrees?:number}
export interface AlignmentSource<F extends AlignmentFrame> {frame:F;image:AlignmentImage;sha256:string}
type AlignmentMesh = Pick<Awaited<ReturnType<typeof loadCameraShape>>,'intersect'|'indices'|'positions'>;

export const BAND_ALIGNMENT_SETTINGS = {patchRadiusPixels:13,patchSampleStepPixels:2,searchRadiusPixels:9,detailBoxWidthsPixels:[5,31],maximumEmissionDegrees:65,
  maximumReferenceIncidenceDegrees:75,minimumValidSignal:.002,minimumDetailVariance:1e-6,minimumConvolutionMarginPixels:16,maximumSourceMeshVisibilityResidualMeters:1} as const;
export const BAND_ALIGNMENT_CRITERIA = {minimumCorrelation:.9,minimumSeparatedPeakMargin:.01,minimumPeakCurvature:.002,minimumFitControls:6,minimumHoldoutControls:6,
  maximumHoldoutRmsPixels:1,maximumHoldoutResidualPixels:2} as const;
export const BAND_ALIGNMENT_METHOD = 'Rigid detector translation and roll fitted to interior image features through the published source mesh; disjoint checkerboard patches held out. A 5-pixel minus31-pixel box-mean image isolates detail for correlation only; original I/F stays unchanged. Fixed source range, focal scale, body and solar directions.';
const S = BAND_ALIGNMENT_SETTINGS, C = BAND_ALIGNMENT_CRITERIA;

/** A bilinear sample of a detail image. Correlation uses a 31-pixel convolution, so the complete detector support must be
 * retained, including the neighbouring sample used for interpolation, and the original signal must be valid. */
function sample(image:AlignmentImage,a:ArrayLike<number>,x:number,y:number,validity?:ArrayLike<number>):number|null{
 const w=image.width,margin=S.minimumConvolutionMarginPixels;
 if(x<margin||y<margin||x>=w-margin||y>=image.height-margin)return null;
 const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,i=iy*w+ix;
 // Scalar neighbours: the search below samples every patch point at hundreds of offsets.
 const n0=a[i],n1=a[i+1],n2=a[i+w],n3=a[i+w+1];
 if(!Number.isFinite(n0)||!Number.isFinite(n1)||!Number.isFinite(n2)||!Number.isFinite(n3))return null;
 const g0=validity?validity[i]:n0,g1=validity?validity[i+1]:n1,g2=validity?validity[i+w]:n2,g3=validity?validity[i+w+1]:n3;
 if(!valid(g0)||!valid(g1)||!valid(g2)||!valid(g3))return null;
 return (n0*(1-u)+n1*u)*(1-v)+(n2*(1-u)+n3*u)*v;
}
const valid=(n:number)=>Number.isFinite(n)&&!(n<S.minimumValidSignal);
function detail({data:values,width:w,height:h}:AlignmentImage){
 const integral=new Float64Array((w+1)*(h+1));
 for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=Number.isFinite(values[y*w+x])?values[y*w+x]:0;integral[(y+1)*(w+1)+x+1]=integral[y*(w+1)+x+1]+row;}}
 const mean=(x:number,y:number,r:number)=>{const x0=Math.max(0,x-r),y0=Math.max(0,y-r),x1=Math.min(w,x+r+1),y1=Math.min(h,y+r+1);return (integral[y1*(w+1)+x1]-integral[y0*(w+1)+x1]-integral[y1*(w+1)+x0]+integral[y0*(w+1)+x0])/((x1-x0)*(y1-y0));};
 return Float32Array.from(values,(_,i)=>mean(i%w,Math.floor(i/w),2)-mean(i%w,Math.floor(i/w),15));
}
/** The largest connected bright region locates a search window only. It never controls delivered coverage. */
function box({data:values,width:w,height:h}:AlignmentImage){
 const seen=new Uint8Array(values.length),queue=new Int32Array(values.length);let biggest:number[]=[];
 for(let i=0;i<values.length;i++)if(!seen[i]&&values[i]>.02){
  let first=0,last=1;queue[0]=i;seen[i]=1;
  while(first<last){const j=queue[first++],x=j%w;for(const k of [j-w,j+w,...(x?[j-1]:[]),...(x<w-1?[j+1]:[])])if(k>=0&&k<values.length&&!seen[k]&&values[k]>.02){seen[k]=1;queue[last++]=k;}}
  if(last>biggest.length)biggest=Array.from(queue.subarray(0,last));
 }
 let x0=w,y0=h,x1=0,y1=0;for(const i of biggest){x0=Math.min(x0,i%w);x1=Math.max(x1,i%w);y0=Math.min(y0,Math.floor(i/w));y1=Math.max(y1,Math.floor(i/w));}
 return {x0,y0,x1,y1};
}
function solve(a:number[][],b:number[]){const m=a.map((r,i)=>[...r,b[i]]),n=b.length;for(let i=0;i<n;i++){let p=i;for(let j=i+1;j<n;j++)if(Math.abs(m[j][i])>Math.abs(m[p][i]))p=j;[m[i],m[p]]=[m[p],m[i]];const d=m[i][i];if(Math.abs(d)<1e-14)throw new Error('Degenerate controls');for(let k=i;k<=n;k++)m[i][k]/=d;for(let j=0;j<n;j++)if(j!==i){const f=m[j][i];for(let k=i;k<=n;k++)m[j][k]-=f*m[i][k];}}return m.map(r=>r[n]);}
function ncc(a:number[],b:number[]){const ma=a.reduce((s,n)=>s+n,0)/a.length,mb=b.reduce((s,n)=>s+n,0)/b.length;let aa=0,bb=0,ab=0;for(let i=0;i<a.length;i++){const da=a[i]-ma,db=b[i]-mb;aa+=da*da;bb+=db*db;ab+=da*db;}return ab/Math.sqrt(aa*bb);}

interface Patch {pixel:number[];point:number[];normal:number[];points:number[][];values:number[];partition:'fit'|'holdout'}

/** Register each target against the reference: fit its detector centre and roll, or with `checkOnly` measure the authored camera. */
export function alignCameraBands<F extends AlignmentFrame>({mesh,camera,reference,targets,checkOnly,searchRadiusPixels=S.searchRadiusPixels}:{mesh:AlignmentMesh;camera:(frame:unknown)=>AlignmentCamera;
  reference:AlignmentSource<F>;targets:readonly (AlignmentSource<F>&{filter:string})[];checkOnly:boolean;searchRadiusPixels?:number}){
 if(!Number.isInteger(searchRadiusPixels)||searchRadiusPixels<1||searchRadiusPixels>64)throw new Error('Feature registration search radius must be an integer from 1 to 64 pixels.');
 const ref=reference.image,referenceCamera=camera(reference.frame),referenceDetail=detail(ref);
 const bbox=box(ref),radius=S.patchRadiusPixels,step=Math.max(2*radius+2,Math.round(Math.sqrt((bbox.x1-bbox.x0)*(bbox.y1-bbox.y0)/180)));
 const patches:Patch[]=[];
 for(let y=bbox.y0+radius;y<bbox.y1-radius;y+=step)for(let x=bbox.x0+radius;x<bbox.x1-radius;x+=step){
  const points:number[][]=[],values:number[]=[];let ok=true;
  for(let dy=-radius;dy<=radius&&ok;dy+=S.patchSampleStepPixels)for(let dx=-radius;dx<=radius;dx+=S.patchSampleStepPixels){
   const value=sample(ref,referenceDetail,x+dx,y+dy,ref.data);if(value===null){ok=false;break;}
   const ray=referenceCamera.ray(x+dx,y+dy),h=mesh.intersect(referenceCamera.position,Array.from(ray));if(!h){ok=false;break;}
   points.push(referenceCamera.position.map((n,k)=>n+ray[k]*h.radius));values.push(value);
  }
  if(!ok)continue;
  const mean=values.reduce((a,b)=>a+b,0)/values.length,variance=values.reduce((a,b)=>a+(b-mean)**2,0)/values.length;
  if(variance<S.minimumDetailVariance)continue;
  const ray=referenceCamera.ray(x,y),h=mesh.intersect(referenceCamera.position,Array.from(ray));if(!h)continue;
  const point=referenceCamera.position.map((n,k)=>n+ray[k]*h.radius),[a,b,c]=mesh.indices[h.faceId].map(i=>mesh.positions[i]);
  const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);let normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const sign=normal.reduce((s,n,i)=>s+n*point[i],0)<0?-1:1,length=Math.hypot(...normal);normal=normal.map(n=>n/length*sign);
  if(normal.reduce((s,n,i)=>s-n*ray[i],0)<Math.cos(S.maximumEmissionDegrees*Math.PI/180)||normal.reduce((s,n,i)=>s+n*referenceCamera.sun[i],0)<Math.cos(S.maximumReferenceIncidenceDegrees*Math.PI/180))continue;
  patches.push({pixel:[x,y],point,normal,points,values,partition:(Math.round((x-bbox.x0-radius)/step)+Math.round((y-bbox.y0-radius)/step))%2?'holdout':'fit'});
 }
 const reports=[];
 for(const target of targets){
  const frame=target.frame,image=target.image,projector=camera(frame),targetDetail=detail(image);
  const center=frame.center,northAzimuthDegrees=frame.northAzimuthDegrees;
  if(!center||center.length!==2||!center.every(Number.isFinite)||typeof northAzimuthDegrees!=='number'||!Number.isFinite(northAzimuthDegrees))throw new Error('A controlled detector centre and north azimuth are required');
  const origin=[0,0],search=searchRadiusPixels;
  const controls=[];
  for(const patch of patches){
   const toward=projector.position.map((n,i)=>n-patch.point[i]),length=Math.hypot(...toward);
   if(patch.normal.reduce((s,n,i)=>s+n*toward[i]/length,0)<Math.cos(S.maximumEmissionDegrees*Math.PI/180))continue;
   const visible=patch.points.every(p=>{const delta=p.map((n,i)=>n-projector.position[i]),distance=Math.hypot(...delta),hit=mesh.intersect(projector.position,delta.map(n=>n/distance));return hit&&Math.abs(hit.radius-distance)<S.maximumSourceMeshVisibilityResidualMeters;});
   if(!visible)continue;
   const xy=patch.points.map(p=>projector.project(p));if(xy.some(v=>!v))continue;
   // Any point without a sample fails the offset, so the walk stops at the first; the rest fill one reused array in patch order.
   const shifted=new Array<number>(xy.length);
   const score=(dx:number,dy:number)=>{for(let i=0;i<xy.length;i++){const p=xy[i]!,value=sample(image,targetDetail,p[0]+dx,p[1]+dy,image.data);if(value===null)return -1;shifted[i]=value;}return ncc(patch.values,shifted);};
   let best=-1,bx=0,by=0;
   for(let dy=origin[1]-search;dy<=origin[1]+search;dy++)for(let dx=origin[0]-search;dx<=origin[0]+search;dx++){const s=score(dx,dy);if(s>best){best=s;bx=dx;by=dy;}}
   if(best<C.minimumCorrelation||Math.abs(bx-origin[0])===search||Math.abs(by-origin[1])===search)continue;
   const separatedPeak=Math.max(...[-3,0,3].flatMap(dx=>[-3,0,3].filter(dy=>dx!==0||dy!==0).map(dy=>score(bx+dx,by+dy))));
   if(best-separatedPeak<C.minimumSeparatedPeakMargin)continue;
   if(2*best-score(bx-1,by)-score(bx+1,by)<C.minimumPeakCurvature||2*best-score(bx,by-1)-score(bx,by+1)<C.minimumPeakCurvature)continue;
   const peak=(a:number,b:number,c:number)=>{const d=a-2*b+c;return Math.abs(d)>1e-8?Math.max(-.75,Math.min(.75,.5*(a-c)/d)):0;};
   const dx=bx+peak(score(bx-1,by),best,score(bx+1,by)),dy=by+peak(score(bx,by-1),best,score(bx,by+1));
   const p=projector.project(patch.point);if(!p)continue;
   controls.push({partition:patch.partition,referencePixel:patch.pixel,pointMeters:patch.point,predictedPixel:p,measuredPixel:[p[0]+dx,p[1]+dy],offset:[dx,dy],correlation:best});
  }
  const fit=controls.filter(c=>c.partition==='fit');
  if(fit.length<C.minimumFitControls){reports.push({filter:target.filter,id:frame.id,accepted:false,reason:'Insufficient independent feature patches',controls:controls.length,patches:patches.length});continue;}
  const normal=Array.from({length:3},()=>[0,0,0]),rhs=[0,0,0];
  for(const c of fit){const [x,y]=c.predictedPixel.map((n,i)=>n-center[i]);for(const [r,value] of [[[1,0,-y],c.offset[0]],[[0,1,x],c.offset[1]]] as const){for(let i=0;i<3;i++){rhs[i]+=r[i]*value;for(let j=0;j<3;j++)normal[i][j]+=r[i]*r[j];}}}
  const [dx,dy,roll]=checkOnly?[0,0,0]:solve(normal,rhs),corrected={...frame,center:[center[0]+dx,center[1]+dy],northAzimuthDegrees:northAzimuthDegrees+roll*180/Math.PI};
  const accepted=camera(corrected);
  const residuals=controls.map(c=>{const projected=accepted.project(c.pointMeters);if(!projected)throw new Error(`Registered control leaves the detector: ${frame.id}`);return {...c,residualPixels:Math.hypot(...projected.map((n,i)=>n-c.measuredPixel[i]))};});
  const stats=(partition:'fit'|'holdout')=>{const cs=residuals.filter(c=>c.partition===partition);return {count:cs.length,rmsPixels:Math.sqrt(cs.reduce((s,c)=>s+c.residualPixels**2,0)/cs.length),maximumPixels:Math.max(...cs.map(c=>c.residualPixels))};};
  const holdout=stats('holdout');
  reports.push({filter:target.filter,id:frame.id,accepted:holdout.count>=C.minimumHoldoutControls&&holdout.rmsPixels<=C.maximumHoldoutRmsPixels&&holdout.maximumPixels<=C.maximumHoldoutResidualPixels,
   seedCamera:frame,correctedCamera:corrected,fit:stats('fit'),holdout,reference:{id:reference.frame.id,sha256:reference.sha256},targetSha256:target.sha256,controls:residuals});
 }
 return {patchGridStepPixels:step,patches:patches.length,searchRadiusPixels,reports};
}
