import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { cssCameraAxesFromOrientation } from '../navigation/world-camera-math.js';
import type { VolumeCameraPublication, VolumeVector } from '../volume/types.js';
import { mountPointPathSvg, mountPointPaths } from './point-paths.js';
import { createSettlePacer } from '../rendering/settle-pacer.js';

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
/** A warp holds while it changes no dot's size by more than this factor: a turn's projective map stretches the painted discs
 * with its centres, and a larger turn grows the dots on one side of the view past their size. */
const MAX_WARP_STRETCH = 1.1;
/** Painted dots per unit of the document's pacer (settle-pacer.ts, where a unit is about 0.6 ms of iPhone-class work):
 * on the four-times-slowed zoom of 2026-09-30, each 1,000 painted dots cost about 5 ms more a frame. */
const DOTS_PER_PACER_UNIT = 125;
/** The exact paint follows the last warp once publications have paused this long. */
const SETTLE_MS = 120;
/** While the camera travels without turning (a zoom, a pinch), a full repaint waits this long after the last one: every
 * other frame at 60 Hz, every third at 120 Hz. Such a camera moves every drawn dot every frame (2026-09-30: 99.8% of the
 * dots a nearby-universe zoom drew moved more than MAX_PARALLAX_PIXELS a frame), so each repaint projects and rewrites them
 * all; the frames between keep the last paint, a frame behind the travel. A pause repaints exactly (SETTLE_MS), so a
 * still view is unchanged. */
const MOTION_REPAINT_MS = 25;

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

/** One part of a field: its points, their cells and styles, and how many of them it draws. */
export interface BatchedSpatialPointPart<T extends BatchedSpatialPoint> {
  points: readonly T[];
  /** The points' prepared cells (@cssearth/objects CatalogueCells): `of[i]` is point i's box in `boxes`, six bounds each.
   * A cell out of view is skipped whole; without cells every point is visited. */
  cells?: { readonly boxes: Float64Array; readonly of: ArrayLike<number> };
  /** A point's fixed style, read once when the field mounts. */
  stylePoint(point: T): BatchedSpatialPointStyle | null;
  drawnCount?(cameraDistanceUnits: number, cameraUnits: VolumeVector): number;
  /** Every paint colour a style can give (`pointPaint`): one retained path each. */
  paintPalette: readonly string[];
  /** The share of visible points to draw: each point keeps its own fixed rank, so a smaller share drops the same points
   * every frame and nothing flickers. `stats().candidates` counts the visible points before it applies. */
  keepFraction?(): number;
}

export interface BatchedSpatialPointStats { visiblePoints: number; candidates: number; skippedCells: number; residentElements: number; publishMs: number }

/** A field of one or more parts in one svg. The parts share a single layer, painted state and warp: a stacked bank's six
 * levels were six viewport-sized layers that the iPad re-rastered together on every drag frame of Mars (2026-09-30), and
 * one warp can move them only if they were all painted from the same camera. A part keeps its own points, counts, share
 * and palette, and its own group (`parts[i].group`) whose opacity dims it alone, as its own layer's opacity did. */
