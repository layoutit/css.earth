import { createLabelDeclutter } from '@cssearth/engine';
import type { PositionM } from '@cssearth/engine';
import type { PreparedWorldContext } from './prepared-world-context.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { rotateWorldPosition, transposeWorldRotation, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import { levelOfDetailFor } from '../navigation/perspective-dolly.js';
import { contextOrbitOpacity } from './context-presentation-policy.js';
import { rayHitsSphereBefore } from '../solar-system/heliocentric-geometry.js';
import { createPreparedRingProjector, createRetainedRingProjection, orbitBoundsMayContribute, projectedSphereDiameter } from '../solar-system/prepared-ring-projection.js';
import type { OrbitSegment } from '../solar-system/types.js';
import { createWorldFrameProjection } from './world-frame-projection.js';
import { createLabelBudget, labelExtentOpacity } from '../labels/universe-label-policy.js';

export const BODY_INDICATOR_DIAMETER = 16;
export const CONTEXT_LINE_WIDTH = 1;
const ORBIT_FADE_START_PIXELS = 12, ORBIT_FULL_PIXELS = 48;
const ORBIT_LOD_PIXELS = 0.1;
// Keep the existing exit thresholds. A hidden annotation must clear a small
// entry margin before returning, so a boundary cannot reverse its fade each
// camera sample. This uses committed visibility, never worker-local history.
const ANNOTATION_ENTRY_MARGIN = .05;

function orbitPresentation(segments: readonly OrbitSegment[] | number) {
  if (typeof segments === 'number') return orbitPresentationForExtent(segments);
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const [x0, y0, x1, y1] of segments) {
    left = Math.min(left, x0, x1); right = Math.max(right, x0, x1);
    top = Math.min(top, y0, y1); bottom = Math.max(bottom, y0, y1);
  }
  return orbitPresentationForExtent(Math.max(1, right - left, bottom - top));
}

/** The extent fade in 1/64 steps: rotation changes every orbit's extent a little
 * each frame, and a step this small cannot change a composited pixel, so a body's
 * marker and orbit keep their alpha instead of restyling on every frame. */
const EXTENT_FADE_STEPS = 64;
const quantizeAlpha = (alpha: number) => Math.round(alpha * EXTENT_FADE_STEPS) / EXTENT_FADE_STEPS;
function orbitPresentationForExtent(extent: number) {
  const opacity = Math.round(logarithmicFade(extent, ORBIT_FADE_START_PIXELS, ORBIT_FULL_PIXELS) * EXTENT_FADE_STEPS) / EXTENT_FADE_STEPS;
  // Orbit paint has its own fade; label admission does not depend on this value.
  return { width: CONTEXT_LINE_WIDTH, opacity };
}

// Clip already-projected chords at the UI marker, preserving the prepared orbit.
export function orbitOutsideMarker(segments: readonly OrbitSegment[], x: number, y: number, radius: number): readonly OrbitSegment[] {
  const radiusSquared = radius ** 2;
  const result: OrbitSegment[] = [];
  for (const segment of segments) {
    const [x0, y0, x1, y1, weight] = segment;
    const dx = x1 - x0, dy = y1 - y0, sx = x0 - x, sy = y0 - y;
    const a = dx * dx + dy * dy, b = sx * dx + sy * dy;
    const discriminant = b * b - a * (sx * sx + sy * sy - radiusSquared);
    if (discriminant <= 0) { result.push(segment); continue; }
    const root = Math.sqrt(discriminant);
    const enter = Math.max(0, (-b - root) / a), leave = Math.min(1, (-b + root) / a);
    if (enter >= leave) { result.push(segment); continue; }
    if (enter * Math.sqrt(a) >= 0.05) result.push([x0, y0, x0 + dx * enter, y0 + dy * enter, weight]);
    if ((1 - leave) * Math.sqrt(a) >= 0.05) result.push([x0 + dx * leave, y0 + dy * leave, x1, y1, weight]);
  }
  return result;
}
export function logarithmicFade(distanceM: number, startM: number, endM: number): number {
  const t = Math.max(0, Math.min(1, (Math.log(distanceM) - Math.log(startM)) / (Math.log(endM) - Math.log(startM))));
  return t * t * (3 - 2 * t);
}

