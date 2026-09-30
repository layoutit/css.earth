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
/** Dots are painted this share of the view beyond each edge: a turn warps them into view before the exact repaint, so a
 * drag shows no hole at its leading edge (content is resident a margin before it enters the view,
 * motion-freezes-membership.md). The root clips them, so a settled frame is unchanged. */
const OVERSCAN = .2;
/** The exact paint follows the last warp once publications have paused this long. */
const SETTLE_MS = 120;

type Matrix3 = [number, number, number, number, number, number, number, number, number];
const multiply = (a: Matrix3, b: Matrix3): Matrix3 => [0, 1, 2, 3, 4, 5, 6, 7, 8].map(index => {
  const row = Math.floor(index / 3) * 3, column = index % 3;
  return a[row]! * b[column]! + a[row + 1]! * b[column + 3]! + a[row + 2]! * b[column + 6]!;
}) as Matrix3;
/** Screen pixels (from the view's top left) to a camera direction, and back: `camera = axes · local`. */
const unproject = (focal: number, cx: number, cy: number): Matrix3 => [1 / focal, 0, -cx / focal, 0, 1 / focal, -cy / focal, 0, 0, -1];
const project = (focal: number, cx: number, cy: number): Matrix3 => [focal, 0, -cx, 0, focal, -cy, 0, 0, -1];
/** The camera axes as a matrix taking local directions to camera ones, and its transpose. */
const axesMatrix = (r: readonly number[]): Matrix3 => [r[0]!, r[3]!, r[6]!, r[1]!, r[4]!, r[7]!, r[2]!, r[5]!, r[8]!];
const transpose = (m: Matrix3): Matrix3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];
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
  // The overscan paints past the svg's own box; the root clips it to the view. The dots are their own layer: a rewrite
  // repaints them alone, not the viewport layer they would otherwise paint into (on M31 the viewport repainted about twice
  // a frame, 2026-09-30), and a turn's warp moves that layer on the compositor.
  Object.assign(pathPaint.svg.style, { overflow: 'visible', transformOrigin: '0 0', willChange: 'transform' });
  if (before) host.insertBefore(root, before); else host.append(root);
  // The last full paint: the camera's position and everything else it depended on, how many points it drew and the
  // nearest of them. A camera that only moved (a zoom, a pan around a planet) moves no point by a visible amount while
  // its translation is far below that nearest distance, so the paint is kept (parallaxPixels).
  let painted: { position: readonly number[]; rest: readonly number[]; count: number; nearestUnits: number; keep: number;
    axes: Matrix3; focal: number; cx: number; cy: number; width: number; height: number } | null = null, destroyed = false;
  // While the camera turns, the last paint is moved by one warp (a compositor transform) instead of repainted; the exact
  // paint follows once the publications pause.
  let warp = '', latest: VolumeCameraPublication | null = null, settle: ReturnType<typeof setTimeout> | null = null;
  const setWarp = (value: string) => { if (warp !== value) { pathPaint.svg.style.transform = value; warp = value; } };
  const residentElements = 1 + pathPaint.residentElements;
  let last={visiblePoints:0,candidates:0,residentElements,publishMs:0};
  const publish = (publication: VolumeCameraPublication, exact = false) => {
    if (destroyed) return;
    const { world, viewport } = publication;
    latest = publication;
    const started=performance.now();
    if(world.referenceFrame !== frame.referenceFrame || world.epochJdTt !== frame.epochJdTt) throw new TypeError('Point camera frame mismatch');
    const local = presentPhysicalPoseInVolume(world.pose,frame), r = cssCameraAxesFromOrientation(local.orientationXyzw);
    const keep = keepFraction ? Math.max(0, Math.min(1, keepFraction())) : 1;
    // The camera's turn and lens; the kept share is part of the paint too (`same` below): a new share repaints at rest.
    const rest=[...local.orientationXyzw,viewport.focalPixels,...viewport.principalOffsetPixels,viewport.widthPixels??0,viewport.heightPixels??0];
    const count = drawnCount ? Math.max(0, Math.min(points.length, Math.round(drawnCount(Math.hypot(...local.positionUnits), local.positionUnits)))) : points.length;
    const width = viewport.widthPixels ?? 0, height = viewport.heightPixels ?? 0;
    const cx = width / 2 + viewport.principalOffsetPixels[0], cy = height / 2 + viewport.principalOffsetPixels[1];
    if (painted) {
      const shift = Math.hypot(...local.positionUnits.map((value, axis) => value - painted!.position[axis]!));
      const still = shift === 0 || parallaxPixels(viewport.focalPixels, shift, painted.nearestUnits) < MAX_PARALLAX_PIXELS;
      const same = painted.count === count && painted.keep === keep, turned = !rest.every((value, i) => value === painted!.rest[i]);
      if (still && same && !turned) { setWarp(''); return; }
      // A turn or a zoom of the lens moves every far point by the same projective map of the screen. Warp the paint while
      // what it painted still covers the view. Which points it draws (the levels and share a zoom changes) is detail: like
      // every level swap it waits for the pause (blur while moving), so a zoom warps too, and the pause's repaint brings it.
      if (still && !exact && (turned || shift > 0) && painted.width === width && painted.height === height && width > 0 && height > 0) {
        const next = axesMatrix(r), turn = multiply(next, transpose(painted.axes));
        const forward = multiply(project(viewport.focalPixels, cx, cy), multiply(turn, unproject(painted.focal, painted.cx, painted.cy)));
        const back = multiply(project(painted.focal, painted.cx, painted.cy), multiply(transpose(turn), unproject(viewport.focalPixels, cx, cy)));
        const covered = [[0, 0], [width, 0], [0, height], [width, height]].every(([x, y]) => {
          const w = back[6] * x! + back[7] * y! + back[8];
          if (!(w > 0)) return false;
          const px = (back[0] * x! + back[1] * y! + back[2]) / w, py = (back[3] * x! + back[4] * y! + back[5]) / w;
          return px >= -OVERSCAN * width && px <= (1 + OVERSCAN) * width && py >= -OVERSCAN * height && py <= (1 + OVERSCAN) * height;
        });
        if (covered) {
          const f = (value: number) => Number(value.toPrecision(10));
          setWarp(`matrix3d(${f(forward[0])},${f(forward[3])},0,${f(forward[6])},${f(forward[1])},${f(forward[4])},0,${f(forward[7])},0,0,1,0,${f(forward[2])},${f(forward[5])},0,${f(forward[8])})`);
          if (settle !== null) clearTimeout(settle);
          settle = setTimeout(() => { settle = null; if (latest && warp) publish(latest, true); }, SETTLE_MS);
          return;
        }
      }
    }
    if (settle !== null) { clearTimeout(settle); settle = null; }
    let nearestUnits = Infinity;
    let visible = 0, candidates = 0;
    pathPaint.begin(viewport);
    // An index loop over the first `count`: slice copied the points every frame.
    for (let index = 0, end = Math.min(count, points.length); index < end; index++) {
      const point = points[index]!;
      const x=point.positionUnits[0]-local.positionUnits[0], y=point.positionUnits[1]-local.positionUnits[1], z=point.positionUnits[2]-local.positionUnits[2];
      const distance=Math.hypot(x,y,z);
      if(distance<nearestUnits)nearestUnits=distance;
      const depth=-(r[2]!*x+r[5]!*y+r[8]!*z);
      if(depth<=0)continue;
      const sx=viewport.focalPixels*(r[0]!*x+r[3]!*y+r[6]!*z)/depth+viewport.principalOffsetPixels[0];
      const sy=viewport.focalPixels*(r[1]!*x+r[4]!*y+r[7]!*z)/depth+viewport.principalOffsetPixels[1];
      const style=stylePoint(point,distance);
      if(!style || !(style.opacity>0) || !(style.radiusPx>0))continue;
      const margin=Math.max(2,style.radiusPx), halfWidth=(viewport.widthPixels??Infinity)/2, halfHeight=(viewport.heightPixels??Infinity)/2;
      if(Math.abs(sx)>halfWidth*(1+2*OVERSCAN)+margin || Math.abs(sy)>halfHeight*(1+2*OVERSCAN)+margin)continue;
      // The share and the counts are of the view; the overscan only paints ahead of a turn.
      const inView = Math.abs(sx)<=halfWidth+margin && Math.abs(sy)<=halfHeight+margin;
      if(inView)candidates++;
      // A fixed low-discrepancy rank per point: the kept share is spread evenly and stable from frame to frame.
      if(keep<1 && (index*0.6180339887498949)%1>=keep)continue;
      pathPaint.point(sx, sy, Math.max(.5, style.radiusPx), pointPaint(style));
      if(inView)visible++;
    }
    pathPaint.commit();
    setWarp('');
    // Counts for probes and tests, kept here: a per-frame dataset write is a DOM write (motion-freezes-membership.md).
    painted={position:[...local.positionUnits],rest,count,nearestUnits,keep,axes:axesMatrix(r),focal:viewport.focalPixels,cx,cy,width,height};
    last={visiblePoints:visible,candidates,residentElements,publishMs:performance.now()-started};
  };
  return Object.freeze({root,publish:(publication: VolumeCameraPublication) => publish(publication),stats:()=>Object.freeze({...last}),
    destroy(){if(destroyed)return;destroyed=true;if(settle!==null)clearTimeout(settle);root.remove();}});
}