export function mountBatchedSpatialPoints<T extends BatchedSpatialPoint>(options: {
  host: HTMLElement; before?: Element; frame: DensityVolumeFrame; className: string;
  /** The clock repaints are paced by (MOTION_REPAINT_MS); tests pass their own. */
  now?(): number;
  /** Called after the exact repaint that follows a pause, so an owner that reads `stats()` (a screen budget) can settle
   * on it: the counts of the paint before may be a paced frame's. */
  onSettle?(): void;
} & ({ parts: readonly BatchedSpatialPointPart<T>[] } | BatchedSpatialPointPart<T>)) {
  const { host, before, frame, className, now = () => performance.now(), onSettle } = options;
  const inputs = 'parts' in options ? options.parts : [options];
  if (!inputs.length) throw new TypeError(`${className}: a point field needs a part.`);
  const root = host.ownerDocument.createElement('div'); root.className = className; root.ariaHidden = 'true';
  Object.assign(root.style,{position:'absolute',inset:'0',overflow:'hidden',pointerEvents:'none'});
  const svg = mountPointPathSvg(root);
  // The overscan paints past the svg's own box; the root clips it to the view. The dots are their own layer: a rewrite
  // repaints them alone, not the viewport layer they would otherwise paint into (on M31 the viewport repainted about twice
  // a frame, 2026-09-30), and a turn's warp moves that layer on the compositor.
  Object.assign(svg.style, { overflow: 'visible', transformOrigin: '0 0', willChange: 'transform' });
  if (before) host.insertBefore(root, before); else host.append(root);
  // Everything about a part's point but where the camera sees it, resolved once: its position in one flat array, its path
  // (-1: not drawn) and its margin past the view's edge; its kept-share rank too: a fixed low-discrepancy value per point
  // spreads the kept share evenly and stably. The cells' points in ascending order, each cell a run of `order` from
  // cellStart to cellStart of the next: the prefix a frame draws ends a run early, and a point keeps its own index for its
  // rank. One cell holds everything without cells.
  const parts = inputs.map(({ points, cells, stylePoint, drawnCount, paintPalette, keepFraction }) => {
    const paint = mountPointPaths(root, paintPalette, svg);
    const positions = new Float64Array(points.length * 3), paths = new Int32Array(points.length), margins = new Float64Array(points.length);
    const ranks = new Float64Array(points.length);
    points.forEach((point, index) => {
      positions.set(point.positionUnits, index * 3);
      ranks[index] = (index * 0.6180339887498949) % 1;
      const style = stylePoint(point);
      if (!style || !(style.opacity > 0) || !(style.radiusPx > 0)) { paths[index] = -1; return; }
      paths[index] = paint.entry(pointPaint(style), Math.max(.5, style.radiusPx));
      margins[index] = Math.max(2, style.radiusPx);
    });
    const cellCount = cells ? cells.boxes.length / 6 : 1, cellStart = new Int32Array(cellCount + 1), order = new Int32Array(points.length);
    if (cells && cells.of.length !== points.length) throw new TypeError(`${className}: ${cells.of.length} cells for ${points.length} points.`);
    for (let index = 0; index < points.length; index++) cellStart[(cells ? cells.of[index]! : 0) + 1]!++;
    for (let cell = 0; cell < cellCount; cell++) cellStart[cell + 1]! += cellStart[cell]!;
    { const next = cellStart.slice(0, cellCount); for (let index = 0; index < points.length; index++) order[next[cells ? cells.of[index]! : 0]!++] = index; }
    // The widest margin a drawn point has: a cell is out of view when even its nearest corner is beyond it.
    let widestMargin = 0;
    for (let index = 0; index < points.length; index++) if (paths[index]! >= 0) widestMargin = Math.max(widestMargin, margins[index]!);
    return { points, cells, drawnCount, keepFraction, paint, positions, paths, margins, ranks, cellCount, cellStart, order,
      boxes: cells?.boxes ?? new Float64Array(6), widestMargin, culled: new Int32Array(cellCount),
      last: { visiblePoints: 0, candidates: 0, skippedCells: 0, residentElements: 0, publishMs: 0 } as BatchedSpatialPointStats };
  });
  const residentElements = 2 + parts.reduce((sum, part) => sum + part.paint.residentElements, 0);
  // The last full paint: the camera's position and everything else it depended on, how many points each part drew and
  // the nearest of them. A camera that only moved (a zoom, a pan around a planet) moves no point by a visible amount while
  // its translation is far below that nearest distance, so the paint is kept (parallaxPixels).
  let painted: { at: number; position: readonly number[]; rest: readonly number[]; counts: readonly number[]; nearestUnits: number; keeps: readonly number[];
    axes: Matrix3; focal: number; cx: number; cy: number; width: number; height: number } | null = null, destroyed = false;
  // While the camera turns, the last paint is moved by one warp (a compositor transform) instead of repainted; the exact
  // paint follows once the publications pause.
  let warp = '', latest: VolumeCameraPublication | null = null, settle: ReturnType<typeof setTimeout> | null = null;
  // A paced frame (MOTION_REPAINT_MS) left the paint a frame behind the camera's travel: the next still publication
  // repaints exactly instead of keeping it.
  let behind = false;
  const setWarp = (value: string) => { if (warp !== value) { svg.style.transform = value; warp = value; } };
  // A repaint the pacer runs for dots a zoom adds. The dots' paint is a paint exception of the motion contract
  // (docs/performance/motion-freezes-membership.md), so nothing holds it: the pacer only spaces it by the frame budget.
  let arriving = false;
  const arrivals = createSettlePacer(() => {
    if (destroyed || !latest || !arriving) return 0;
    arriving = false;
    publish(latest, true);
    return Math.max(1, Math.ceil(total().visiblePoints / DOTS_PER_PACER_UNIT));
  }, { holdWhile: 'never' });
  const total = (): BatchedSpatialPointStats => parts.reduce((sum, part) => ({ visiblePoints: sum.visiblePoints + part.last.visiblePoints,
    candidates: sum.candidates + part.last.candidates, skippedCells: sum.skippedCells + part.last.skippedCells, residentElements,
    publishMs: sum.publishMs + part.last.publishMs }), { visiblePoints: 0, candidates: 0, skippedCells: 0, residentElements, publishMs: 0 });
  const publish = (publication: VolumeCameraPublication, exact = false) => {
    if (destroyed) return;
    const { world, viewport } = publication;
    latest = publication;
    if(world.referenceFrame !== frame.referenceFrame || world.epochJdTt !== frame.epochJdTt) throw new TypeError('Point camera frame mismatch');
    const local = presentPhysicalPoseInVolume(world.pose,frame), r = cssCameraAxesFromOrientation(local.orientationXyzw);
    const keeps = parts.map(part => part.keepFraction ? Math.max(0, Math.min(1, part.keepFraction())) : 1);
    // The camera's turn and lens; the kept shares are part of the paint too (`same` below): a new share repaints at rest.
    const rest=[...local.orientationXyzw,viewport.focalPixels,...viewport.principalOffsetPixels,viewport.widthPixels??0,viewport.heightPixels??0];
    const distanceUnits = Math.hypot(...local.positionUnits);
    const counts = parts.map(part => part.drawnCount ? Math.max(0, Math.min(part.points.length, Math.round(part.drawnCount(distanceUnits, local.positionUnits)))) : part.points.length);
    const width = viewport.widthPixels ?? 0, height = viewport.heightPixels ?? 0;
    const cx = width / 2 + viewport.principalOffsetPixels[0], cy = height / 2 + viewport.principalOffsetPixels[1];
    if (painted) {
      const shift = Math.hypot(...local.positionUnits.map((value, axis) => value - painted!.position[axis]!));
      const still = shift === 0 || parallaxPixels(viewport.focalPixels, shift, painted.nearestUnits) < MAX_PARALLAX_PIXELS;
      const same = counts.every((count, index) => count === painted!.counts[index]) && keeps.every((keep, index) => keep === painted!.keeps[index]);
      const turned = !rest.every((value, i) => value === painted!.rest[i]);
      if (still && same && !turned && !behind) { setWarp(''); return; }
      // A turn or a zoom of the lens moves every far point by the same projective map of the screen. Warp the paint while
      // what it painted still covers the view. Dots a zoom adds (a longer prefix, a larger share) arrive at once, by a
      // repaint; dots it takes away wait for the pause, so a zoom warps while it only thins the view.
      // A camera that only travels (a zoom, a pinch) and repainted less than MOTION_REPAINT_MS ago keeps its paint, a frame
      // behind its travel. One that also turns repaints: the turn's warp is projective and would stretch the painted discs
      // wherever it magnifies, which a turn of a travelling camera in 25 ms can make large.
      const paced = !exact && !still && !turned && now() - painted.at < MOTION_REPAINT_MS;
      if ((still || paced) && !exact && (turned || shift > 0) && painted.width === width && painted.height === height && width > 0 && height > 0) {
        // Dots the zoom adds come through the pacer while the warp holds: a repaint as soon as the frame budget allows. A
        // paced frame needs none: its next repaint, within MOTION_REPAINT_MS, draws them.
        if (still && (counts.some((count, index) => count > painted!.counts[index]!) || keeps.some((keep, index) => keep > painted!.keeps[index]!))) { arriving = true; arrivals.request(true); }
        const next = axesMatrix(r), turn = multiply(next, transpose(painted.axes));
        const forward = multiply(project(viewport.focalPixels, cx, cy), multiply(turn, unproject(painted.focal, painted.cx, painted.cy)));
        const back = multiply(project(painted.focal, painted.cx, painted.cy), multiply(transpose(turn), unproject(viewport.focalPixels, cx, cy)));
        const source = (x: number, y: number) => { const w = back[6] * x + back[7] * y + back[8];
          return [(back[0] * x + back[1] * y + back[2]) / w, (back[3] * x + back[4] * y + back[5]) / w, w] as const; };
        // The warp moves discs as well as centres: where it magnifies, a painted dot grows. It holds only while every dot
        // in the view keeps its size within MAX_WARP_STRETCH; a projective map's stretch is largest at the view's corners.
        const covered = [[0, 0], [width, 0], [0, height], [width, height]].every(([x, y]) => {
          const [px, py, w] = source(x!, y!);
          if (!(w > 0)) return false;
          const [ax, ay] = source(x! + 1, y!), [bx, by] = source(x!, y! + 1);
          const stretch = [Math.hypot(ax - px, ay - py), Math.hypot(bx - px, by - py)];
          if (stretch.some(value => !(value >= 1 / MAX_WARP_STRETCH && value <= MAX_WARP_STRETCH))) return false;
          return px >= -OVERSCAN * width && px <= (1 + OVERSCAN) * width && py >= -OVERSCAN * height && py <= (1 + OVERSCAN) * height;
        });
        if (covered) {
          if (paced) behind = true;
          const f = (value: number) => Number(value.toPrecision(10));
          setWarp(`matrix3d(${f(forward[0])},${f(forward[3])},0,${f(forward[6])},${f(forward[1])},${f(forward[4])},0,${f(forward[7])},0,0,1,0,${f(forward[2])},${f(forward[5])},0,${f(forward[8])})`);
          if (settle !== null) clearTimeout(settle);
          settle = setTimeout(() => { settle = null; if (latest && warp) { publish(latest, true); onSettle?.(); } }, SETTLE_MS);
          return;
        }
      }
    }
    if (settle !== null) { clearTimeout(settle); settle = null; }
    let nearestSquared = Infinity;
    const [px, py, pz] = local.positionUnits, focal = viewport.focalPixels, [ox, oy] = viewport.principalOffsetPixels;
    const halfWidth = (viewport.widthPixels ?? Infinity) / 2, halfHeight = (viewport.heightPixels ?? Infinity) / 2;
    const [r0, r1, r2, r3, r4, r5, r6, r7, r8] = r as unknown as [number, number, number, number, number, number, number, number, number];
    parts.forEach((part, partIndex) => {
      const partStarted = performance.now();
      const { positions, paths, margins, ranks, cellCount, cellStart, order, boxes, culled, paint, cells } = part;
      const count = counts[partIndex]!, keep = keeps[partIndex]!;
      let visible = 0, candidates = 0;
      paint.begin(viewport);
      // A cell is out of view when all of its box is behind the camera or beyond one edge of the painted view and its
      // margins (a plane through the camera for each edge). The test is on the box, so it never drops a point the point
      // test below would keep; a relative tolerance keeps rounding on the box's side.
      const edgeX = halfWidth * (1 + 2 * OVERSCAN) + part.widestMargin, edgeY = halfHeight * (1 + 2 * OVERSCAN) + part.widestMargin;
      const sides = Number.isFinite(edgeX) && Number.isFinite(edgeY);
      // Each edge's plane n, with n · offset >= 0 on the view's side: sx <= edgeX is (edgeX - ox) depth - focal x >= 0, and
      // sx >= -edgeX is focal x + (edgeX + ox) depth >= 0, where depth = -(r2, r5, r8) · offset (likewise for y).
      const planes = [
        -focal * r0 - (edgeX - ox) * r2, -focal * r3 - (edgeX - ox) * r5, -focal * r6 - (edgeX - ox) * r8,
        focal * r0 - (edgeX + ox) * r2, focal * r3 - (edgeX + ox) * r5, focal * r6 - (edgeX + ox) * r8,
        -focal * r1 - (edgeY - oy) * r2, -focal * r4 - (edgeY - oy) * r5, -focal * r7 - (edgeY - oy) * r8,
        focal * r1 - (edgeY + oy) * r2, focal * r4 - (edgeY + oy) * r5, focal * r7 - (edgeY + oy) * r8,
      ];
      const outOfView = (cell: number) => {
        const b = cell * 6;
        const cx = (boxes[b]! + boxes[b + 3]!) / 2 - px, cy = (boxes[b + 1]! + boxes[b + 4]!) / 2 - py, cz = (boxes[b + 2]! + boxes[b + 5]!) / 2 - pz;
        const hx = (boxes[b + 3]! - boxes[b]!) / 2, hy = (boxes[b + 4]! - boxes[b + 1]!) / 2, hz = (boxes[b + 5]! - boxes[b + 2]!) / 2;
        const reach = Math.abs(cx) + Math.abs(cy) + Math.abs(cz) + hx + hy + hz;
        // In front: the largest depth over the box, depth = -(r2, r5, r8) · offset.
        if (!(-(r2 * cx + r5 * cy + r8 * cz) + Math.abs(r2) * hx + Math.abs(r5) * hy + Math.abs(r8) * hz > -1e-9 * reach * (Math.abs(r2) + Math.abs(r5) + Math.abs(r8)))) return true;
        for (let plane = 0; sides && plane < 12; plane += 3) {
          const nx = planes[plane]!, ny = planes[plane + 1]!, nz = planes[plane + 2]!, scale = Math.abs(nx) + Math.abs(ny) + Math.abs(nz);
          if (nx * cx + ny * cy + nz * cz + Math.abs(nx) * hx + Math.abs(ny) * hy + Math.abs(nz) * hz < -1e-9 * reach * scale) return true;
        }
        return false;
      };
      let culledCount = 0;
      for (let cell = 0; cell < cellCount; cell++) {
        if (cells && outOfView(cell)) { culled[culledCount++] = cell; continue; }
        for (let run = cellStart[cell]!, end = cellStart[cell + 1]!; run < end; run++) {
          const index = order[run]!;
          if (index >= count) break;
          const o = index * 3, x = positions[o]! - px, y = positions[o + 1]! - py, z = positions[o + 2]! - pz;
          const squared = x * x + y * y + z * z;
          if (squared < nearestSquared) nearestSquared = squared;
          const path = paths[index]!;
          if (path < 0) continue;
          const depth = -(r2 * x + r5 * y + r8 * z);
          if (depth <= 0) continue;
          const sx = focal * (r0 * x + r3 * y + r6 * z) / depth + ox, sy = focal * (r1 * x + r4 * y + r7 * z) / depth + oy;
          const margin = margins[index]!;
          if (Math.abs(sx) > halfWidth * (1 + 2 * OVERSCAN) + margin || Math.abs(sy) > halfHeight * (1 + 2 * OVERSCAN) + margin) continue;
          // The share and the counts are of the view; the overscan only paints ahead of a turn.
          const inView = Math.abs(sx) <= halfWidth + margin && Math.abs(sy) <= halfHeight + margin;
          if (inView) candidates++;
          if (keep < 1 && ranks[index]! >= keep) continue;
          paint.add(path, sx, sy);
          if (inView) visible++;
        }
      }
      // The paint is kept while the camera moves less than its nearest drawn-prefix point allows (parallaxPixels), so the
      // nearest is over every point of every prefix: a skipped cell's points count when its box is nearer than the nearest yet.
      for (let skipped = 0; skipped < culledCount; skipped++) {
        const cell = culled[skipped]!, b = cell * 6;
        const dx = Math.max(0, boxes[b]! - px, px - boxes[b + 3]!), dy = Math.max(0, boxes[b + 1]! - py, py - boxes[b + 4]!), dz = Math.max(0, boxes[b + 2]! - pz, pz - boxes[b + 5]!);
        if (!(dx * dx + dy * dy + dz * dz < nearestSquared)) continue;
        for (let run = cellStart[cell]!, end = cellStart[cell + 1]!; run < end; run++) {
          const index = order[run]!;
          if (index >= count) break;
          const o = index * 3, x = positions[o]! - px, y = positions[o + 1]! - py, z = positions[o + 2]! - pz;
          const squared = x * x + y * y + z * z;
          if (squared < nearestSquared) nearestSquared = squared;
        }
      }
      paint.commit();
      part.last = { visiblePoints: visible, candidates, skippedCells: culledCount, residentElements, publishMs: performance.now() - partStarted };
    });
    const nearestUnits = Math.sqrt(nearestSquared);
    setWarp('');
    // Counts for probes and tests, kept here: a per-frame dataset write is a DOM write (motion-freezes-membership.md).
    behind = false;
    painted={at:now(),position:[...local.positionUnits],rest,counts,nearestUnits,keeps,axes:axesMatrix(r),focal:viewport.focalPixels,cx,cy,width,height};
  };
  return Object.freeze({ root,
    /** Each part's group, whose opacity dims it, and its counts from the last paint. */
    parts: Object.freeze(parts.map(part => Object.freeze({ group: part.paint.part, stats: () => Object.freeze({ ...part.last }) }))),
    publish: (publication: VolumeCameraPublication) => publish(publication),
    /** The whole field's counts from the last paint. */
    stats: () => Object.freeze(total()),
    destroy() { if (destroyed) return; destroyed = true; if (settle !== null) clearTimeout(settle); arrivals.destroy(); root.remove(); } });
}
