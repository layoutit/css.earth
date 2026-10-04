import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { type DensityVolumeFrame, type VolumeVector } from '@cssearth/objects';
import { cssCameraAxesFromOrientation } from '@cssearth/engine';
import type { VolumeCameraPublication } from '../volume/types.js';

import { mountPointPaths } from './point-paths.js';
import { cameraRest, pointLayerSlot, sameRest, type PointLayerMember, type PointLayerRepaint, type PointLayerSlot } from './point-layer.js';
import { createSettlePacer } from '../rendering/settle-pacer.js';

export interface BatchedSpatialPoint { readonly positionUnits: VolumeVector }
export interface BatchedSpatialPointStyle { readonly colorCss: string; readonly opacity: number; readonly radiusPx: number }

/** The paint of a style, `#rrggbbaa@radius`: the color with its opacity as the alpha byte, at its dot radius. One path
 * strokes each paint (point-paths.ts), so dots of one color at two sizes take two paths. */
export const pointPaint = (style: BatchedSpatialPointStyle) =>
  `${style.colorCss}${Math.max(0, Math.min(255, Math.round(style.opacity * 255))).toString(16).padStart(2, '0')}@${Math.max(.5, style.radiusPx)}`;

/** Project a bounded 3D field into retained SVG circle paths, one per prepared paint color (point-paths.ts).
 * Camera motion changes paint but never DOM shape.
 * `drawnCount`, given the camera's distance from the frame origin and its position in the frame, draws only the first
 * points of the list. */
/** Below this a point's move on screen is invisible, so a paint is kept. */
const MAX_PARALLAX_PIXELS = .25;
/** Dots are painted this share of the view beyond each edge: a turn warps them into view before the exact repaint, so a
 * drag shows no hole at its leading edge (content is resident a margin before it enters the view,
 * motion-freezes-membership.md). The root clips them, so a settled frame is unchanged. A travelling camera repaints
 * every frame and warps none, so its paints leave the margin out and the pause paints it back. */
const OVERSCAN = .2;
/** Painted dots per unit of the document's pacer (settle-pacer.ts, where a unit is about 0.6 ms of iPhone-class work):
 * on the four-times-slowed zoom of 2026-09-30, each 1,000 painted dots cost about 5 ms more a frame. */
const DOTS_PER_PACER_UNIT = 125;
/** The exact paint follows the last warp once publications have paused this long. */
const SETTLE_MS = 120;
/** A dot seen through an occluding disc (a galaxy's, from outside it) is dimmed by where its sight line crosses the disc:
 * most at the centre, to OCCLUDED_FLOOR of its opacity, and not at all at the disc's edge, along (1 - (r/R)^2)^2, which
 * reaches the edge with no step and no slope, so the disc's outline does not show in the dots. The dimming is painted in
 * OCCLUDED_STEPS even steps of opacity, one fainter path each. PROTOTYPE values, guessed on 2026-10-01. */
const OCCLUDED_FLOOR = .25, OCCLUDED_STEPS = 5;
const OCCLUDED_OPACITIES = Array.from({ length: OCCLUDED_STEPS }, (_, step) => OCCLUDED_FLOOR + (1 - OCCLUDED_FLOOR) * step / OCCLUDED_STEPS);
/** A flat disc in a field's own frame: its centre, unit normal and radius, in the field's units. */
export interface BatchedSpatialPointOccluder { readonly centreUnits: VolumeVector; readonly normal: VolumeVector; readonly radiusUnits: number }

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
  /** Every paint color a style can give (`pointPaint`): one retained path each. */
  paintPalette: readonly string[];
  /** The share of visible points to draw: each point keeps its own fixed rank, so a smaller share drops the same points
   * every frame and nothing flickers. `stats().candidates` counts the visible points before it applies. */
  keepFraction?(): number;
  /** The indices of the points not to draw now, or null: the dots of stars a body marker draws (catalogue-points.ts). The
   * same set is returned until it changes. */
  hidden?(): ReadonlySet<number> | null;
  /** Parts with the same key paint into the same paths and share one group: a path is one color, size and alpha, so
   * parts that never dim apart need no paths of their own. The Milky Way's main bank drew 3,356 dots through 685 paths,
   * a copy of every paint for each of its five levels, where its dots use 389 paints (2026-10-03). Without a key a part
   * has its own paths. */
  paintGroup?: string | number;
}

