/** Offline copy of Alignment's prepared CSS transform, transported back to physical observer rays. */
import type { ObservationMapping } from '../contracts/observation-mapping.ts';
import type { OverlayFrame } from './overlay-wcs.ts';
import { defaultOverlayPlacement, updateOverlayPlacement, type OverlayPlacement } from './overlay-placement.ts';

type Vec2 = [number, number];
export interface ReconstructionAlignment {
  style: { width: string; height: string; transform: string; backgroundSize: string; backgroundPosition: string };
  pivotCssPx: readonly number[];
  placement: OverlayPlacement;
}
const invert = (m: number[]) => {
  const [a,b,c,d,e,f,g,h,i] = m;
  const v = [e*i-f*h,c*h-b*i,b*f-c*e,f*g-d*i,a*i-c*g,c*d-a*f,d*h-e*g,b*g-a*h,a*e-b*d];
  const determinant = a*v[0]+b*v[3]+c*v[6];
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-15) throw new TypeError('Aligned image is degenerate.');
  return v.map(n => n/determinant);
};
const project = (m: number[], x: number, y: number): Vec2 => {
  const d = m[6]*x+m[7]*y+m[8];
  if (!Number.isFinite(d) || Math.abs(d) < 1e-12) throw new TypeError('Aligned image crosses the observer horizon.');
  return [(m[0]*x+m[1]*y+m[2])/d,(m[3]*x+m[4]*y+m[5])/d];
};

/** UV represents full image edges; CSS translations/rotations use CSS axes, including the physical XY swap. */
export function createAlignedObservationMapping(alignment: ReconstructionAlignment, frame: OverlayFrame): ObservationMapping {
  const { style, pivotCssPx: pivot } = alignment;
  const dimension = (s: string) => /^\d+(?:\.\d+)?px$/.test(s) ? Number(s.slice(0,-2)) : NaN;
  const width = dimension(style.width), height = dimension(style.height);
  const match = /^matrix3d\(([^)]+)\)$/.exec(style.transform), css = match?.[1]?.split(',').map(Number);
  if (!(width > 0 && height > 0) || !css || css.length !== 16 || !css.every(Number.isFinite) ||
      pivot.length !== 3 || !pivot.every(Number.isFinite) || style.backgroundPosition !== '0px 0px' ||
      style.backgroundSize !== `${style.width} ${style.height}`) throw new TypeError('Aligned reconstruction requires full-extent prepared image geometry.');
  if (!(frame.metersPerUnit > 0) || Math.abs(frame.metersPerUnit / 3.085677581491367e19 - 1) > 1e-10)
    throw new TypeError('Reconstruction requires the unchanged kpc density frame.');
  const distance = Math.hypot(...frame.originM)/frame.metersPerUnit;
  const [qx,qy,qz,qw] = frame.localToReferenceXyzw;
  const away = [2*(qx*qz+qw*qy),2*(qy*qz-qw*qx),1-2*(qx*qx+qy*qy)];
  if (!(distance > 0) || Math.abs(Math.hypot(qx,qy,qz,qw)-1)>1e-10 || away.some((v,i) =>
    Math.abs(v-frame.originM[i]/(distance*frame.metersPerUnit))>1e-10)) throw new TypeError('Density frame must face away from the observer.');
  const matrixForPlacement = (placement:OverlayPlacement) => {
  const p = updateOverlayPlacement(defaultOverlayPlacement(),placement);
  const [ax,ay,az] = [p.rotationX,p.rotationY,p.rotationZ].map(n => n*Math.PI/180);
  // Transform homogeneous columns, preserving the exact prepared projective divisor.
  const transform = (column: number[], weight: number) => {
    const v = column.map((n,i) => (n-pivot[i]*weight)*p.scale);
    const x=v[0], y=Math.cos(ax)*v[1]-Math.sin(ax)*v[2], z=Math.sin(ax)*v[1]+Math.cos(ax)*v[2];
    const xx=Math.cos(ay)*x+Math.sin(ay)*z, zz=-Math.sin(ay)*x+Math.cos(ay)*z;
    const r=[Math.cos(az)*xx-Math.sin(az)*y,Math.sin(az)*xx+Math.cos(az)*y,zz];
    return r.map((n,i) => n+(pivot[i]+[p.x,p.y,p.z][i]*50)*weight);
  };
  const columns = [0,4,12].map((offset,i) => {
    const scale = [width,height,1][i], weight=css[offset+3]*scale;
    const xyz=transform(css.slice(offset,offset+3).map(n=>n*scale),weight);
    return [xyz[1]/50,xyz[0]/50,weight+xyz[2]/(50*distance)];
  });
  return [0,1,2].flatMap(row => columns.map(col => col[row]));
  };
  const forward = matrixForPlacement(alignment.placement);
  const inverse = invert(forward), uvCorners = [[0,0],[1,0],[1,1],[0,1]];
  if (uvCorners.some(([u,v])=>forward[6]*u+forward[7]*v+forward[8]<=1e-10))
    throw new TypeError('Aligned image is at or behind the observer.');
  const corners = uvCorners.map(([u,v])=>project(forward,u,v));
  const factor = (z: number) => { const f=1+z/distance; if (!(f>0)) throw new TypeError('Depth reaches the observer.'); return f; };
  return { distanceUnits:distance,
    boundsUnits:{min:[Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1]))],max:[Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))]},
    tangentAtUv:(u,v)=>project(forward,u,v),
    uvAtTangent(x,y) { const uv=project(inverse,x,y); return uv.some(n=>n< -1e-12 || n>1+1e-12) ? null : uv.map(n=>Math.max(0,Math.min(1,n))) as Vec2; },
    pointAtDepth:(x,y,z)=>[x*factor(z),y*factor(z),z],
    tangentAtPoint:(x,y,z)=>[x/factor(z),y/factor(z)],
    rayPathPerDepth:(x,y)=>Math.hypot(1,x/distance,y/distance),
  };
}
