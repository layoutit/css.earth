import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { cssCameraAxesFromOrientation } from '../navigation/world-camera-math.js';
import type { VolumeCameraPublication, VolumeVector } from '../volume/types.js';
import { mountPointPaths } from './point-paths.js';

export interface BatchedSpatialPoint { readonly positionUnits: VolumeVector }
export interface BatchedSpatialPointStyle { readonly colorCss: string; readonly opacity: number; readonly radiusPx: number }

/** The paint colour of a style, `#rrggbbaa`: the colour with its opacity as the alpha byte. */
export const pointPaint = (style: BatchedSpatialPointStyle) =>
  `${style.colorCss}${Math.max(0, Math.min(255, Math.round(style.opacity * 255))).toString(16).padStart(2, '0')}`;

/** Project a bounded 3D field into retained SVG circle paths, one per prepared paint colour (point-paths.ts).
 * Camera motion changes paint but never DOM shape.
 * `drawnCount`, given the camera's distance from the frame origin and its position in the frame, draws only the first
 * points of the list. */
/** Below this a point's move on screen is invisible, so a paint is kept. */
const MAX_PARALLAX_PIXELS = .25;
/** The most any point at least `nearestUnits` away can move on screen when the camera translates by `shift`. */
const parallaxPixels = (focalPixels: number, shift: number, nearestUnits: number) =>
  nearestUnits > shift ? focalPixels * shift / (nearestUnits - shift) : Infinity;

export function mountBatchedSpatialPoints<T extends BatchedSpatialPoint>({ host, before, frame, points, className, stylePoint, drawnCount, paintPalette, keepFraction }: {
  host: HTMLElement; before?: Element; frame: DensityVolumeFrame; points: readonly T[]; className: string;
  stylePoint(point: T, distanceUnits: number): BatchedSpatialPointStyle | null;
  drawnCount?(cameraDistanceUnits: number, cameraUnits: VolumeVector): number;
  /** Every paint colour a style can give (`pointPaint`): one retained path each. */
  paintPalette: readonly string[];
  /** The share of visible points to draw: each point keeps its own fixed rank, so a smaller share drops the same points
   * every frame and nothing flickers. `stats().candidates` counts the visible points before it applies. */
  keepFraction?(): number;
}) {
  const root = host.ownerDocument.createElement('div'); root.className = className; root.ariaHidden = 'true';
  Object.assign(root.style,{position:'absolute',inset:'0',overflow:'hidden',pointerEvents:'none'});
  const pathPaint = mountPointPaths(root, paintPalette);
  if (before) host.insertBefore(root, before); else host.append(root);
  // The last full paint: the camera's position and everything else it depended on, how many points it drew and the
  // nearest of them. A camera that only moved (a zoom, a pan around a planet) moves no point by a visible amount while
  // its translation is far below that nearest distance, so the paint is kept (parallaxPixels).
  let painted: { position: readonly number[]; rest: readonly number[]; count: number; nearestUnits: number } | null = null, destroyed = false;
  const residentElements = 1 + pathPaint.residentElements;
  let last={visiblePoints:0,candidates:0,residentElements,publishMs:0};
  const publish = ({world,viewport}: VolumeCameraPublication) => {
    if (destroyed) return;
    const started=performance.now();
    if(world.referenceFrame !== frame.referenceFrame || world.epochJdTt !== frame.epochJdTt) throw new TypeError('Point camera frame mismatch');
    const local = presentPhysicalPoseInVolume(world.pose,frame), r = cssCameraAxesFromOrientation(local.orientationXyzw);
    const keep = keepFraction ? Math.max(0, Math.min(1, keepFraction())) : 1;
    // The kept share is part of the paint: a new share repaints even where no point moved.
    const rest=[...local.orientationXyzw,viewport.focalPixels,...viewport.principalOffsetPixels,viewport.widthPixels??0,viewport.heightPixels??0,keep];
    const count = drawnCount ? Math.max(0, Math.min(points.length, Math.round(drawnCount(Math.hypot(...local.positionUnits), local.positionUnits)))) : points.length;
    if (painted && painted.count === count && rest.every((value, i) => value === painted!.rest[i])) {
      const shift = Math.hypot(...local.positionUnits.map((value, axis) => value - painted!.position[axis]!));
      if (shift === 0 || parallaxPixels(viewport.focalPixels, shift, painted.nearestUnits) < MAX_PARALLAX_PIXELS) return;
    }
    let nearestUnits = Infinity;
    let visible = 0, candidates = 0;
    pathPaint.begin(viewport);
    points.slice(0, count).forEach((point,index)=>{
      const x=point.positionUnits[0]-local.positionUnits[0], y=point.positionUnits[1]-local.positionUnits[1], z=point.positionUnits[2]-local.positionUnits[2];
      const distance=Math.hypot(x,y,z);
      if(distance<nearestUnits)nearestUnits=distance;
      const depth=-(r[2]!*x+r[5]!*y+r[8]!*z);
      if(depth<=0)return;
      const sx=viewport.focalPixels*(r[0]!*x+r[3]!*y+r[6]!*z)/depth+viewport.principalOffsetPixels[0];
      const sy=viewport.focalPixels*(r[1]!*x+r[4]!*y+r[7]!*z)/depth+viewport.principalOffsetPixels[1];
      const style=stylePoint(point,distance);
      if(!style || !(style.opacity>0) || !(style.radiusPx>0))return;
      const margin=Math.max(2,style.radiusPx);
      if(Math.abs(sx)>(viewport.widthPixels??Infinity)/2+margin || Math.abs(sy)>(viewport.heightPixels??Infinity)/2+margin)return;
      candidates++;
      // A fixed low-discrepancy rank per point: the kept share is spread evenly and stable from frame to frame.
      if(keep<1 && (index*0.6180339887498949)%1>=keep)return;
      pathPaint.point(sx, sy, Math.max(.5, style.radiusPx), pointPaint(style));
      visible++;
    });
    pathPaint.commit();
    // Counts for probes and tests, kept here: a per-frame dataset write is a DOM write (motion-freezes-membership.md).
    painted={position:[...local.positionUnits],rest,count,nearestUnits};
    last={visiblePoints:visible,candidates,residentElements,publishMs:performance.now()-started};
  };
  return Object.freeze({root,publish,stats:()=>Object.freeze({...last}),destroy(){if(destroyed)return;destroyed=true;root.remove();}});
}
