/** Cache only fixed ray intersections and bilinear weights. Source texels and 8-bit blending stay live. */
import {hybridOpticalOpacity} from '@cssearth/core';
import type {GalaxyDecodedPlane,GalaxyBankBox,GalaxyRayCamera} from './galaxy-fitted-bank.mts';
const signature=(p:GalaxyDecodedPlane)=>[p.axis,p.index,p.center,p.width,p.height,p.border??0,p.opticalRole??'',...(p.imageBounds??[])].join(',');
export function prepareGalaxyCompositor(templates:readonly GalaxyDecodedPlane[],box:GalaxyBankBox,camera:GalaxyRayCamera,axis:0|1|2){
 const layout=templates.map(signature),h=axis===0?1:0,v=axis===2?1:2,centre=camera.ray(camera.width/2,camera.height/2).direction,cosine=Math.abs(centre[axis])/Math.hypot(...centre),gain=Math.min(3,Math.max(1,1/cosine)),opacity=Math.min(.999,Math.max(.001,Math.round(gain/3*255)/255)),bank=templates.map((p,index)=>({p,index})).filter(v=>v.p.axis===axis),starts=new Uint32Array(camera.width*camera.height+1),ids:number[]=[],indices:number[]=[],weights:number[]=[],opacities=templates.map(p=>p.opticalRole?hybridOpticalOpacity(p.opticalRole,gain):opacity);
 if(cosine>=1e-8)for(let y=0;y<camera.height;y++)for(let x=0;x<camera.width;x++){
  const pixel=y*camera.width+x,ray=camera.ray(x+.5,y+.5);starts[pixel]=ids.length;
  const hits=bank.map(({p,index})=>({p,index,t:(p.center-ray.origin[axis])/ray.direction[axis]})).filter(h=>h.t>0).sort((a,b)=>b.t-a.t);
  for(const{p,index,t}of hits){const b=p.imageBounds??[box.min[h],box.max[h],box.min[v],box.max[v]],u=(ray.origin[h]+ray.direction[h]*t-b[0]!)/(b[1]!-b[0]!),vv=(b[3]!-ray.origin[v]-ray.direction[v]*t)/(b[3]!-b[2]!);if(u<0||u>1||vv<0||vv>1)continue;const border=p.border??0,xx=((u*(p.width-2*border)+border)/p.width)*p.width-.5,yy=((vv*(p.height-2*border)+border)/p.height)*p.height-.5,ix=Math.floor(xx),iy=Math.floor(yy),fx=xx-ix,fy=yy-iy;ids.push(index);
   for(let b=0;b<2;b++)for(let a=0;a<2;a++){const x=ix+a,y=iy+b;indices.push(x<0||y<0||x>=p.width||y>=p.height?-1:(y*p.width+x)*4);weights.push((a?fx:1-fx)*(b?fy:1-fy));}
  }
 }starts[camera.width*camera.height]=ids.length;
 const sources=Uint16Array.from(ids),texels=Int32Array.from(indices),factors=Float64Array.from(weights);
 return(planes:readonly GalaxyDecodedPlane[]):Float64Array=>{
  if(planes.length!==layout.length||planes.some((p,i)=>signature(p)!==layout[i]))throw new TypeError('Cached compositor geometry changed');const out=new Float64Array(camera.width*camera.height*3);
  for(let p=0;p<camera.width*camera.height;p++){let r=0,g=0,b=0;for(let hit=starts[p]!;hit<starts[p+1]!;hit++){const source=sources[hit]!,rgba=planes[source]!.rgba,opacity=opacities[source]!;let qr=0,qg=0,qb=0,qa=0;for(let k=0;k<4;k++){const i=texels[hit*4+k]!;if(i<0)continue;const a=rgba[i+3]!/255,w=factors[hit*4+k]!;qa+=a*w;qr+=rgba[i]!/255*a*w;qg+=rgba[i+1]!/255*a*w;qb+=rgba[i+2]!/255*a*w;}const a=qa*opacity;r=Math.round((r*(1-a)+qr*opacity)*255)/255;g=Math.round((g*(1-a)+qg*opacity)*255)/255;b=Math.round((b*(1-a)+qb*opacity)*255)/255;}out[p*3]=Math.round(r*.999*255)/255;out[p*3+1]=Math.round(g*.999*255)/255;out[p*3+2]=Math.round(b*.999*255)/255;}return out;
 };
}
