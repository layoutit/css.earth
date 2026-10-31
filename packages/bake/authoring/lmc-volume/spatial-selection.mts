/** Disjoint spatial ownership. Endpoint flags preserve XYZ min-inclusive/max-exclusive faces for either ray direction. */
import { need } from './inputs.mts';import type { V3 } from './geometry.mts';
export interface RegionBox { min: V3; max: V3; }
export interface SpatialSelection { include?: RegionBox; exclude?: readonly RegionBox[]; }
export type Interval = readonly [number,number,boolean?,boolean?];
const starts=(a:Interval)=>a[2]??true,ends=(a:Interval)=>a[3]??false;
function interval(lo:number,hi:number,first=true,last=false):Interval|null {return hi>lo||hi===lo&&first&&last?(first&&!last?[lo,hi]:[lo,hi,first,last]):null;}
function intersection(a:Interval,b:Interval):Interval|null {const lo=Math.max(a[0],b[0]),hi=Math.min(a[1],b[1]),first=(lo!==a[0]||starts(a))&&(lo!==b[0]||starts(b)),last=(hi!==a[1]||ends(a))&&(hi!==b[1]||ends(b));return interval(lo,hi,first,last);}
export function boxInterval(origin:readonly number[],direction:readonly number[],bounds:Interval,box:RegionBox):Interval|null {
 let result:Interval|null=bounds;for(let a=0;a<3&&result;a++){
  need(Number.isFinite(box.min[a])&&Number.isFinite(box.max[a])&&box.min[a]!<box.max[a]!,'Invalid spatial ownership box');const o=origin[a]!,d=direction[a]!;
  if(Math.abs(d)<1e-12){if(o<box.min[a]!||o>=box.max[a]!)return null;}
  else{const x=(box.min[a]!-o)/d,y=(box.max[a]!-o)/d;result=intersection(result,d>0?[x,y]:[y,x,false,true]);}
 }return result;
}
export function spatialIntervals(origin:readonly number[],direction:readonly number[],bounds:Interval,selection:SpatialSelection):Interval[]{
 const inside=selection.include?boxInterval(origin,direction,bounds,selection.include):bounds;if(!inside)return[];let kept:Interval[]=[inside];
 for(const box of selection.exclude??[]){const cut=boxInterval(origin,direction,inside,box);if(!cut)continue;kept=kept.flatMap(part=>{const overlap=intersection(part,cut);if(!overlap)return[part];const left=interval(part[0],overlap[0],starts(part),!starts(overlap)),right=interval(overlap[1],part[1],!ends(overlap),ends(part));return[left,right].filter((v):v is Interval=>v!==null);});}return kept;
}
export function coveredLength(intervals:readonly Interval[],start:number,end:number):number{return intervals.reduce((sum,[lo,hi])=>sum+Math.max(0,Math.min(end,hi)-Math.max(start,lo)),0);}
export function containsEvent(intervals:readonly Interval[],t:number):boolean{return intervals.some(a=>(t>a[0]||t===a[0]&&starts(a))&&(t<a[1]||t===a[1]&&ends(a)));}
