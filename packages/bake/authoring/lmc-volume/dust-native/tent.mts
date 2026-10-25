/** Compact 3D linear-interpolation kernels for the released HERITAGE pixels. */
import {add,mul,dot,type V3} from '../geometry.mts';
import type {VolumeObject,Chord} from '../catalogue-volume.mts';
export interface TentSegment {lo:number;hi:number;start:number;coeff:number[];}
export interface TentIntegral {segments:TentSegment[];total:number;}
function primitive(c:number[],x:number){return x*(c[0]+x*(c[1]/2+x*(c[2]/3+x*c[3]/4)));}
export function tentDensity(v:VolumeObject,p:V3){const d=add(p,mul(v.center,-1));let value=1;for(let k=0;k<3;k++)value*=Math.max(0,1-Math.abs(dot(d,v.basis[k])/v.axes[k]))/v.axes[k];return value;}
export function tentChord(v:VolumeObject,origin:V3,direction:V3):Chord|null {
 const delta=add(origin,mul(v.center,-1)),o=v.basis.map((b,k)=>dot(delta,b)/v.axes[k]),d=v.basis.map((b,k)=>dot(direction,b)/v.axes[k]);
 let lo=-Infinity,hi=Infinity;
 for(let k=0;k<3;k++){
  if(Math.abs(d[k])<1e-12){if(Math.abs(o[k])>=1)return null;continue;}
  const a=(-1-o[k])/d[k],b=(1-o[k])/d[k];lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
 }
 if(hi<=lo)return null;
 const breaks=[lo,hi];for(let k=0;k<3;k++)if(Math.abs(d[k])>1e-12){const t=-o[k]/d[k];if(t>lo&&t<hi)breaks.push(t);}breaks.sort((a,b)=>a-b);
 const segments:TentSegment[]=[];let total=0;
 for(let j=1;j<breaks.length;j++){
  const a=breaks[j-1],b=breaks[j];if(b-a<1e-12)continue;let coeff=[1,0,0,0];
  for(let k=0;k<3;k++){const sign=Math.sign(o[k]+d[k]*(a+b)/2),u=1-sign*(o[k]+d[k]*a),w=-sign*d[k],next=[0,0,0,0];for(let c=0;c<4;c++){next[c]+=coeff[c]*u;if(c<3)next[c+1]+=coeff[c]*w;}coeff=next;}
  coeff=coeff.map(x=>x/(v.axes[0]*v.axes[1]*v.axes[2]));segments.push({lo:a,hi:b,start:total,coeff});total+=Math.max(0,primitive(coeff,b-a));
 }
 if(!segments.length||!(total>0))return null;
 return{center:(lo+hi)/2,half:(hi-lo)/2,q:0,a:1,normalization:1,clipLo:lo,clipHi:hi,tent:{segments,total}};
}
export function tentColumnTo(c:Chord,t:number){const f=c.tent;if(!f)return 0;if(t<=f.segments[0].lo)return 0;if(t>=f.segments.at(-1)!.hi)return f.total;for(const s of f.segments)if(t<=s.hi)return Math.max(0,Math.min(f.total,s.start+primitive(s.coeff,Math.max(0,t-s.lo))));return f.total;}
