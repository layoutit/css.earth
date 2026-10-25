/** Measured regional colors are attached to the existing populations in body coordinates. */
import {readFile,writeFile} from 'node:fs/promises';
import {at,json,rec,num,need,type Raster} from '../inputs.mts';
import {EXTINCTION_RGB,FOREGROUND_EBV} from '../model.mts';
export interface PhotometryMaterial {old:[Raster,Raster];bar:[Raster,Raster];}
export function materialFactor(m:PhotometryMaterial|undefined,component:number,c:number,x:number,y:number):number {
 if(!m||component>2||c===1)return 1;const map=(component===1?m.bar:m.old)[c===0?0:1];return Math.exp(at(map,x,y));
}
const erf=(x:number)=>{const sign=Math.sign(x),a=Math.abs(x),t=1/(1+.3275911*a);return sign*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-a*a));};
/** Conditional dereddening under the unchanged mixed-layer prior, not a depth measurement. */
export function transmission(tau:number,sigma:number,channel:number){let sum=0,weight=0;for(let k=-40;k<=40;k++){const z=k*sigma/8,w=Math.exp(-.5*(z/sigma)**2),column=tau/.8999*.5*(1-erf(z/(.25*Math.SQRT2)));sum+=w*Math.exp(-(column+FOREGROUND_EBV*3.41/1.0857362047581296)*EXTINCTION_RGB[channel]);weight+=w;}return sum/weight;}
export async function saveMaterial(directory:string,m:PhotometryMaterial,metadata:Record<string,unknown>){for(const [kind,maps] of Object.entries(m))for(let c=0;c<2;c++)await writeFile(directory+`mcps-${kind}-${c}.f32le`,Buffer.from(maps[c].values.buffer));await writeFile(directory+'mcps-material.json',JSON.stringify({...metadata,n:m.old[0].n,halfKpc:m.old[0].half,units:'Natural log of intrinsic regional R/G and B/G, divided by the population-wide mean. G and all density fields are unchanged.'},null,2)+'\n');}
export async function loadMaterial(directory:string):Promise<PhotometryMaterial>{const r=rec(await json(directory+'mcps-material.json')),n=num(r.n),half=num(r.halfKpc);need(Number.isSafeInteger(n)&&n>1&&n<=1024&&half>0,'Invalid MCPS color grid');const load=async(kind:string,c:number)=>{const b=await readFile(directory+`mcps-${kind}-${c}.f32le`);need(b.length===n*n*4,'Invalid MCPS field length');const values=new Float32Array(Uint8Array.from(b).buffer);need(values.every(v=>Number.isFinite(v)&&Math.abs(v)<5),'Invalid MCPS material value');return{n,half,values,mask:new Uint8Array(n*n).fill(1)};};return{old:[await load('old',0),await load('old',1)],bar:[await load('bar',0),await load('bar',1)]};}
