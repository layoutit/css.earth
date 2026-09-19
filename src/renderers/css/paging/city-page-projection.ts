import type { PreparedBounds, PageViewport, PageProjection } from "./types.js";
import { invertPreparedAffineMatrix4 } from '../prepared-data/prepared-ellipsoid-projection.js';
export function projectCityPage(page: PreparedBounds, matrix: readonly number[], scale: number, viewport: PageViewport): PageProjection {
  if(page.coverageParts){
    let visible=false,span=0,center=[0,0],distance=Infinity;
    for(const part of page.coverageParts){
      const projected=projectCityPage(part,matrix,scale,viewport);
      if(!projected.visible)continue;
      visible=true;span=Math.max(span,projected.span);
      const next=Math.hypot(...projected.center);
      if(next<distance){distance=next;center=projected.center;}
    }
    return {visible,span,center};
  }
  const [left,right,top,bottom]=projectBounds(page.corners,matrix,scale,viewport);
  const front = viewport.projection ? facesPhysicalEye(page, matrix) :
    matrix[2] * page.normal[0] + matrix[6] * page.normal[1] + matrix[10] * page.normal[2] + (page.normalSlack??0)*Math.hypot(matrix[2],matrix[6],matrix[10]) > 0;
  const [coverLeft,coverRight,coverTop,coverBottom]=page.coverageCorners?projectBounds(page.coverageCorners,matrix,scale,viewport):[left,right,top,bottom];
  const originX=(viewport.originX??viewport.width/2)+(viewport.projection?.principalOffsetPixels[0]??0);
  const originY=(viewport.originY??viewport.height/2)+(viewport.projection?.principalOffsetPixels[1]??0);
  return {
    visible: front && coverLeft < viewport.width-originX && coverRight > -originX &&
      coverTop < viewport.height-originY && coverBottom > -originY,
    span: Number.isFinite(left)?Math.max(right - left, bottom - top):0,
    center: Number.isFinite(left)?[(left+right)/2+originX-viewport.width/2,(top+bottom)/2+originY-viewport.height/2]:[0,0],
  };
}

// Project the prepared corners directly into bounds, without allocating point
// and coordinate arrays for each corner on every camera update.
function projectBounds(corners: PreparedBounds["corners"],matrix: readonly number[],scale: number,viewport: PageViewport){
  if(viewport.projection)return physicalBounds(corners,matrix,viewport.projection.focalPixels);
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const [x,y,z] of corners){
    const px=matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12];
    const py=matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13];
    const pz=matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14];
    const perspective=1/(1-pz/1_000_000),sx=px*perspective*scale,sy=py*perspective*scale;
    left=Math.min(left,sx);right=Math.max(right,sx);top=Math.min(top,sy);bottom=Math.max(bottom,sy);
  }
  return [left,right,top,bottom];
}

function facesPhysicalEye(page: PreparedBounds, matrix: readonly number[]): boolean {
  const inverse = invertPreparedAffineMatrix4(matrix);
  // Compare each prepared normal cone against the actual eye in page space.
  // A page can face an off-axis observer even if its eye-space normal Z < 0.
  return page.corners.some(point => {
    const x=inverse[12]-point[0],y=inverse[13]-point[1],z=inverse[14]-point[2];
    return page.normal[0]*x+page.normal[1]*y+page.normal[2]*z+
      (page.normalSlack??0)*Math.hypot(x,y,z)>0;
  });
}

function physicalBounds(corners: PreparedBounds['corners'], matrix: readonly number[], focal: number): number[] {
  if (!(focal>0) || !Number.isFinite(focal)) throw new TypeError('Prepared page projection requires a positive focal length.');
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  const points=corners.map(([x,y,z])=>[
    matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12],
    matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13],
    matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14],
  ]);
  const near=1e-6;
  const include=(x:number,y:number,z:number)=>{
    const sx=focal*x/-z,sy=focal*y/-z;
    left=Math.min(left,sx);right=Math.max(right,sx);top=Math.min(top,sy);bottom=Math.max(bottom,sy);
  };
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    if(a[2]<=-near)include(a[0],a[1],a[2]);
    if((a[2]<-near)!==(b[2]<-near)){
      const t=(-near-a[2])/(b[2]-a[2]);
      include(a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),-near);
    }
  }
  return [left,right,top,bottom];
}
