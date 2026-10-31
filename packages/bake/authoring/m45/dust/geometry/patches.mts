import {type Vec} from '../physics/types.mts';

export interface Cell {id:string;center:Vec;half:Vec;kind:'core'|'surround';x:number;y:number;z:number}
export interface Axes {back:Vec;right:Vec;down:Vec}
export interface PatchBounds {u0:number;v0:number;u1:number;v1:number}
export interface Ray {eye:Vec;direction:Vec}
export interface Box {min:Vec;max:Vec}
export interface ReferenceProjection {
 cell:Cell;bakeEye:Vec;eye:Vec;spanPc:number;insideCellConeApproximation:boolean;
 bakedBack:Vec;bakedRight:Vec;bakedDown:Vec;cameraBack:Vec;cameraRight:Vec;cameraDown:Vec;
 /** Existing CSS matrix(a,b,c,d), not an added perspective warp. */
 basisM:readonly[number,number,number,number];cellCameraDepthPc:number;
 bakeRay(u:number,v:number):Ray;displayRay(u:number,v:number):Ray;
 /** Affine display coordinates on the camera plane at the old cell-center depth. */
 displayPlaneXY(u:number,v:number):readonly[number,number];
}
export interface FixedPatch {
 position:Vec;diameterPc:number;axisTowardReference:Vec;bounds:PatchBounds;sourceCenterUv:readonly[number,number];
 /** Destination UVs for statically prewarping the original RGBA patch, TL/TR/BR/BL. */
 quadUv:readonly(readonly[number,number])[];cameraPlaneCorners:readonly Vec[];
 cameraDepthPc:number;densityMeanPhysicalPosition:Vec;densityAtRepresentativePoint:number;
 densityColumnIntegral:number;densityWeightedCameraDepth16Pc:number;densityWeightedCameraDepth84Pc:number;
 cameraDepthSigmaPc:number;integratedSamples:number;contributingRays:number;sampledRays:number;
 metadata:Record<string,unknown>;
}
export const EARTH_AXES:Axes={back:[0,0,-1],right:[0,1,0],down:[-1,0,0]};
const finite=(v:number):number=>{if(!Number.isFinite(v))throw new RangeError('Nonfinite geometry/photometry');return v;};
const positive=(v:number):number=>{if(!(finite(v)>0))throw new RangeError('Expected positive value');return v;};
const vector=(v:readonly number[]):Vec=>{if(v.length!==3)throw new RangeError('Expected XYZ');return [finite(v[0]!),finite(v[1]!),finite(v[2]!)];};
const add=(a:Vec,b:Vec):Vec=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub=(a:Vec,b:Vec):Vec=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale=(a:Vec,k:number):Vec=>[a[0]*k,a[1]*k,a[2]*k],dot=(a:Vec,b:Vec)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec,b:Vec):Vec=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(v:Vec):Vec=>scale(v,1/positive(Math.hypot(...v)));
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
function validateAxes(a:Axes):void{for(const v of [a.back,a.right,a.down])if(Math.abs(Math.hypot(...vector(v))-1)>1e-8)throw new RangeError('Camera/frame axes must be unit vectors');if(Math.abs(dot(a.back,a.right))>1e-8||Math.abs(dot(a.back,a.down))>1e-8||Math.abs(dot(a.right,a.down))>1e-8||dot(cross(a.right,a.back),a.down)<1-1e-8)throw new RangeError('Camera/frame basis must be orthonormal and right-handed');}
function validateBounds(b:PatchBounds):void{if(![b.u0,b.v0,b.u1,b.v1].every(Number.isFinite)||b.u0<0||b.v0<0||b.u1>1||b.v1>1||b.u0>=b.u1||b.v0>=b.v1)throw new RangeError('Patch bounds must be nonempty normalized source coordinates');}
function validateCell(c:Cell):void{vector(c.center);vector(c.half).forEach(positive);if((c.kind!=='core'&&c.kind!=='surround')||![0,1].includes(c.x)||![0,1].includes(c.y)||!Number.isSafeInteger(c.z)||c.z<0||c.z>(c.kind==='core'?2:0))throw new RangeError('Invalid Pleiades cell');}
export function cloudCells():Cell[]{const cells:Cell[]=[];for(let z=0;z<3;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++)cells.push({id:`core-${x}-${y}-${z}`,kind:'core',x,y,z,center:[x?1.5:-1.5,y?1.5:-1.5,[-3,0,3][z]!],half:[2,2,[2.3,1.3,2.3][z]!]});for(let y=0;y<2;y++)for(let x=0;x<2;x++)cells.push({id:`surround-${x}-${y}`,kind:'surround',x,y,z:0,center:[x?6:-6,y?6:-6,-2],half:[7.2,7.2,14]});return cells;}
/** Exact Pleiades contribution partition; ray integration additionally clips to the cell box. */
export function cellPart(cell:Cell,x:number,y:number,z:number):number{const sx=smooth((x+.3)/.6),sy=smooth((y+.3)/.6),cw=smooth((3.5-Math.abs(x))/.75)*smooth((3.5-Math.abs(y))/.75)*smooth((z+5.3)/.6)*smooth((5.3-z)/.6),wx=cell.x?sx:1-sx,wy=cell.y?sy:1-sy;if(cell.kind==='surround')return(1-cw)*wx*wy;const first=1-smooth((z+1.3)/.6),last=smooth((z-.7)/.6),wz=cell.z===0?first:cell.z===2?last:1-first-last;return cw*wx*wy*Math.max(0,wz);}
export function cellBox(cell:Cell):Box{return {min:sub(cell.center,cell.half),max:add(cell.center,cell.half)};}
export function patchPlan(coreDivisions=3,surroundDivisions=2):{id:string;cell:Cell;bounds:PatchBounds}[]{for(const d of [coreDivisions,surroundDivisions])if(!Number.isSafeInteger(d)||d<1)throw new RangeError('Patch division count must be a positive integer');return cloudCells().flatMap(cell=>{const n=cell.kind==='core'?coreDivisions:surroundDivisions,out:{id:string;cell:Cell;bounds:PatchBounds}[]=[];for(let y=0;y<n;y++)for(let x=0;x<n;x++)out.push({id:`${cell.id}-patch-${x}-${y}`,cell,bounds:{u0:x/n,v0:y/n,u1:(x+1)/n,v1:(y+1)/n}});return out;});}
/** Same shortest-arc transport and antipodal half-turn as the existing Pleiades bake/runtime. */
export function transported(v:Vec,from:Vec,to:Vec,opposite:Vec):Vec{const a=cross(from,to),first=cross(a,v),second=cross(a,first),divisor=1+dot(from,to);if(divisor<1e-10){const s=2*dot(v,opposite);return[opposite[0]*s-v[0],opposite[1]*s-v[1],opposite[2]*s-v[2]];}return[v[0]+first[0]+second[0]/divisor,v[1]+first[1]+second[1]/divisor,v[2]+first[2]+second[2]/divisor];}
export function rayBox(ray:Ray,box:Box):readonly[number,number]|null{let low=0,high=Infinity;for(let a=0;a<3;a++){const min=finite(box.min[a]!),max=finite(box.max[a]!);if(!(max>min))throw new RangeError('Empty box');const d=finite(ray.direction[a]!),eye=finite(ray.eye[a]!);if(Math.abs(d)<1e-15){if(eye<min||eye>max)return null;}else{const u=(min-eye)/d,v=(max-eye)/d;low=Math.max(low,Math.min(u,v));high=Math.min(high,Math.max(u,v));}}return high>low?[low,high]:null;}
/** camera is the ACTUAL reference camera basis, supplied by the caller. frameAxes is
 * the baked Pleiades Earth frame. cameraEye may differ from the stored Pleiades bake station. */
