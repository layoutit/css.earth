/** Conservative index range; original sample phase and spacing are retained. Finite events are handled separately. */
export function gaussianRunRange(originZ:number,directionZ:number,start:number,ds:number,count:number,lowerZ:number,upperZ:number):[number,number]{
 if(Math.abs(directionZ)<1e-12)return originZ<lowerZ||originZ>upperZ?[count,count]:[0,count];
 const z=originZ+directionZ*(start+ds/2),a=(lowerZ-z)/(directionZ*ds),b=(upperZ-z)/(directionZ*ds),first=Math.max(0,Math.floor(Math.min(a,b))-1),last=Math.min(count,Math.ceil(Math.max(a,b))+2);
 return first>=last?[count,count]:[first,last];
}