/** UI measurements and the last committed annotation state, without DOM handles. */
export interface WorldBodyPresentation {
  hovered: boolean;
  bodyHidden?: boolean;
  orbitHidden: boolean;
  labelHidden: boolean;
  labelSuppressed?: boolean;
  indicatorHidden?: boolean;
  /** Part of an emphasized set, such as one classification. */
  highlighted?: boolean;
  labelSize: { width: number; height: number };
  labelShown: boolean;
  labelPlacement: number;
  indicatorShown: boolean;
  indicatorRadius: number;
  orbitAppearance: { width: number; opacity: number };
}
export interface WorldContextView {
  world: WorldCameraPose;
  viewport: WorldCameraViewport;
  selectedId: string;
  overview: boolean;
  selectionPreview?: string | null;
  navigationInFlight: boolean;
  /** Keep the committed labels and indicators while the view rotates: they follow
   * their bodies, but nothing is shown, hidden or re-sided until the hold ends. */
  holdAnnotations?: boolean;
  /** Largest chord-bank deviation, in screen pixels, the paint owner accepts; default 0.1. */
  orbitLodPixels?: number;
  anchorOnly: boolean;
  bodies: readonly WorldBodyPresentation[];
  contextCommittedId?: number;
}

/** Project the prepared bank and resolve annotations without reading or writing DOM.
 * Segment buffers are borrowed until the next plan. A transport must copy/send
 * the result before requesting another view; the synchronous renderer consumes it inline. */
