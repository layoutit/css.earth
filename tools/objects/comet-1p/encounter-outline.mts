import assert from 'node:assert/strict';
import type { SourceMesh } from '../terrestrial-layers/contracts.mts';

interface OutlineObservation {bodyRight:number[];bodyUp:number[];center:number[];kmPerPixel:number[];scaleMultiplier:number;footprintPolygon:number[][]}
const dot=(a:readonly number[],b:readonly number[])=>a.reduce((sum,n,i)=>sum+n*b[i],0);

/** Recheck held-out controls against the full projected triangle union.
 * This does not fit a camera and is not an independent feature-location proof. */
export function validateVegaOutline(mesh:SourceMesh,observation:OutlineObservation) {
  const precisionKm=.01;
  const xy=mesh.positions.map(p=>[dot(p,observation.bodyRight)/1000,-dot(p,observation.bodyUp)/1000]);
  const low=[0,1].map(k=>Math.floor(Math.min(...xy.map(p=>p[k]))/precisionKm)-2);
  const high=[0,1].map(k=>Math.ceil(Math.max(...xy.map(p=>p[k]))/precisionKm)+2);
  const [width,height]=high.map((n,k)=>n-low[k]+1),mask=new Uint8Array(width*height);
  assert.ok(mask.length<4_000_000);
  const pixels=xy.map(p=>p.map((n,k)=>n/precisionKm-low[k]));
  for(const face of mesh.indices) {
    const [a,b,c]=face.map(i=>pixels[i]);
    const denominator=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
    if(Math.abs(denominator)<1e-12) continue;
    const min= [0,1].map(k=>Math.max(0,Math.floor(Math.min(a[k],b[k],c[k]))));
    const max= [0,1].map(k=>Math.min((k?height:width)-1,Math.ceil(Math.max(a[k],b[k],c[k]))));
    for(let y=min[1];y<=max[1];y++) for(let x=min[0];x<=max[0];x++) {
      const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/denominator;
      const v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/denominator;
      if(u>=0 && v>=0 && u+v<=1) mask[y*width+x]=1;
    }
  }
  const boundary:number[][]=[];
  for(let y=1;y<height-1;y++) for(let x=1;x<width-1;x++) {
    const i=y*width+x;
    if(mask[i] && (!mask[i-1] || !mask[i+1] || !mask[i-width] || !mask[i+width])) boundary.push([(x+.5+low[0])*precisionKm,(y+.5+low[1])*precisionKm]);
  }
  const controls=observation.footprintPolygon.filter((_,i)=>i%3===0);
  const errors=controls.map(p=>{
    const point=p.map((n,k)=>(n-observation.center[k])*observation.kmPerPixel[k]/observation.scaleMultiplier);
    return Math.min(...boundary.map(b=>Math.hypot(point[0]-b[0],point[1]-b[1])));
  });
  const rmsKm=Math.sqrt(errors.reduce((sum,n)=>sum+n*n,0)/errors.length),maximumKm=Math.max(...errors);
  assert.ok(rmsKm<.5 && maximumKm<1,'Held-out outline exceeds the source model uncertainty.');
  return {heldOutCount:controls.length,rmsKm,maximumKm,precisionKm,errorsKm:errors,comparison:'Full projected source mesh; authored image scale and centre only, fixed camera orientation. Outline consistency does not establish absolute feature accuracy.'};
}
