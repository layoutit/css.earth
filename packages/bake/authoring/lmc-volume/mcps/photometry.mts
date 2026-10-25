/** Regional flux photometry. No image pixels or population spectra enter these estimates. */
import {readFile} from 'node:fs/promises';
import {need} from '../inputs.mts';
import {flux,type McpsStar} from './input.mts';
export const ZERO_JY=[1438.73,4323.91,3617.50,2452.02] as const;
export const RGB_WAVELENGTHS=[.65,.55,.44] as const;
export function bvi(s:McpsStar):[number,number,number]|null {
 const [b,v,i]=s.magnitudes.slice(1),[eb,ev,ei]=s.errors.slice(1);
 if(b===null||v===null||i===null||eb===null||ev===null||ei===null||Math.max(eb,ev,ei)>.15||v<13.5||v>=20||b-v<-.5||b-v>2.5||v-i<-.5||v-i>3)return null;
 return[b,v,i];
}
/** F_nu proxies: B, V and interpolation between V and Cousins I. They are not camera RGB. */
export function bandRgb(b:number,v:number,i:number):[number,number,number]{const B=ZERO_JY[1]*flux(b),V=ZERO_JY[2]*flux(v),I=ZERO_JY[3]*flux(i),f=Math.log(.65/.546757)/Math.log(.782865/.546757);return[Math.exp(Math.log(V)*(1-f)+Math.log(I)*f),V,B];}
export function addMeasuredFlux(grids:readonly(Float32Array|Float64Array)[],index:number,m:readonly[number,number,number],weight:number){const rgb=bandRgb(...m);for(let c=0;c<3;c++)grids[c][index]+=rgb[c]*weight;return rgb;}
export interface LfEstimate {ratioVI:[number,number];referenceVI:[number,number];faintVI:[number,number];tailVI:[number,number];accepted:number;completeness:number[];}
/** Artificial-star recovery uses the same flag, error and crowding cuts as the measured list. */
export async function hstLf(directory:string,kind:'bar'|'disc'):Promise<LfEstimate>{
 const good=(flag:number,v:number,ev:number,cv:number,i:number,ei:number,ci:number)=>flag===0&&v>15&&v<27&&i>14&&i<28&&ev<.2&&ei<.2&&cv<.3&&ci<.3;
 const input=Array(28).fill(0),recovered=Array(28).fill(0);
 for(const line of (await readFile(directory+`hst-${kind}.comp`,'utf8')).split('\n')){if(!line||line[0]==='#')continue;const x=line.trim().split(/\s+/u).map(Number);need(x.length===15&&x.every(Number.isFinite),'Unexpected HST artificial-star format');const v=x[13],i=x[14],bin=Math.floor(v*2)-30;if(bin<0||bin>=28||i<14||i>28)continue;input[bin]++;if(x[1]===0&&x[3]<.2&&x[5]<.2&&Math.abs(x[2]-x[9])<.5&&Math.abs(x[4]-x[10])<.5&&Math.abs(x[11])<.5&&Math.abs(x[12])<.5)recovered[bin]++;}
 const completeness=input.map((n,k)=>n?recovered[k]/n:0),reference=[0,0],faint=[0,0],tail=[0,0],preceding=[0,0],limit=kind==='bar'?25:26;let accepted=0;
 for(const line of (await readFile(directory+`hst-${kind}.ubvri.out`,'utf8')).split('\n')){if(!line||line[0]==='#')continue;const x=line.trim().split(/\s+/u),n=x.slice(0,14).map(Number);need(n.length===14&&n.every(Number.isFinite),'Unexpected HST photometry format');const [flag,v,ev,cv,i,ei,ci]=n,bin=Math.floor(v*2)-30,p=completeness[bin];if(!good(flag,v,ev,cv,i,ei,ci)||v>=limit||p<.5)continue;accepted++;const f=[flux(v)/p,flux(i)/p];if(v>=18.5&&v<20)for(let c=0;c<2;c++)reference[c]+=f[c];if(v>=20){for(let c=0;c<2;c++)faint[c]+=f[c];if(v>=limit-1)for(let c=0;c<2;c++)tail[c]+=f[c];else if(v>=limit-2)for(let c=0;c<2;c++)preceding[c]+=f[c];}}
 need(accepted>100&&reference[0]>0&&faint[0]>0,'No qualified empirical HST luminosity function');
 // Extrapolate the last two one-magnitude bins geometrically. The extrapolation is an assumption.
 const extrapolate=(c:number)=>{const q=Math.max(.2,Math.min(.8,tail[c]/Math.max(1e-12,preceding[c])));return tail[c]*q/(1-q);},tailVI:[number,number]=[extrapolate(0),extrapolate(1)],faintVI:[number,number]=[faint[0]+tailVI[0],faint[1]+tailVI[1]];
 return{ratioVI:[faintVI[0]/reference[0],faintVI[1]/reference[1]],referenceVI:[reference[0],reference[1]],faintVI,tailVI,accepted,completeness};
}
export function addUnresolved(resolved:readonly number[],referenceV:number,referenceI:number,lf:LfEstimate,bvOfVi:(vi:number)=>number):number[]{need(resolved.length===3&&referenceV>=0&&referenceI>=0&&lf.ratioVI.every(v=>Number.isFinite(v)&&v>=0),'Invalid unresolved-light budget');if(referenceV===0||referenceI===0||lf.ratioVI.every(v=>v===0))return [...resolved];const v=referenceV*lf.ratioVI[0],i=referenceI*lf.ratioVI[1];need(v>0&&i>0,'Missing one unresolved band');const vi=-2.5*Math.log10(v/ZERO_JY[2]/(i/ZERO_JY[3])),color=bandRgb(20+bvOfVi(vi),20,20-vi);return resolved.map((x,c)=>x+v*color[c]/color[1]);}
