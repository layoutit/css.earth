import { prepareCityPageGeometry } from "./page-geometry.mts";
import { preparePageTextureQuad } from "./wms-page-geometry.mts";

import type { GeographicScene, PageGeometry, TileAddress, WmtsPage } from './contracts.mts';
import { dotN as dot } from '@cssearth/core';
const caps = new WeakMap<GeographicScene, PageGeometry[]>();
const latitude = (row: number, zoom: number) => Math.atan(Math.sinh(Math.PI*(1-2*row/2**zoom)))*180/Math.PI;
function inverse(m: readonly number[]) {
  const [a,b,c,d,e,f,g,h,i]=m;
  const r=[e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d];
  const det=a*r[0]+b*r[3]+c*r[6];
  if(Math.abs(det)<1e-25)throw new Error("Singular polar projection.");
  return r.map(v=>v/det);
}
const apply=(h: readonly number[],u: number,v: number)=>{const w=h[6]*u+h[7]*v+h[8];return [(h[0]*u+h[1]*v+h[2])/w,(h[3]*u+h[4]*v+h[5])/w];};
function quad([p0,p1,p2,p3]: readonly (readonly number[])[]){
  const a=p1.map((v,i)=>v-p2[i]),b=p3.map((v,i)=>v-p2[i]),c=p2.map((v,i)=>v-p1[i]-p3[i]+p0[i]);
  const d=a[0]*b[1]-a[1]*b[0],g=(c[0]*b[1]-c[1]*b[0])/d,h=(a[0]*c[1]-a[1]*c[0])/d;
  return [(g+1)*p1[0]-p0[0],(h+1)*p3[0]-p0[0],p0[0],(g+1)*p1[1]-p0[1],(h+1)*p3[1]-p0[1],p0[1],g,h,1];
}

// Invert the accepted cap's geographic sampler. Its polygon edge is the
// intersection of the real cap and adjacent band planes, including the apron.
export function polarGeographicUv(page: PageGeometry, longitude: number, lat: number) {
  const p=page.geographicProjection; if (!p) throw new TypeError("Polar page projection is missing"); const m=p.matrix;
  const lon=((longitude%360)+360)%360;
  const plane=p.planes.find(q=>lon>=q.west&&lon<q.west+11.25);
  if (!plane) throw new TypeError("Polar geographic plane is missing");
  const fraction=(lon-plane.west)/11.25, h=plane.inverse;
  const ax=h[0]-fraction*h[6],ay=h[1]-fraction*h[7],az=h[2]-fraction*h[8];
  const relative=[-plane.origin[0],-plane.origin[1],m[14]-plane.origin[2]];
  const a=ax*plane.basisU[0]+ay*plane.basisV[0];
  const b=ax*plane.basisU[1]+ay*plane.basisV[1];
  const c=ax*dot(relative,plane.basisU)+ay*dot(relative,plane.basisV)+az;
  const det=plane.qx*b-plane.qy*a;
  const ratio=Math.cos(lat*Math.PI/180)/Math.cos(78.75*Math.PI/180);
  const wx=(b+plane.qy*c)/det*ratio-m[12],wy=(-plane.qx*c-a)/det*ratio-m[13];
  const d=m[0]*m[5]-m[4]*m[1];
  const x=(wx*m[5]-m[4]*wy)/d,y=(m[0]*wy-wx*m[1])/d;
  return [(x-p.x0)/(p.x1-p.x0),(y-p.y0)/(p.y1-p.y0)];
}

export function preparePolarWmtsTile({zoom,x,y}: TileAddress,scene: GeographicScene,url: string,startIndex=0): WmtsPage[]{
  if(!caps.has(scene))caps.set(scene,[0,15].map(b=>prepareCityPageGeometry({level:0,x:0,y:b},scene)));
  const pieces: WmtsPage[]=[],n=2**zoom,west=-180+x/n*360,longitudeSpan=360/n;
  const north=latitude(y,zoom),south=latitude(y+1,zoom);
  for(const coarse of caps.get(scene)!){
    const b=coarse.sourceBounds;
    if(south>=b.north||north<=b.south)continue;
    const point=(u: number,v: number)=>polarGeographicUv(coarse,west+longitudeSpan*u,latitude(y+v,zoom));
    const split=(u0: number,u1: number,v0: number,v1: number,depth: number): void=>{
      const points=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>point(u,v));
      const h=quad(points),inv=inverse(h);
      let error=0;
      for(let j=0;j<=4;j++)for(let i=0;i<=4;i++){
        const u=i/4,v=j/4,actual=point(u0+(u1-u0)*u,v0+(v1-v0)*v),mapped=apply(inv,actual[0],actual[1]);
        error=Math.max(error,Math.hypot((mapped[0]-u)*(u1-u0)*256,(mapped[1]-v)*(v1-v0)*256));
      }
      // Use a fourfold margin against the regular-band pixel tolerance. A dense
      // independent round-trip test checks the interior and cap/band transition.
      if(error>0.03125){
        if(depth>=12)throw new Error("Polar subdivision exceeded its preparation budget.");
        const um=(u0+u1)/2,vm=(v0+v1)/2;
        split(u0,um,v0,vm,depth+1);split(um,u1,v0,vm,depth+1);
        split(u0,um,vm,v1,depth+1);split(um,u1,vm,v1,depth+1);return;
      }
      const cu0=Math.max(0,Math.min(...points.map(p=>p[0]))),cu1=Math.min(1,Math.max(...points.map(p=>p[0])));
      const cv0=Math.max(0,Math.min(...points.map(p=>p[1]))),cv1=Math.min(1,Math.max(...points.map(p=>p[1])));
      if(cu1-cu0<1e-10||cv1-cv0<1e-10)return;
      const du=cu1-cu0,dv=cv1-cv0;
      const mapping=preparePageTextureQuad(coarse,[du,0,cu0,0,dv,cv0,0,0,1],8);
      const r=[(h[0]-cu0*h[6])/du,(h[1]-cu0*h[7])/du,(h[2]-cu0*h[8])/du,
        (h[3]-cv0*h[6])/dv,(h[4]-cv0*h[7])/dv,(h[5]-cv0*h[8])/dv,h[6],h[7],h[8]];
      const imageMatrix=[r[0],r[3],0,r[6]/256,r[1],r[4],0,r[7]/256,0,0,1,0,r[2]*256,r[5]*256,0,r[8]].join(",");
      pieces.push({key:`wmts-${zoom}-${x}-${y}-${startIndex+pieces.length}`,level:zoom,x,y,rasterSource:"terrascope-wmts@1",url,width:256,height:256,
        bounds:{west:west+longitudeSpan*u0,east:west+longitudeSpan*u1,north:latitude(y+v0,zoom),south:latitude(y+v1,zoom)},
        sourceCrop:{u0,u1,v0,v1},coarseKey:coarse.key,faceClip:{u0:cu0,u1:cu1,v0:cv0,v1:cv1},normal:coarse.normal,...mapping,imageMatrix,
        textureBackgroundSize:`${256/(u1-u0)}px ${256/(v1-v0)}px`,textureBackgroundPosition:`${-u0*256/(u1-u0)}px ${-v0*256/(v1-v0)}px`,
        maximumCssSpan:512,children:[],projectionErrorPixels:error});
    };
    split(0,1,0,1,0);
  }
  return pieces;
}
