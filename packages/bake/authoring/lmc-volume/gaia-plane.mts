/** Gaia ray intersections with the unchanged, piecewise-bilinear l12 warp. */
import {at,need,type Sources} from './inputs.mts';
import {locate} from './catalogue-scene.mts';
import {rayInBody,unit,add,mul,type V3} from './geometry.mts';
export interface WarpPlacement {bracketed:number;multipleIntersections:number;maximumResidualKpc:number;finiteLayerAnchors?:number;maximumFiniteLayerOffsetKpc?:number;}
export function gaiaWarpLocator(sources:Sources,stats:WarpPlacement={bracketed:0,multipleIntersections:0,maximumResidualKpc:0}){
 const map=sources.warp;let minimum=0,maximum=0;for(const z of map.values){minimum=Math.min(minimum,z);maximum=Math.max(maximum,z);}
 return(ra:number,dec:number,height=0,sigma=.15):V3=>{
  const low=minimum+height-1e-5,high=maximum+height+1e-5;
  try{let p=locate(ra,dec,sources);if(height!==0){const ray=rayInBody(unit(ra,dec));for(let k=0;k<12;k++)p=add(ray.origin,mul(ray.direction,(at(map,p[0],p[1])+height-ray.origin[2])/ray.direction[2]));}const residual=Math.abs(p[2]-at(map,p[0],p[1])-height);if(residual<1e-6){stats.maximumResidualKpc=Math.max(stats.maximumResidualKpc,residual);return p;}}
  catch(error){if(!(error instanceof TypeError)||error.message!=='Catalogue centre failed its warped-plane anchor')throw error;}
  stats.bracketed++;const ray=rayInBody(unit(ra,dec));need(Math.abs(ray.direction[2])>.1,'Gaia ray is parallel to the disc');
  const point=(z:number)=>add(ray.origin,mul(ray.direction,(z-ray.origin[2])/ray.direction[2])),flat=point(0),scale=map.n/(2*map.half),fx=(flat[0]+map.half)*scale-.5,fy=(flat[1]+map.half)*scale-.5,dx=ray.direction[0]/ray.direction[2]*scale,dy=ray.direction[1]/ray.direction[2]*scale,breaks=[low,high],roots:number[]=[];let best=flat,bestResidual=Infinity;
  for(const [f,d] of [[fx,dx],[fy,dy]]){if(Math.abs(d)<1e-12)continue;const a=f+low*d,b=f+high*d;for(let k=Math.ceil(Math.min(a,b));k<=Math.floor(Math.max(a,b));k++){const z=(k-f)/d;if(z>low&&z<high)breaks.push(z);}}
  breaks.sort((a,b)=>a-b);
  for(let k=1;k<breaks.length;k++){
   const lo=breaks[k-1],hi=breaks[k];if(hi-lo<1e-12)continue;const mid=(lo+hi)/2,x=fx+dx*mid,y=fy+dy*mid,i=Math.floor(x),j=Math.floor(y),ids=[j*map.n+i,j*map.n+i+1,(j+1)*map.n+i,(j+1)*map.n+i+1];let a=0,b=-1,c=height-mid;
   if(i>=0&&j>=0&&i+1<map.n&&j+1<map.n&&ids.every(id=>map.mask[id])){
    const [p,q,r,s]=ids.map(id=>map.values[id]),u=x-i,v=y-j,h=p*(1-u)*(1-v)+q*u*(1-v)+r*(1-u)*v+s*u*v;
    a=(p-q-r+s)*dx*dy;b=((q-p)*(1-v)+(s-r)*v)*dx+((r-p)*(1-u)+(s-q)*u)*dy-1;c=h+height-mid;
   }
   const candidates:number[]=[];
   if(Math.abs(a)<1e-12){if(Math.abs(b)>1e-12)candidates.push(-c/b);}else{const d=b*b-4*a*c;if(d>=0){const q=-.5*(b+Math.sign(b||1)*Math.sqrt(d));if(q!==0)candidates.push(q/a,c/q);else candidates.push(-b/(2*a));}}
   for(const t of candidates){const z=mid+t;if(z<lo-1e-9||z>hi+1e-9)continue;const p=point(z),residual=Math.abs(p[2]-at(map,p[0],p[1])-height);if(residual<1e-6&&!roots.some(r=>Math.abs(r-z)<1e-6))roots.push(z);}
   // A mask boundary can make the saved warp discontinuous. The finite 150 pc
   // layer still has support there. Its Gaussian height prior is maximized by
   // the smallest absolute height residual, without altering the saved warp.
   for(const z of [lo+1e-10,hi-1e-10,mid,...(Math.abs(a)>1e-12?[mid-b/(2*a)]:[])]){if(z<lo||z>hi)continue;const p=point(z),residual=Math.abs(p[2]-at(map,p[0],p[1])-height);if(residual<bestResidual){best=p;bestResidual=residual;}}
  }
  if(!roots.length){need(Number.isFinite(bestResidual)&&bestResidual<5*sigma,'Gaia ray has no plausible anchor in the adopted thin layer');stats.finiteLayerAnchors=(stats.finiteLayerAnchors??0)+1;stats.maximumFiniteLayerOffsetKpc=Math.max(stats.maximumFiniteLayerOffsetKpc??0,bestResidual);return best;}
  roots.sort((a,b)=>Math.abs(a-height)-Math.abs(b-height));if(roots.length>1)stats.multipleIntersections++;const p=point(roots[0]);stats.maximumResidualKpc=Math.max(stats.maximumResidualKpc,Math.abs(p[2]-at(map,p[0],p[1])-height));return p;
 };
}
