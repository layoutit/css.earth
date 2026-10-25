/** Canonical positive three-dimensional objects. Density has no observer or image input. */
import {dot,add,mul,normalize,cross,type V3} from './geometry.mts';
import {need} from './inputs.mts';
export type Component=0|1|2|3|4;
export interface VolumeObject {id:string;owner:string;kind:'ball'|'shell'|'filament'|'dust';component:Component;center:V3;basis:[V3,V3,V3];axes:V3;inner:number;color:V3;weight:number;source:string;halfSpace?:V3;}
export interface Chord {center:number;half:number;q:number;a:number;normalization:number;clipLo:number;clipHi:number;}
export function volumeObject(v:VolumeObject):VolumeObject {
 need(v.axes.every(a=>Number.isFinite(a)&&a>0)&&v.center.every(Number.isFinite)&&v.weight>=0&&Number.isFinite(v.weight),'Invalid finite object');
 for(let k=0;k<3;k++){need(Math.abs(dot(v.basis[k],v.basis[k])-1)<1e-6,'Object basis is not normalized');for(let j=0;j<k;j++)need(Math.abs(dot(v.basis[k],v.basis[j]))<1e-6,'Object basis is not orthogonal');}
 need(v.kind!=='shell'||v.inner>0&&v.inner<1,'Invalid hollow-shell wall');return v;
}
export function density(v:VolumeObject,p:V3):number {
 const delta=add(p,mul(v.center,-1));if(v.halfSpace&&dot(delta,v.halfSpace)>0)return 0;let q=0;for(let k=0;k<3;k++)q+=(dot(delta,v.basis[k])/v.axes[k])**2;if(q>=1)return 0;
 const product=v.axes[0]*v.axes[1]*v.axes[2];
 return v.kind==='shell'?(q<v.inner*v.inner?0:(v.halfSpace?2:1)*3/(4*Math.PI*product*(1-v.inner**3))):105/(32*Math.PI*product)*(1-q)**2;
}
export function chord(v:VolumeObject,origin:V3,direction:V3):Chord|null {
 const delta=add(origin,mul(v.center,-1));let a=0,b=0,c=0;
 for(let k=0;k<3;k++){const o=dot(delta,v.basis[k])/v.axes[k],d=dot(direction,v.basis[k])/v.axes[k];a+=d*d;b+=o*d;c+=o*o;}
 const q=c-b*b/a;if(q>=1)return null;const product=v.axes[0]*v.axes[1]*v.axes[2],center=-b/a,half=Math.sqrt(Math.max(0,1-q)/a);let clipLo=-half,clipHi=half;
 if(v.halfSpace){const u=dot(direction,v.halfSpace),o=dot(delta,v.halfSpace);if(Math.abs(u)<1e-12){if(o>0)return null;}else{const t=-o/u-center;if(u>0)clipHi=Math.min(clipHi,t);else clipLo=Math.max(clipLo,t);}if(clipHi<=clipLo)return null;}
 return {center,half,q,a,clipLo,clipHi,normalization:v.kind==='shell'?(v.halfSpace?2:1)*3/(4*Math.PI*product*(1-v.inner**3)):105/(32*Math.PI*product)};
}
function primitive(t:number,a:number,u:number):number{return u*u*t-2*u*a*t**3/3+a*a*t**5/5;}
export function columnTo(v:VolumeObject,c:Chord,t:number):number {
 const x=Math.max(-c.half,Math.min(c.half,t-c.center));
 if(v.kind==='shell'){
  let length=0;for(const [lo,hi]of shellIntervals(v,c))length+=Math.max(0,Math.min(hi,x)-lo);return length*c.normalization;
 }
 return Math.max(0,(primitive(x,c.a,1-c.q)-primitive(-c.half,c.a,1-c.q))*c.normalization);
}
export function column(v:VolumeObject,c:Chord):number{return columnTo(v,c,c.center+c.half);}
function shellIntervals(v:VolumeObject,c:Chord):[number,number][]{const h=c.q<v.inner*v.inner?Math.sqrt((v.inner*v.inner-c.q)/c.a):0;return [[Math.max(-c.half,c.clipLo),Math.min(-h,c.clipHi)],[Math.max(h,c.clipLo),Math.min(c.half,c.clipHi)]].filter((p):p is [number,number]=>p[1]>p[0]);}
/** Positive quadrature along the real volume chord, with both walls of hollow shells. */
export function emissionNodes(v:VolumeObject,c:Chord):{t:number;fraction:number}[] {
 if(v.kind!=='shell'){const d=c.half/Math.sqrt(3);return[{t:c.center-d,fraction:3/14},{t:c.center,fraction:4/7},{t:c.center+d,fraction:3/14}];}
 const intervals=shellIntervals(v,c),total=intervals.reduce((a,p)=>a+p[1]-p[0],0);return intervals.flatMap(([lo,hi])=>[-1,1].map(q=>({t:c.center+(lo+hi)/2+q*(hi-lo)/(2*Math.sqrt(3)),fraction:(hi-lo)/(2*total)})));
}
export function planarBasis(angle:number):[V3,V3,V3]{return[[Math.cos(angle),Math.sin(angle),0],[-Math.sin(angle),Math.cos(angle),0],[0,0,1]];}
export function tube(id:string,owner:string,start:V3,end:V3,radius:number,color:V3,weight:number,source:string):VolumeObject {
 const delta=add(end,mul(start,-1)),u=normalize(delta),v=normalize(cross(u,Math.abs(u[2])<.9?[0,0,1]:[1,0,0])),w=cross(u,v);
 return volumeObject({id,owner,kind:'filament',component:4,center:mul(add(start,end),.5),basis:[u,v,w],axes:[Math.hypot(...delta)/2+radius,radius,radius],inner:0,color,weight,source});
}