export function referenceProjection(cell:Cell,bakeEye:Vec,camera:Axes=EARTH_AXES,options:{frameAxes?:Axes;cameraEye?:Vec;spanPc?:number}={}):ReferenceProjection{
 validateCell(cell);validateAxes(camera);const frame=options.frameAxes??EARTH_AXES;validateAxes(frame);bakeEye=vector(bakeEye);const eye=vector(options.cameraEye??bakeEye),back=unit(sub(bakeEye,cell.center)),right=transported(frame.right,frame.back,back,frame.right),down=transported(frame.down,frame.back,back,frame.right),distance=Math.hypot(...sub(bakeEye,cell.center));let span=0,inside=false;
 for(let k=0;k<8;k++){const delta:Vec=[cell.center[0]+(k&1?1:-1)*cell.half[0]-bakeEye[0],cell.center[1]+(k&2?1:-1)*cell.half[1]-bakeEye[1],cell.center[2]+(k&4?1:-1)*cell.half[2]-bakeEye[2]],depth=-dot(delta,back);if(depth<=1e-5){inside=true;break;}span=Math.max(span,2*Math.abs(dot(delta,right))*distance/depth,2*Math.abs(dot(delta,down))*distance/depth);}
 if(inside)span=2*distance*Math.tan(80*Math.PI/180);span*=1.02;if(options.spanPc!==undefined)span=positive(options.spanPc);positive(span);
 const displayBack=unit(sub(eye,cell.center)),displayRight=transported(frame.right,frame.back,displayBack,frame.right),displayDown=transported(frame.down,frame.back,displayBack,frame.right),basisM=[dot(displayRight,camera.right),dot(displayRight,camera.down),dot(displayDown,camera.right),dot(displayDown,camera.down)] as const,centerDelta=sub(cell.center,eye),cellCameraDepthPc=positive(-dot(centerDelta,camera.back)),cx=dot(centerDelta,camera.right),cy=dot(centerDelta,camera.down);
 const displayPlaneXY=(u:number,v:number):readonly[number,number]=>[cx+span*((finite(u)-.5)*basisM[0]+(finite(v)-.5)*basisM[2]),cy+span*((u-.5)*basisM[1]+(v-.5)*basisM[3])];
 return {cell,bakeEye,eye,spanPc:span,insideCellConeApproximation:inside,bakedBack:back,bakedRight:right,bakedDown:down,cameraBack:[...camera.back],cameraRight:[...camera.right],cameraDown:[...camera.down],basisM,cellCameraDepthPc,displayPlaneXY,bakeRay:(u,v)=>({eye:bakeEye,direction:unit(sub(add(add(cell.center,scale(right,(finite(u)-.5)*span)),scale(down,(finite(v)-.5)*span)),bakeEye))}),displayRay:(u,v)=>{const[x,y]=displayPlaneXY(u,v);return {eye,direction:unit(add(add(scale(camera.right,x),scale(camera.down,y)),scale(camera.back,-cellCameraDepthPc)))};}};
}
interface DepthSample {depth:number;weight:number}
function weightedQuantile(samples:readonly DepthSample[],fraction:number,total:number):number{const sorted=[...samples].sort((a,b)=>a.depth-b.depth);let sum=0;for(const s of sorted){sum+=s.weight;if(sum>=fraction*total)return s.depth;}return sorted.at(-1)!.depth;}
/** Generic integrator also usable by the far-slab owner, with an explicit density
 * function and optional original sampling rays. Empty sampled support has no fallback. */