/** One body's share of a planned frame: paint and picking state, no planner scratch. */
export interface PlannedBodyOutput {
  x: number; y: number; diameter: number; markerOpacity: number; visible: boolean; annotationVisible: boolean; hovered: boolean;
  lineWidth: number; orbitVisibility: number; segments: readonly OrbitSegment[]; labelPosition: readonly number[] | undefined;
  orbitBounds: { left: number; top: number; right: number; bottom: number } | null;
  index: number; labelShown: boolean; labelPlacement: number; indicatorShown: boolean; indicatorCutout: boolean;
  orbitAppearance: { width: number; opacity: number };
}
interface ProjectedBody<Entry> {
  entry: Entry; x: number; y: number; depth: number; diameter: number; markerOpacity: number; indicatorOpacity: number; visible: boolean;
  annotationVisible: boolean; hovered: boolean; inFrame: boolean; priority: number; lineWidth: number; orbitVisibility: number;
  segments: readonly OrbitSegment[]; labelPosition?: readonly number[];
}
export function createWorldContextPlanner(plan: PreparedWorldContext, annotationPriorities: Readonly<Record<string, number>> = {}) {
  const points = [plan.focus, ...plan.bodies];
  const byId = new Map(points.map(point => [point.id, point]));
  const prepared = points.map(body => {
    const orbit = 'orbit' in body ? body.orbit ?? null : null;
    // Prepared detail levels are decoded once; each frame only selects one.
    const levels = !orbit ? [] : [{ vertices: orbit.verticesM, trail: orbit.trail, activeChords: orbit.activeChords, deviationM: 0 },
      ...(orbit.lod?.levels ?? []).map(level => ({ vertices: level.vertexIndices.map(index => orbit.verticesM[index]!),
        trail: level.trail, activeChords: level.activeChords, deviationM: level.deviationM }))];
    return { body, orbit, levels, parent: orbit ? byId.get(orbit.centerBodyId) ?? null : null,
      closedOrbit: orbit?.trail.every(weight => weight === 1) === true,
      orbitProjection: createRetainedRingProjection(orbit ? orbit.verticesM.length * 2 : 0),
      // A hidden body is the same retired stub every frame: no projection, no allocation, no packet.
      hiddenStub: null as null | { projected: ProjectedBody<unknown> },
      // Per-frame working objects are retained per body: the view's fields are
      // assigned over them instead of spreading 470 new objects every frame.
      state: null as unknown, projected: null as ProjectedBody<unknown> | null,
      output: null as PlannedBodyOutput | null, bounds: { left: 0, top: 0, right: 0, bottom: 0 } };
  });
  const labels = createLabelDeclutter({ capacity: points.length, spacingPixels: 4 });
  const indicators = createLabelDeclutter({ capacity: points.length, spacingPixels: 2 });
  return (view: WorldContextView) => {
    const { world, viewport, selectedId, overview, selectionPreview, navigationInFlight, holdAnnotations = false } = view;
    if (world.referenceFrame !== plan.frame.referenceFrame || world.epochJdTt !== plan.frame.epochJdTt ||
        view.bodies.length !== prepared.length || !(viewport.widthPixels! > 0 && viewport.heightPixels! > 0)) {
      throw new TypeError('World context planning requires a matching frame, body state and measured viewport.');
    }
    const bodies = prepared.map((entry, index) => {
      const state = (entry.state ??= { ...entry, ...view.bodies[index], index, indicatorCutout: false }) as typeof entry & WorldBodyPresentation & { index: number; indicatorCutout: boolean };
      Object.assign(state, view.bodies[index]); state.indicatorCutout = false;
      return state;
    });
    const selectedEntry = bodies.find(entry => entry.body.id === selectedId);
    if (!selectedEntry) throw new TypeError('Selected context body is unavailable.');
    const publishingBodies = view.anchorOnly ? bodies.slice(0, 1) : bodies;
    const distanceM = Math.hypot(...world.pose.positionM.map((value, axis) => value - plan.focus.positionM[axis]));
    const opacity = 1 - logarithmicFade(distanceM, plan.system.fadeOutStartDistanceM, plan.system.hiddenDistanceM);
    const rotation = transposeWorldRotation(worldRotationFromQuaternion(world.pose.orientationXyzw));
    labels.reset(); indicators.reset();
      const toEye = (position: readonly number[]): PositionM => rotateWorldPosition(rotation, [
        position[0] - world.pose.positionM[0], position[1] - world.pose.positionM[1], position[2] - world.pose.positionM[2]]);
      const emphasizedId = selectionPreview === undefined ? (overview ? null : selectedId) : selectionPreview;
      const [ox, oy] = viewport.principalOffsetPixels;
      const focal = viewport.focalPixels;
      // Publication shares the camera owner's resize snapshot. Reading layout
      // here would flush the preceding sky/shell writes on every flight frame.
      const width = viewport.widthPixels!;
      const height = viewport.heightPixels!;
      const project = (eye: readonly number[]): readonly number[] => [ox + focal * eye[0] / -eye[2], oy + focal * eye[1] / -eye[2]];
      const selected = selectedEntry.body;
      const frame = createWorldFrameProjection(plan.focus, selected, toEye, project);
      const selectedEye = frame.eye(selected);
      const focusDiameter = selectedEye[2] < -selected.radiusM
        ? 2 * focal * selected.radiusM / Math.sqrt(selectedEye[2] ** 2 - selected.radiusM ** 2) : Number.POSITIVE_INFINITY;
      const lod = levelOfDetailFor(plan.camera.presentation.levelOfDetail, focusDiameter);
      const orbitOpacity = contextOrbitOpacity(plan.camera.presentation.orbitLineFade, focusDiameter / height);
      const near = opacity > 0 && orbitOpacity > 0
        ? Math.max(1, Math.min(...bodies.map(entry => Math.hypot(...frame.eye(entry.body)))) * 0.01) : 1;
      // The coarsest prepared chord bank within 0.1 px of the full path, bounded at
      // the orbit's nearest depth with the off-axis perspective margin. Selection
      // depends on this view alone; a change between banks is below 0.1 px.
      const pixelsPerMeterAtUnitDepth = focal + Math.hypot(width / 2 + Math.abs(ox), height / 2 + Math.abs(oy));
      const detailLevel = (entry: (typeof bodies)[number]) => {
        const lod = entry.orbit?.lod;
        if (!lod) return 0;
        const nearest = -toEye(lod.bounds.centerM)[2] - lod.bounds.radiusM;
        if (nearest > near) for (let level = entry.levels.length - 1; level > 0; level--) {
          if (entry.levels[level]!.deviationM * pixelsPerMeterAtUnitDepth / nearest <= (view.orbitLodPixels ?? ORBIT_LOD_PIXELS)) return level;
        }
        return 0;
      };
      // A moon's orbit belongs to its planet's system. It is planned only while that
      // system is selected or previewed (the planet, the moon or a sibling), or on
      // hover; elsewhere it has no visible pixels and only its extent is measured.
      const activeSystems = new Set<string>();
      for (const id of [selectedId, emphasizedId]) if (id) {
        activeSystems.add(id);
        const point = byId.get(id), center = point && 'orbit' in point ? point.orbit?.centerBodyId : undefined;
        if (center) activeSystems.add(center);
      }
      let anchorLineWidth = CONTEXT_LINE_WIDTH;
      // Declutter annotations without changing physical bodies or projected orbits.
      type Entry = (typeof bodies)[number];
      const projectedBodies: ProjectedBody<Entry>[] = [];
      for (const entry of publishingBodies) {
        const { body } = entry;
        if (entry.bodyHidden) {
          // A hidden body's changing depth has no consumer. Keeping its
          // retirement state stable avoids a worker patch on every camera move.
          const stub = (prepared[entry.index]!.hiddenStub ??= { projected: { entry, x: 0, y: 0, depth: 0, diameter: 0, markerOpacity: 0, indicatorOpacity: 0,
            visible: false, annotationVisible: false, hovered: false, inFrame: false, priority: 0,
            lineWidth: CONTEXT_LINE_WIDTH, orbitVisibility: 0, segments: [] } });
          stub.projected.entry = entry;
          projectedBodies.push(stub.projected as ProjectedBody<Entry>);
          continue;
        }
        const eye = frame.eye(body), depth = -eye[2];
        const occlusion = frame.occlusion(entry.parent);
        const [x, y] = project(eye);
        const diameter = depth > body.radiusM ? 2 * focal * body.radiusM / Math.sqrt(depth * depth - body.radiusM ** 2) : Infinity;
        const isSelected = !overview && body.id === selectedId;
        const isAnchor = body.id === plan.focus.id;
        const inFrame = depth > body.radiusM && Math.abs(x) < width / 2 && Math.abs(y) < height / 2;
        const visible = inFrame && !occlusion.hidden(eye, body.id);
        // The one retained anchor indicator is also the galactic locator.
        // Unresolved foreground points cannot occlude this annotation; physical sprites keep exact occlusion.
        const annotationVisible = isAnchor ? inFrame && !(selectedId !== body.id &&
          focusDiameter >= plan.camera.presentation.levelOfDetail.markerFullDiscPixels &&
          rayHitsSphereBefore(eye, selectedEye, selected.radiusM)) : visible;
        const hovered = entry.hovered, highlighted = entry.highlighted === true;
        // Satellites keep the complete, uniform path from the shared policy,
        // including selection previews and hover during navigation.
        const satellite = entry.parent !== null && entry.parent.id !== plan.focus.id;
        const fullOrbit = satellite || hovered;
        const inactiveMoon = satellite && !hovered && !activeSystems.has(entry.parent!.id);
        let skipped = !hovered && entry.orbitHidden;
        // Prepared trail bounds enclose the faded trail; a complete orbit uses the
        // prepared sphere around every vertex. Either way a path that cannot reach
        // the fade's first visible extent inside the viewport is not projected.
        const bounds = fullOrbit ? entry.orbit?.lod?.bounds : entry.orbit?.bounds;
        const boundsEye = bounds ? toEye(bounds.centerM) : null;
        let segments: readonly OrbitSegment[] = [], measuredExtent: number | null = null;
        if (entry.orbit && opacity > 0 && orbitOpacity > 0 &&
            (!bounds || orbitBoundsMayContribute(boundsEye!, bounds.radiusM, focal, [ox, oy], near, width / 2, height / 2, ORBIT_FADE_START_PIXELS))) {
          const projector = createPreparedRingProjector({ toEye, project, hidden: occlusion.hidden,
            mayOcclude: occlusion.mayOcclude,
            near, clipX: width / 2, clipY: height / 2 });
          if (skipped || inactiveMoon) {
            // Hidden paths have no geometry consumer. Their proxies still need
            // the exact existing fade, which saturates at 48 CSS pixels. A moon
            // outside the active system is drawn only once fully readable.
            // The prepared sphere bounds every measured vertex, so a sphere whose
            // projected diameter cannot reach the fade's first visible pixel needs
            // no projection at all: hundreds of small hidden orbits skip here.
            const sphereDiameter = bounds && boundsEye ? projectedSphereDiameter(boundsEye, bounds.radiusM, focal, near) : Infinity;
            measuredExtent = sphereDiameter < ORBIT_FADE_START_PIXELS ? Math.max(1, sphereDiameter)
              : projector.measureExtent(entry.orbit.verticesM, entry.orbit.trail,
                ORBIT_FULL_PIXELS, entry.orbit.extentChords ?? entry.orbit.activeChords, entry.orbit.closed !== false);
            if (measuredExtent < ORBIT_FULL_PIXELS) skipped = true;
          }
          if (!skipped) {
            measuredExtent = null;
            const level = entry.levels[detailLevel(entry)]!;
            segments = projector(level.vertices, level.trail, level.activeChords, fullOrbit, entry.orbitProjection, entry.orbit.closed !== false);
          }
        }
        if (entry.orbit) entry.orbitAppearance = orbitPresentation(measuredExtent ?? segments);
        const appearance = entry.orbitAppearance;
        const bodyLod = levelOfDetailFor(plan.camera.presentation.levelOfDetail, diameter);
        const proxyOpacity = 1 - bodyLod.markerOpacity * (1 - appearance.opacity);
        const markerOpacity = (isSelected ? lod.proxyOpacity : 1) *
          (isAnchor ? 1 : opacity * (isSelected ? 1 : proxyOpacity));
        const orbitVisibility = skipped ? 0 : appearance.opacity * orbitOpacity * opacity;
        if (entry.orbit && orbitVisibility > 0) anchorLineWidth = Math.max(anchorLineWidth, appearance.width);
        const neighbourhoodExtent = entry.parent ? Math.hypot(...body.positionM.map((value, axis) => value - entry.parent!.positionM[axis]!)) * focal /
          Math.max(1, -frame.eye(entry.parent)[2]) : Infinity;
        const indicatorOpacity = entry.indicatorHidden && !hovered ? 0 : isAnchor && overview ? 1 :
          bodyLod.markerOpacity * (isAnchor ? 1 : opacity * (hovered || highlighted || isSelected || body.id === emphasizedId ? 1 : labelExtentOpacity(neighbourhoodExtent)));
        const primary = !entry.orbit || entry.orbit.centerBodyId === plan.focus.id;
        const priority = (isAnchor ? 4e6 : 0) + (hovered ? 16e6 : 0) + (highlighted ? 8e6 : 0) + (body.id === emphasizedId ? 6e6 : (overview ? isAnchor : isSelected) ? 1e6 : 0) + (annotationPriorities[body.id] ?? 0) * 1e4 + (primary ? 1000 : 0) + Math.min(99, diameter);
        if (!holdAnnotations && annotationVisible && indicatorOpacity > (entry.indicatorShown ? 0 : ANNOTATION_ENTRY_MARGIN)) {
          const radius = BODY_INDICATOR_DIAMETER / 2, padding = entry.indicatorShown ? 0 : 2;
          indicators.add({ owner: 0, id: body.id, priority: priority + (entry.indicatorShown ? 100 : 0),
            anchor: [x, y], widthPx: BODY_INDICATOR_DIAMETER + padding * 2,
            bottomOffsetPx: -radius - padding, topOffsetPx: radius + padding });
        }
        const projected = (prepared[entry.index]!.projected ??= { entry, x: 0, y: 0, depth: 0, diameter: 0, markerOpacity: 0, indicatorOpacity: 0, visible: false,
          annotationVisible: false, hovered: false, inFrame: false, priority: 0, lineWidth: 0, orbitVisibility: 0, segments: [] }) as ProjectedBody<Entry>;
        projected.entry = entry; projected.x = x; projected.y = y; projected.depth = depth; projected.diameter = diameter; projected.markerOpacity = markerOpacity;
        projected.indicatorOpacity = indicatorOpacity; projected.visible = visible; projected.annotationVisible = annotationVisible; projected.hovered = hovered;
        projected.inFrame = inFrame; projected.priority = priority; projected.lineWidth = appearance.width; projected.orbitVisibility = orbitVisibility;
        projected.segments = segments; projected.labelPosition = undefined;
        projectedBodies.push(projected);
      }
      // An orbitless anchor uses the same stroke as the visible system, then thins as it recedes.
      projectedBodies[0].lineWidth = anchorLineWidth;
      indicators.resolve();
      for (const projected of projectedBodies) {
        const { entry, x, y, indicatorOpacity, segments } = projected;
        if (!holdAnnotations) entry.indicatorShown = indicators.accepted(0, entry.body.id);
        const orbitVisibility = projected.orbitVisibility;
        if (!entry.orbit) continue;
        const visibleSegments = orbitVisibility > 0 ? segments : [];
        entry.indicatorCutout = entry.indicatorShown && (!navigationInFlight || emphasizedId === null || entry.body.id === emphasizedId || entry.parent?.id === emphasizedId);
        const clipped = entry.indicatorCutout
          ? orbitOutsideMarker(visibleSegments, x, y, entry.indicatorRadius) : visibleSegments;
        projected.segments = clipped;
      }
      const placedLabels: { left: number; right: number; top: number; bottom: number }[] = [];
      const labelBudget = createLabelBudget(width, height);
      const labelPriority = (body: (typeof projectedBodies)[number]) => body.priority + (body.entry.labelShown ? 100 : 0);
      for (const projected of [...projectedBodies].sort((a, b) => labelPriority(b) - labelPriority(a))) {
        const { entry, x, y, diameter, markerOpacity, indicatorOpacity, annotationVisible, hovered, priority, orbitVisibility } = projected;
        const { body, labelSize: size } = entry;
        const satellite = entry.parent !== null && entry.parent.id !== plan.focus.id;
        const resolvedDisc = diameter >= plan.camera.presentation.levelOfDetail.markerFadeStartDiscPixels;
        // A highlighted set shows its labels despite default hiding, and keeps a label whose
        // circle lost a collision; label collisions still decide placement.
        const highlighted = entry.highlighted === true;
        const labelOpacity = hovered || highlighted ? 1 : markerOpacity;
        const localExtent = entry.parent ? Math.hypot(...body.positionM.map((value, axis) => value - entry.parent!.positionM[axis]!)) * focal /
          Math.max(1, -frame.eye(entry.parent)[2]) : Infinity;
        const targeted = hovered || highlighted || body.id === emphasizedId;
        // A planet view labels its own moon family. Small unrelated bodies wait
        // for a system view, a resolved disc, or explicit selection/highlight.
        const inContext = !satellite || activeSystems.has(entry.parent!.id);
        const foregroundSystem = selectedId !== plan.focus.id && !overview;
        const unrelatedMinor = !satellite && body.id !== plan.focus.id && foregroundSystem && (annotationPriorities[body.id] ?? 2) < 2;
        const labelThreshold = entry.labelShown ? .5 : .5 + ANNOTATION_ENTRY_MARGIN;
        const gap = Math.max(5, diameter / 2, entry.indicatorShown ? BODY_INDICATOR_DIAMETER / 2 : 0) + 4;
        // Right, left, above and below; a highlighted set may also use the four diagonals,
        // so more names fit around a crowded point such as a moon family.
        const positions = [[x + gap, y - size.height / 2], [x - gap - size.width, y - size.height / 2],
          [x - size.width / 2, y - gap - size.height], [x - size.width / 2, y + gap],
          [x + gap, y - gap - size.height], [x + gap, y + gap],
          [x - gap - size.width, y - gap - size.height], [x - gap - size.width, y + gap]];
        if (holdAnnotations) {
          // A held label keeps its committed side and follows its body.
          if (entry.labelShown && size.width > 0) projected.labelPosition = positions[entry.labelPlacement] ?? positions[0];
          continue;
        }
        if (entry.labelSuppressed || !annotationVisible || size.width === 0 ||
            (!targeted && !resolvedDisc && (!inContext || unrelatedMinor || labelExtentOpacity(localExtent) <= .5)) || (!hovered && !highlighted &&
            ((entry.labelHidden && body.id !== emphasizedId) || labelOpacity <= labelThreshold ||
            (indicatorOpacity > 0 && !entry.indicatorShown)))) continue;
        const sides = highlighted ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 1, 2, 3];
        const padding = entry.labelShown ? 0 : 2;
        const labelRect = (lx: number, ly: number) => ({ left: lx - padding, top: ly - padding,
          right: lx + size.width + padding, bottom: ly + size.height + padding });
        // Keep a clear placement stable; try other sides before hiding a label.
        const placements = body.id === plan.focus.id ? [3] :
          diameter >= plan.camera.presentation.levelOfDetail.billboardFullDiscPixels ? [3, 2, 0, 1] :
          [...(sides.includes(entry.labelPlacement) ? [entry.labelPlacement] : []), ...sides.filter(index => index !== entry.labelPlacement)];
        const withinViewport = (index: number) => {
          const [lx, ly] = positions[index];
          const margin = 4 + (hovered ? 0 : padding);
          return lx >= -width / 2 + margin && lx + size.width <= width / 2 - margin &&
            ly >= -height / 2 + margin && ly + size.height <= height / 2 - margin;
        };
        const placement = placements.find(index => {
          const [lx, ly] = positions[index];
          return withinViewport(index) &&
            !placedLabels.some(other => {
              const rect = labelRect(lx, ly);
              return rect.left < other.right + 4 && rect.right + 4 > other.left &&
                rect.top < other.bottom + 4 && rect.bottom + 4 > other.top;
            }) && labelBudget.accepts(labelRect(lx, ly)) &&
            !projectedBodies.some(other => {
              if (other.entry === entry || !other.entry.indicatorShown || other.indicatorOpacity <= .1) return false;
              const nearestX = Math.max(lx, Math.min(lx + size.width, other.x));
              const nearestY = Math.max(ly, Math.min(ly + size.height, other.y));
              return Math.hypot(nearestX - other.x, nearestY - other.y) < BODY_INDICATOR_DIAMETER / 2 + 4 + padding;
            });
        }) ?? (hovered ? placements.find(withinViewport) ?? placements[0] : undefined);
        if (placement === undefined) continue;
        entry.labelPlacement = placement;
        let [labelX, labelY] = positions[placement];
        if (hovered) {
          labelX = Math.max(-width / 2 + 4, Math.min(labelX, width / 2 - size.width - 4));
          labelY = Math.max(-height / 2 + 4, Math.min(labelY, height / 2 - size.height - 4));
        }
        if (!labelBudget.admit(labelRect(labelX, labelY))) continue;
        placedLabels.push(labelRect(labelX, labelY));
        labels.add({ owner: 0, id: body.id, priority: priority + (entry.labelShown ? 100 : 0),
          anchor: [labelX + size.width / 2, labelY + size.height + padding],
          widthPx: size.width + padding * 2, bottomOffsetPx: 0, topOffsetPx: size.height + padding * 2 });
        projected.labelPosition = [labelX, labelY];
      }
      labels.resolve();
      if (!holdAnnotations) for (const projected of projectedBodies) {
        projected.entry.labelShown = labels.accepted(0, projected.entry.body.id);
      }
    // The transport carries paint/picking state, not the planner's scratch
    // values. Off-screen marker motion has no consumer; reveal sends its
    // current position and alpha in the same packet as visibility.
    // The transport object of each body is retained and overwritten: the worker
    // clones the changed fields into its packet, so nothing keeps these references.
    const plannedBody = (projected: ProjectedBody<Entry>): PlannedBodyOutput => {
      const { entry } = projected, slot = prepared[entry.index]!;
      const billboardShown = (projected.visible || (projected.annotationVisible &&
        (entry.indicatorShown || entry.labelShown))) && projected.markerOpacity > 0;
      const output = slot.output ??= { x: 0, y: 0, diameter: 0, markerOpacity: 0, visible: false, annotationVisible: false, hovered: false, lineWidth: 0,
        orbitVisibility: 0, segments: [], labelPosition: undefined, orbitBounds: null, index: entry.index, labelShown: false, labelPlacement: 0,
        indicatorShown: false, indicatorCutout: false, orbitAppearance: entry.orbitAppearance };
      output.x = billboardShown ? projected.x : 0; output.y = billboardShown ? projected.y : 0;
      // Alphas travel in 1/64 steps: every rotation frame moves a marker's silhouette a
      // little, and a step this small cannot change a composited pixel, so unchanged
      // steps neither cross the worker boundary nor restyle the marker's cue and caption.
      output.diameter = billboardShown ? projected.diameter : 0; output.markerOpacity = billboardShown ? quantizeAlpha(projected.markerOpacity) : 0;
      output.visible = projected.visible; output.annotationVisible = projected.annotationVisible; output.hovered = projected.hovered;
      output.lineWidth = projected.lineWidth; output.orbitVisibility = quantizeAlpha(projected.orbitVisibility); output.segments = projected.segments;
      output.labelPosition = projected.labelPosition;
      output.orbitBounds = orbitBounds(projected.segments, slot.bounds);
      output.labelShown = entry.labelShown; output.labelPlacement = entry.labelPlacement; output.indicatorShown = entry.indicatorShown;
      output.indicatorCutout = entry.indicatorCutout; output.orbitAppearance = entry.orbitAppearance;
      return output;
    };
    return { emphasizedId, opacity, width, height, projectedBodies: projectedBodies.map(plannedBody) };
  };
}
export type PlannedWorldContext = ReturnType<ReturnType<typeof createWorldContextPlanner>>;

/** The picking bounds of the final clipped chords, including the marker cutout,
 * written into the body's retained bounds object; the paint owner formats the strokes. */
function orbitBounds(segments: readonly OrbitSegment[], into: NonNullable<PlannedBodyOutput['orbitBounds']>) {
  if (segments.length === 0) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x0, y0, x1, y1] of segments) {
    left = Math.min(left, x0, x1); right = Math.max(right, x0, x1);
    top = Math.min(top, y0, y1); bottom = Math.max(bottom, y0, y1);
  }
  into.left = left; into.top = top; into.right = right; into.bottom = bottom;
  return into;
}
