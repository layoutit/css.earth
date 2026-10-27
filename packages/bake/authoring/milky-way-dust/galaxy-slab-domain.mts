/** Shared opt-in interval transport. A local slab never sees light or extinction outside its interval. */
export interface GalaxySlabDomain {axis:0|1|2;min:number;max:number;}
export function slabDomain(axis:0|1|2,min:number,max:number):GalaxySlabDomain {
 if(![0,1,2].includes(axis)||!Number.isFinite(min)||!Number.isFinite(max)||min>=max)throw new TypeError('Invalid galaxy slab interval');return{axis,min,max};
}
export function clipSlabRay(bounds:readonly[number,number],origin:readonly number[],direction:readonly number[],domain?:GalaxySlabDomain):[number,number]|null {
 if(!domain)return[bounds[0],bounds[1]];
 const o=origin[domain.axis]!,d=direction[domain.axis]!;
 if(Math.abs(d)<1e-12)return o>=domain.min&&o<domain.max?[bounds[0],bounds[1]]:null;
 const a=(domain.min-o)/d,b=(domain.max-o)/d,lo=Math.max(bounds[0],Math.min(a,b)),hi=Math.min(bounds[1],Math.max(a,b));
 return hi>lo?[lo,hi]:null;
}