export function derivePatchFromDensity(density:(x:number,y:number,z:number)=>number,box:Box,projection:ReferenceProjection,bounds:PatchBounds,options:{raysPerAxis?:number;maxStepPc?:number;samplingRay?:(u:number,v:number)=>Ray;centerMode?:'bounds'|'weighted';weightAtUv?:(u:number,v:number)=>number}={}):FixedPatch|null{
 validateBounds(bounds);const n=options.raysPerAxis??5,step=positive(options.maxStepPc??.04);if(!Number.isSafeInteger(n)||n<1||n>31)throw new RangeError('Invalid stratified ray count');const samples:DepthSample[]=[];let total=0,depthSum=0,depth2Sum=0,weightedU=0,weightedV=0,pointSum:Vec=[0,0,0],integratedSamples=0,contributingRays=0;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const u=bounds.u0+(x+.5)/n*(bounds.u1-bounds.u0),v=bounds.v0+(y+.5)/n*(bounds.v1-bounds.v0),ray=(options.samplingRay??projection.bakeRay)(u,v);if(Math.abs(Math.hypot(...ray.direction)-1)>1e-8)throw new RangeError('Sampling ray must have a unit direction');const segment=rayBox(ray,box);if(!segment)continue;const count=Math.ceil((segment[1]-segment[0])/step),ds=(segment[1]-segment[0])/count;let rayWeight=0;
  for(let k=0;k<count;k++){const distance=segment[0]+(k+.5)*ds,p=add(ray.eye,scale(ray.direction,distance)),rho=finite(density(...p));if(rho<0)throw new RangeError('Negative density');integratedSamples++;if(rho===0)continue;const window=options.weightAtUv?.(u,v)??1;if(!(finite(window)>=0))throw new RangeError('Negative spatial partition');const weight=rho*ds*window/(n*n),depth=-dot(sub(p,projection.eye),projection.cameraBack);if(!(depth>0))throw new RangeError('Positive density lies behind the reference camera; use a separate far-volume placement');total+=weight;rayWeight+=weight;weightedU+=weight*u;weightedV+=weight*v;depthSum+=weight*depth;depth2Sum+=weight*depth*depth;pointSum=add(pointSum,scale(p,weight));samples.push({depth,weight});}
  if(rayWeight>0)contributingRays++;
 }
 if(total===0)return null;
 const depth=depthSum/total,uc=options.centerMode==='weighted'?weightedU/total:(bounds.u0+bounds.u1)/2,vc=options.centerMode==='weighted'?weightedV/total:(bounds.v0+bounds.v1)/2,[cx,cy]=projection.displayPlaneXY(uc,vc),depthScale=depth/projection.cellCameraDepthPc;
 const pointOnPlane=(x:number,y:number):Vec=>add(projection.eye,add(add(scale(projection.cameraRight,x),scale(projection.cameraDown,y)),scale(projection.cameraBack,-depth)));
 const position=pointOnPlane(cx*depthScale,cy*depthScale),sourceCorners=[[bounds.u0,bounds.v0],[bounds.u1,bounds.v0],[bounds.u1,bounds.v1],[bounds.u0,bounds.v1]] as const,cornersXY=sourceCorners.map(([u,v])=>{const[x,y]=projection.displayPlaneXY(u,v);return [(x-cx)*depthScale,(y-cy)*depthScale] as const;}),diameter=2*Math.max(...cornersXY.flatMap(p=>[Math.abs(p[0]),Math.abs(p[1])]));positive(diameter);
 const axis=unit(sub(projection.eye,position)),centerRay=projection.displayRay(uc,vc);if(dot(unit(sub(position,projection.eye)),centerRay.direction)<1-1e-12)throw new Error('Fixed patch moved off its original displayed center ray');
 return {position,diameterPc:diameter,axisTowardReference:axis,bounds:{...bounds},sourceCenterUv:[uc,vc],quadUv:cornersXY.map(([x,y])=>[.5+x/diameter,.5+y/diameter] as const),cameraPlaneCorners:cornersXY.map(([x,y])=>pointOnPlane(cx*depthScale+x,cy*depthScale+y)),cameraDepthPc:depth,densityMeanPhysicalPosition:scale(pointSum,1/total),densityAtRepresentativePoint:finite(density(...position)),densityColumnIntegral:total,densityWeightedCameraDepth16Pc:weightedQuantile(samples,.16,total),densityWeightedCameraDepth84Pc:weightedQuantile(samples,.84,total),cameraDepthSigmaPc:Math.sqrt(Math.max(0,depth2Sum/total-depth*depth)),integratedSamples,contributingRays,sampledRays:n*n,metadata:{centerMode:options.centerMode??'bounds',method:'Caller optical-weight first moment of the original Pleiades sampling rays; representative center placed on its original affine displayed Earth ray',raysPerAxis:n,maxStepPc:step,densityModified:false,depthScatterAdded:false,sourceDensityDependency:'caller density only; no image pixels',sourceProjection:'Original Pleiades cell basis/span and affine CSS matrix; static prewarp must preserve full RGBA',referenceSize:'diameter/cameraDepth and all four corner screen coordinates preserved after prewarp',limitations:['The representative point is a finite-volume billboard centroid, not a measured dust particle or resolved physical thickness.','Column weighting uses equal original texture-area strata, not a recovered physical-volume mass centroid.','A centroid can lie in a cavity or between density peaks; it is not moved by eye to fill a void.','Different cell centroids can interleave the old source-over order; inspect the complete reference composite.','Rotation gives fixed-position parallax, but a camera-facing patch remains a finite-volume approximation.','Sampled empty support returnsnull; the caller must not silently discard a visibly nonempty source patch.']}};
}
