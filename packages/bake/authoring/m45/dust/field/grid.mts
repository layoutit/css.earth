import {readFile} from 'node:fs/promises';
import {requireArray,requireFiniteNumber,requireRecord} from '@cssearth/core';
import type {Vec} from '../physics/types.mts';

export interface Grid {min:Vec;max:Vec;shape:Vec;channels:number;data:Float32Array}
export const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
export function vector(v:unknown):Vec {const a=requireArray(v).map(n=>requireFiniteNumber(n));if(a.length!==3)throw Error('Expected XYZ');return[a[0]!,a[1]!,a[2]!];}
export async function json(path:string):Promise<Record<string,unknown>> {return requireRecord(JSON.parse(await readFile(path,'utf8')));}
export async function f32(path:string):Promise<Float32Array>{const b=await readFile(path);if(b.length%4)throw Error('F32 byte count');return Float32Array.from({length:b.length/4},(_,i)=>b.readFloatLE(i*4));}
export function grid(min:Vec,max:Vec,shape:Vec,channels=1):Grid {return{min,max,shape,channels,data:new Float32Array(shape[0]*shape[1]*shape[2]*channels)};}
export function position(g:Grid,ix:number,iy:number,iz:number):Vec {return [g.min[0]+ix/(g.shape[0]-1)*(g.max[0]-g.min[0]),g.min[1]+iy/(g.shape[1]-1)*(g.max[1]-g.min[1]),g.min[2]+iz/(g.shape[2]-1)*(g.max[2]-g.min[2])];}
export function sample(g:Grid,x:number,y:number,z:number,out:Float64Array):void {
  const fx=(x-g.min[0])/(g.max[0]-g.min[0])*(g.shape[0]-1),fy=(y-g.min[1])/(g.max[1]-g.min[1])*(g.shape[1]-1),fz=(z-g.min[2])/(g.max[2]-g.min[2])*(g.shape[2]-1);out.fill(0);
  if(fx<0||fy<0||fz<0||fx>g.shape[0]-1||fy>g.shape[1]-1||fz>g.shape[2]-1)return;
  const ix=Math.min(g.shape[0]-2,Math.floor(fx)),iy=Math.min(g.shape[1]-2,Math.floor(fy)),iz=Math.min(g.shape[2]-2,Math.floor(fz)),u=fx-ix,v=fy-iy,w=fz-iz;
  for(let k=0;k<2;k++)for(let j=0;j<2;j++)for(let i=0;i<2;i++){const q=(i?u:1-u)*(j?v:1-v)*(k?w:1-w),o=(((iz+k)*g.shape[1]+iy+j)*g.shape[0]+ix+i)*g.channels;for(let c=0;c<g.channels;c++)out[c]!+=g.data[o+c]!*q;}
}
export function imageSample(data:Float32Array,w:number,h:number,x:number,y:number):number {if(x<0||y<0||x>w-1||y>h-1)return 0;const ix=Math.min(w-2,Math.floor(x)),iy=Math.min(h-2,Math.floor(y)),u=x-ix,v=y-iy,o=iy*w+ix;return(data[o]!*(1-u)+data[o+1]!*u)*(1-v)+(data[o+w]!*(1-u)+data[o+w+1]!*u)*v;}