export interface BatchedSpatialPointStats { visiblePoints: number; candidates: number; skippedCells: number; residentElements: number; publishMs: number }

/** A field of one or more parts in one group of a dot layer's svg (point-layer.ts). The parts share one painted state: a
 * stacked bank's six levels were six viewport-sized layers that the iPad re-rastered together on every drag frame of Mars
 * (2026-09-30), and one warp can move them only if they were all painted from the same camera. A part keeps its own
 * points, counts, share and palette, and its own group (`parts[i].group`) whose opacity dims it alone, as its own
 * layer's opacity did. The field joins the layer that ends where it mounts, or the slot its owner took there. */
export function mountBatchedSpatialPoints<T extends BatchedSpatialPoint>(options: {
  host: HTMLElement | PointLayerSlot; before?: Element; frame: DensityVolumeFrame; className: string;
  /** Called after the exact repaint that follows a pause, so an owner that reads `stats()` (a screen budget) can settle
   * on it: the counts of the paint before may be a warped frame's. */
  onSettle?(): void;
  /** A disc that dims the dots behind it (OCCLUDED_FLOOR): a dot whose sight line from the camera crosses the disc
   * before reaching the dot is painted by a fainter path of its own color. */
  occluder?: BatchedSpatialPointOccluder;
  /** Leave the parts' points unresolved at mount: the owner resolves them in slices (`fill`), and a part draws nothing
   * until its last slice. Resolving a point (its place, its path, its cell) is a pass over every point of the bank:
   * all of them in the frame the bank arrived in were one long frame of a zoom. */
  deferFill?: boolean;
} & ({ parts: readonly BatchedSpatialPointPart<T>[] } | BatchedSpatialPointPart<T>)) {
  const { host, before, frame, className, onSettle, occluder, deferFill = false } = options;
  const inputs = 'parts' in options ? options.parts : [options];
  if (!inputs.length) throw new TypeError(`${className}: a point field needs a part.`);
  // Mounted in an element, the field takes its own place in the dot layer there; in an owner's place, a group of its own.
  const own = 'layer' in host ? null : pointLayerSlot(host, before), { layer, group: parent } = own ?? host as PointLayerSlot;
  const root = own ? parent : parent.appendChild(layer.svg.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'g'));
  root.setAttribute('class', className);
  // Everything about a part's point but where the camera sees it, resolved once: its position in one flat array, its path
  // (-1: not drawn) and its margin past the view's edge; its kept-share rank too: a fixed low-discrepancy value per point
  // spreads the kept share evenly and stably. The cells' points in ascending order, each cell a run of `order` from
  // cellStart to cellStart of the next: the prefix a frame draws ends a run early, and a point keeps its own index for its
  // rank. One cell holds everything without cells.
  // Behind an occluder a dot is painted by a fainter path of its color, one for each level: more paths, no more dots.
  const dimmed = (style: BatchedSpatialPointStyle, factor: number) => pointPaint({ ...style, opacity: style.opacity * factor });
  // One set of paths for each paint group, in the order the groups first appear, holding every paint its parts use.
  const groupOf = inputs.map((input, index) => input.paintGroup === undefined ? `part ${index}` : `group ${input.paintGroup}`);
  const paints = new Map([...new Set(groupOf)].map(group => [group, mountPointPaths(root, inputs.flatMap(({ points, stylePoint, paintPalette }, index) => {
    if (groupOf[index] !== group) return [];
    if (!occluder) return paintPalette;
    // The fainter paints, built once for each style the points have and not once for each point: 39,916 galaxies share
    // 123 styles, and five paints for each point were 58 ms of the frame their bank mounted in (iPad, 2026-10-03).
    const drawn = new Set<BatchedSpatialPointStyle>();
    for (const point of points) { const style = stylePoint(point); if (style && style.opacity > 0 && style.radiusPx > 0) drawn.add(style); }
    return [...paintPalette, ...OCCLUDED_OPACITIES.flatMap(factor => [...drawn].map(style => dimmed(style, factor)))];
  }))] as const));
  const parts = inputs.map(({ points, cells, stylePoint, drawnCount, keepFraction, hidden }, partIndex) => {
    const paint = paints.get(groupOf[partIndex]!)!;
    const positions = new Float64Array(points.length * 3), paths = new Int32Array(points.length), margins = new Float64Array(points.length);
    const occludedPaths = OCCLUDED_OPACITIES.map(() => new Int32Array(occluder ? points.length : 0));
    const ranks = new Float64Array(points.length);
    // A bank hands out one style object for each of its paints: its path is looked up once, not for each of its points
    // (39,916 points share 123 paints in the nearby galaxies' bank).
    const pathOf = new Map<BatchedSpatialPointStyle, number>(), occludedOf = OCCLUDED_OPACITIES.map(() => new Map<BatchedSpatialPointStyle, number>());
    const cellCount = cells ? cells.boxes.length / 6 : 1, cellStart = new Int32Array(cellCount + 1), order = new Int32Array(points.length);
    if (cells && cells.of.length !== points.length) throw new TypeError(`${className}: ${cells.of.length} cells for ${points.length} points.`);
    const part = { points, cells, drawnCount, keepFraction, hidden, paint, positions, paths, occludedPaths, margins, ranks, cellCount, cellStart, order,
      boxes: cells?.boxes ?? new Float64Array(6), widestMargin: 0, culled: new Int32Array(cellCount), ready: false,
      /** Resolve up to `limit` more of the part's points, in order; the last slice orders them by cell and readies the part.
       * A whole number of them, and one or more: the pacer's budget is halved after a slow frame, and half a point left
       * the next slice starting between two points, so the bank failed to load (2026-10-03). */
      resolve(limit: number): number {
        const from = resolved, end = Math.min(points.length, from + Math.max(1, Math.floor(limit)));
        for (let index = from; index < end; index++) {
          const point = points[index]!;
          positions.set(point.positionUnits, index * 3);
          ranks[index] = (index * 0.6180339887498949) % 1;
          const style = stylePoint(point);
          if (!style || !(style.opacity > 0) || !(style.radiusPx > 0)) { paths[index] = -1; continue; }
          let path = pathOf.get(style);
          if (path === undefined) pathOf.set(style, path = paint.entry(pointPaint(style), Math.max(.5, style.radiusPx)));
          paths[index] = path;
          if (occluder) OCCLUDED_OPACITIES.forEach((factor, level) => {
            let dim = occludedOf[level]!.get(style);
            if (dim === undefined) occludedOf[level]!.set(style, dim = paint.entry(dimmed(style, factor), Math.max(.5, style.radiusPx)));
            occludedPaths[level]![index] = dim;
          });
          margins[index] = Math.max(2, style.radiusPx);
        }
        resolved = end;
        if (resolved === points.length && !part.ready) {
          for (let index = 0; index < points.length; index++) cellStart[(cells ? cells.of[index]! : 0) + 1]!++;
          for (let cell = 0; cell < cellCount; cell++) cellStart[cell + 1]! += cellStart[cell]!;
          { const next = cellStart.slice(0, cellCount); for (let index = 0; index < points.length; index++) order[next[cells ? cells.of[index]! : 0]!++] = index; }
          // The widest margin a drawn point has: a cell is out of view when even its nearest corner is beyond it.
          for (let index = 0; index < points.length; index++) if (paths[index]! >= 0) part.widestMargin = Math.max(part.widestMargin, margins[index]!);
          part.ready = true;
        }
        return end - from;
      },
      last: { visiblePoints: 0, candidates: 0, skippedCells: 0, residentElements: 0, publishMs: 0 } as BatchedSpatialPointStats };
    let resolved = 0;
    if (!deferFill) part.resolve(Infinity);
    return part;
  });
  const residentElements = 1 + [...paints.values()].reduce((sum, paint) => sum + paint.residentElements, 0);
  // The last full paint: the camera's position and everything else it depended on, how many points each part drew and
  // the nearest of them. A camera that only moved (a zoom, a pan around a planet) moves no point by a visible amount while
  // its translation is far below that nearest distance, so the paint is kept (parallaxPixels).
  let painted: { position: readonly number[]; rest: readonly number[]; counts: readonly number[]; nearestUnits: number; keeps: readonly number[]; hiddens: readonly (ReadonlySet<number> | null)[];
    width: number; height: number; overscan: number } | null = null, destroyed = false, shown = false;
  // While the camera turns, the layer moves its paints by one warp (a compositor transform) instead of repainting them;
  // the exact paint follows once the publications pause.
  // `owed`: the paint on screen is a warped one (or one kept while its counts changed), so the pause owes the exact paint.
  let latest: VolumeCameraPublication | null = null, settle: ReturnType<typeof setTimeout> | null = null, settling = false, owed = false;
  // When the publication that last asked for a settle arrived: the armed timer waits out the pause from there, so a
  // travelling camera does not clear and set a timer on every frame.
  let travelledAt = 0;
  // The pause's exact paint: after a warp, and after a paint that left its margin out. Only the first can change what
  // the view shows, so only it tells the owner. It repaints the layer's other fields too (`member.repaint`).
  const settleAfterPause = () => {
    travelledAt = performance.now();
    if (settle !== null) return;
    const wait = (delay: number) => {
      settle = setTimeout(() => {
        const rest = SETTLE_MS - (performance.now() - travelledAt);
        if (rest > 1) { wait(rest); return; }
        settle = null;
        if (!latest) return;
        if (owed) { settling = true; try { publish(latest, true); } finally { settling = false; } onSettle?.(); }
        else if (painted && painted.overscan < OVERSCAN) publish(latest, true);
      }, delay);
    };
    wait(SETTLE_MS);
  };
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
  const publish = (publication: VolumeCameraPublication, exact = false, forced: PointLayerRepaint | null = null) => {
    if (destroyed) return;
    const { world, viewport } = publication;
    latest = publication;
    if(world.referenceFrame !== frame.referenceFrame || world.epochJdTt !== frame.epochJdTt) throw new TypeError('Point camera frame mismatch');
    const local = presentPhysicalPoseInVolume(world.pose,frame), r = cssCameraAxesFromOrientation(local.orientationXyzw);
    const keeps = parts.map(part => part.keepFraction ? Math.max(0, Math.min(1, part.keepFraction())) : 1);
    const hiddens = parts.map(part => part.hidden ? part.hidden() : null);
    // The camera's turn and lens; the kept shares are part of the paint too (`same` below): a new share repaints at rest.
    const rest = cameraRest(publication);
    const distanceUnits = Math.hypot(...local.positionUnits);
    // A part whose points are not all resolved yet (deferFill) draws none of them.
    const counts = parts.map(part => !part.ready ? 0 : part.drawnCount ? Math.max(0, Math.min(part.points.length, Math.round(part.drawnCount(distanceUnits, local.positionUnits)))) : part.points.length);
    const width = viewport.widthPixels ?? 0, height = viewport.heightPixels ?? 0;
    let travelling = forced?.travelling ?? false;
    if (painted) {
      const shift = Math.hypot(...local.positionUnits.map((value, axis) => value - painted!.position[axis]!));
      const still = shift === 0 || parallaxPixels(viewport.focalPixels, shift, painted.nearestUnits) < MAX_PARALLAX_PIXELS;
      const same = counts.every((count, index) => count === painted!.counts[index]) && keeps.every((keep, index) => keep === painted!.keeps[index])
        && hiddens.every((hidden, index) => hidden === painted!.hiddens[index]);
      const turned = !sameRest(rest, painted.rest);
      // A paint the layer has moved on from (this field was hidden when the others repainted) is neither kept nor warped.
      const held = !forced && layer.holds(painted.rest);
      // A paint without its margin is kept like any other; only the pause's exact paint replaces it.
      if (held && still && same && !turned && !(exact && painted.overscan < OVERSCAN)) { layer.unwarp(); owed = false; return; }
      travelling ||= !still && !exact;
      // A turn or a zoom of the lens moves every far point by the same projective map of the screen. Warp the paint while
      // what it painted still covers the view. Dots a zoom adds (a longer prefix, a larger share) arrive at once, by a
      // repaint; dots it takes away wait for the pause, so a zoom warps while it only thins the view.
      // A camera whose travel moves the dots (a zoom, a pinch at their scale) repaints every frame. Keeping the paint
      // on alternate frames left the dots at half the display's rate and cost more: on the iPad a slow zoom at the nearby
      // universe had 72 to 75 frames over 20 ms in 240 that way and 34 to 38 repainting each frame (2026-10-03).
      if (held && still && !exact && (turned || shift > 0) && painted.width === width && painted.height === height && width > 0 && height > 0) {
        // Dots the zoom adds come through the pacer while the warp holds: a repaint as soon as the frame budget allows.
        if (counts.some((count, index) => count > painted!.counts[index]!) || keeps.some((keep, index) => keep > painted!.keeps[index]!)) { arriving = true; arrivals.request(true); }
        if (layer.warpTo(publication)) { owed = true; settleAfterPause(); return; }
      }
    }
    // No warp slides a travelling camera's paint (the next frame repaints), so it paints the view alone. On the iPad's
    // slow zoom the margin was a third of the dots written; without it 690 frames had 19 to 24 over 20 ms at the nearby
    // universe against 57 to 81, and 42 to 47 at the Milky Way against 105 to 121 (interleaved runs, 2026-10-03).
    const overscan = travelling ? 0 : OVERSCAN;
    owed = false;
    if (travelling) settleAfterPause(); else if (settle !== null) { clearTimeout(settle); settle = null; }
    let nearestSquared = Infinity;
    const [px, py, pz] = local.positionUnits, focal = viewport.focalPixels, [ox, oy] = viewport.principalOffsetPixels;
    const halfWidth = (viewport.widthPixels ?? Infinity) / 2, halfHeight = (viewport.heightPixels ?? Infinity) / 2;
    const paintedHalfWidth = halfWidth * (1 + 2 * overscan), paintedHalfHeight = halfHeight * (1 + 2 * overscan);
    const [r0, r1, r2, r3, r4, r5, r6, r7, r8] = r as unknown as [number, number, number, number, number, number, number, number, number];
    // The occluder's plane from the camera: a sight line `camera + t offset` crosses it at t = side / (normal · offset).
    const [onx, ony, onz] = occluder?.normal ?? [0, 0, 0], [ocx, ocy, ocz] = occluder?.centreUnits ?? [0, 0, 0];
    const side = onx * (ocx - px) + ony * (ocy - py) + onz * (ocz - pz), occluderRadius = occluder?.radiusUnits ?? 0;
    for (const paint of paints.values()) paint.begin(viewport);
    parts.forEach((part, partIndex) => {
      const partStarted = performance.now();
      const { positions, paths, occludedPaths, margins, ranks, cellCount, cellStart, order, boxes, culled, paint, cells } = part;
      const count = counts[partIndex]!, keep = keeps[partIndex]!, hiddenSet = hiddens[partIndex]!;
      let visible = 0, candidates = 0;
      // A cell is out of view when all of its box is behind the camera or beyond one edge of the painted view and its
      // margins (a plane through the camera for each edge). The test is on the box, so it never drops a point the point
      // test below would keep; a relative tolerance keeps rounding on the box's side.
      const edgeX = paintedHalfWidth + part.widestMargin, edgeY = paintedHalfHeight + part.widestMargin;
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
          if (path < 0 || hiddenSet?.has(index)) continue;
          const depth = -(r2 * x + r5 * y + r8 * z);
          if (depth <= 0) continue;
          const sx = focal * (r0 * x + r3 * y + r6 * z) / depth + ox, sy = focal * (r1 * x + r4 * y + r7 * z) / depth + oy;
          const margin = margins[index]!;
          if (Math.abs(sx) > paintedHalfWidth + margin || Math.abs(sy) > paintedHalfHeight + margin) continue;
          // The share and the counts are of the view; the overscan only paints ahead of a turn.
          const inView = Math.abs(sx) <= halfWidth + margin && Math.abs(sy) <= halfHeight + margin;
          if (inView) candidates++;
          if (keep < 1 && ranks[index]! >= keep) continue;
          let target = path;
          if (occluder) {
            const along = onx * x + ony * y + onz * z, t = along === 0 ? -1 : side / along;
            if (t > 0 && t < 1) {
              const hx = px + t * x - ocx, hy = py + t * y - ocy, hz = pz + t * z - ocz, share = (hx * hx + hy * hy + hz * hz) / (occluderRadius * occluderRadius);
              if (share < 1) {
                const step = Math.floor((1 - (1 - share) * (1 - share)) * OCCLUDED_STEPS);
                if (step < OCCLUDED_STEPS) target = occludedPaths[step]![index]!;
              }
            }
          }
          paint.add(target, sx, sy);
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
      part.last = { visiblePoints: visible, candidates, skippedCells: culledCount, residentElements, publishMs: performance.now() - partStarted };
    });
    for (const paint of paints.values()) paint.commit();
    const nearestUnits = Math.sqrt(nearestSquared);
    // Counts for probes and tests, kept here: a per-frame dataset write is a DOM write (motion-freezes-membership.md).
    painted = { position: [...local.positionUnits], rest, counts, nearestUnits, keeps, hiddens, width, height, overscan };
    layer.painted(member, publication, forced ?? { travelling, settled: settling });
  };
  const member: PointLayerMember = {
    shown: () => shown && !destroyed,
    painted: () => painted,
    repaint(publication, reason) {
      if (reason.settled && settle !== null) { clearTimeout(settle); settle = null; }
      publish(publication, reason.settled, reason);
      if (reason.settled) onSettle?.();
    },
  };
  const leave = layer.join(member);
  return Object.freeze({ root,
    /** The layer's svg, which a warp moves; other fields may paint into it too. */
    svg: layer.svg,
    /** Each part's group, whose opacity dims it, and its counts from the last paint. */
    parts: Object.freeze(parts.map(part => Object.freeze({ group: part.paint.part, stats: () => Object.freeze({ ...part.last }) }))),
    publish: (publication: VolumeCameraPublication) => { shown = true; publish(publication); },
    /** The owner hid these dots: until the next publication the layer's other fields do not repaint them, and the paints
     * this field still owed (the exact one after a pause, the dots a zoom added) are dropped. Made after the hiding, they
     * were made from the camera the field last saw, and took the layer's showing fields back to that camera with them:
     * a field hidden during a turn that stopped within the pause left the others painted a degree behind, 16 px at a
     * 900 px focal length, until the camera next moved. */
    hide() { shown = false; arriving = false; if (settle !== null) { clearTimeout(settle); settle = null; } },
    /** Resolve up to `limit` more points of the parts still waiting (deferFill), in part order; 0 once every part is
     * ready. A part that becomes ready draws on the next publication. */
    fill(limit: number): number {
      const whole = Math.max(1, Math.floor(limit));
      let done = 0;
      for (const part of parts) { if (part.ready) continue; done += part.resolve(whole - done); if (done >= whole) break; }
      return done;
    },
    /** The whole field's counts from the last paint. */
    stats: () => Object.freeze(total()),
    destroy() { if (destroyed) return; destroyed = true; if (settle !== null) clearTimeout(settle); arrivals.destroy(); leave(); if (own) own.release(); else root.remove(); } });
}
