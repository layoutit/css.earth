import type { PositionM } from '@cssearth/engine';
import type { PreparedWorldContext, PreparedWorldContextGeometry } from './prepared-world-context.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { cssViewFromOrientation, rotateWorldPosition } from '../navigation/world-camera-math.js';
import { levelOfDetailFor } from '../navigation/perspective-dolly.js';
import { contextOrbitOpacity, selectedOrbitDepthFade } from './context-presentation-policy.js';
import { rayHitsSphereBefore } from '../solar-system/heliocentric-geometry.js';
import { createPreparedRingProjector, createRetainedRingProjection, orbitBoundsMayContribute, projectedSphereDiameter, orbitProjectionCapacity } from '../solar-system/prepared-ring-projection.js';
import type { OrbitSegment } from '../solar-system/types.js';
import { createWorldFrameProjection } from './world-frame-projection.js';
import { admitStableLabels, type StableLabelCandidate } from '../labels/stable-label-layout.js';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { createLabelBudget, labelExtentOpacity, labelLimit, UNIVERSE_LABEL_POLICY } from '../labels/universe-label-policy.js';

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
  /** Preserve the committed annotation membership and placement during a camera drag. */
  rotationActive?: boolean;
  /** Preserve the last moving frame through the first settled publication. */
  preserveCommittedAnnotations?: boolean;
  /** External exclusion data retained for transport compatibility; world annotations ignore shell footprints. */
  labelBlockers?: readonly LabelScreenRect[];
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
  entry: Entry; x: number; y: number; depth: number; diameter: number; markerOpacity: number; circle: boolean; visible: boolean;
  annotationVisible: boolean; hovered: boolean; inFrame: boolean; priority: number; lineWidth: number; orbitVisibility: number;
  /** The body reaches this camera's naming policy, whether or not a caption slot was free for it. */
  nameable: boolean;
  segments: readonly OrbitSegment[]; labelPosition?: readonly number[];
}
/** Each planetary system fades with the camera's distance from its own star: the Sun's
 * and every placed star with orbiting bodies. The context retires once all of them have. */
export function createSystemFade(plan: Pick<PreparedWorldContext, 'focus' | 'bodies' | 'orbitCenters' | 'system'>) {
  const points = [plan.focus, ...plan.bodies];
  const byId = new Map(points.map(point => [point.id, point]));
  const parentOf = (id: string) => {
    const point = byId.get(id);
    return point && 'orbit' in point ? point.orbit?.centerBodyId : plan.orbitCenters?.[id]?.centerBodyId;
  };
  const rootOf = (id: string) => {
    for (let current = id, steps = 0; steps <= points.length + Object.keys(plan.orbitCenters ?? {}).length; steps++) {
      const parent = parentOf(current);
      if (parent === undefined) return current;
      current = parent;
    }
    throw new TypeError(`${id} has a cyclic orbit chain.`);
  };
  const rootIds = points.map(point => rootOf(point.id));
  const roots = [...new Set([plan.focus.id, ...rootIds.filter((id, index) => id !== points[index]!.id)])];
  const positions = roots.map(id => byId.get(id)!.positionM);
  const rootIndex = rootIds.map(id => roots.indexOf(id));
  const values = new Float64Array(roots.length);
  return Object.freeze({
    /** The largest system opacity, after measuring every system from this camera position. */
    update(positionM: readonly number[]) {
      let maximum = 0;
      for (let index = 0; index < roots.length; index++) {
        const star = positions[index]!;
        values[index] = 1 - logarithmicFade(Math.hypot(positionM[0]! - star[0], positionM[1]! - star[1], positionM[2]! - star[2]),
          plan.system.fadeOutStartDistanceM, plan.system.hiddenDistanceM);
        maximum = Math.max(maximum, values[index]!);
      }
      return maximum;
    },
    /** The opacity of the system the indexed context point belongs to; a star outside every system is never faded. */
    of(pointIndex: number) { const root = rootIndex[pointIndex]!; return root < 0 ? 1 : values[root]!; },
    /** A system's star: the focus or a placed star that bodies orbit. */
    isSystemStar(id: string) { return roots.includes(id); },
  });
}

export function createWorldContextPlanner(plan: PreparedWorldContextGeometry, annotationPriorities: Readonly<Record<string, number>> = {}) {
  const points = [plan.focus, ...plan.bodies];
  const byId = new Map(points.map(point => [point.id, point]));
  const systemFade = createSystemFade(plan);
  const prepared = points.map(body => {
    const orbit = 'orbit' in body ? body.orbit ?? null : null;
    // Prepared detail levels are decoded once; each frame only selects one.
    const levels = !orbit ? [] : [{ vertices: orbit.verticesM, trail: orbit.trail, activeChords: orbit.activeChords, deviationM: 0 },
      // Each coarser level gathers its selected vertices once, into its own flat array.
      ...(orbit.lod?.levels ?? []).map(level => ({ vertices: Float64Array.from({ length: level.vertexIndices.length * 3 },
        (_, slot) => orbit.verticesM[level.vertexIndices[Math.floor(slot / 3)]! * 3 + slot % 3]!),
        trail: level.trail, activeChords: level.activeChords, deviationM: level.deviationM }))];
    return { body, orbit, levels, parent: orbit ? byId.get(orbit.centerBodyId) ?? null : null,
      closedOrbit: orbit?.fullTrail === true,
      orbitProjection: createRetainedRingProjection(orbit ? orbit.vertexCount * 2 : 0),
      // A hidden body is the same retired stub every frame: no projection, no allocation, no packet.
      hiddenStub: null as null | { projected: ProjectedBody<unknown> },
      // Per-frame working objects are retained per body: the view's fields are
      // assigned over them instead of spreading 470 new objects every frame.
      state: null as unknown, projected: null as ProjectedBody<unknown> | null,
      output: null as PlannedBodyOutput | null, bounds: { left: 0, top: 0, right: 0, bottom: 0 } };
  });
  // Only the selected path fades with depth; one shared scratch pool serves it.
  const selectedOrbitProjection = createRetainedRingProjection(Math.max(0, ...prepared.map(entry => orbitProjectionCapacity(entry.orbit?.vertexCount ?? 0))));
  return (view: WorldContextView) => {
    const { world, viewport, selectedId, overview, selectionPreview, navigationInFlight,
      rotationActive = false, preserveCommittedAnnotations = false } = view;
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
    // Once the system retires, the anchor and every placed orbitless body (a star) stay as galactic locators.
    const publishingBodies = view.anchorOnly ? bodies.filter(entry => entry.index === 0 || entry.orbit === null) : bodies;
    const opacity = systemFade.update(world.pose.positionM);
    const focusDistanceM = Math.hypot(
      world.pose.positionM[0] - plan.focus.positionM[0],
      world.pose.positionM[1] - plan.focus.positionM[1],
      world.pose.positionM[2] - plan.focus.positionM[2],
    );
    const rotation = cssViewFromOrientation(world.pose.orientationXyzw);
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
      // A departed focus can cross the eye plane while its detail still owns
      // selection. Its unprojectable diameter is not a screen-filling disc:
      // only a visible focus may fade the surrounding orbit field.
      const [selectedX, selectedY] = project(selectedEye);
      const focusInView = selectedEye[2] < -selected.radiusM &&
        Math.abs(selectedX) < width / 2 + focusDiameter / 2 &&
        Math.abs(selectedY) < height / 2 + focusDiameter / 2;
      const orbitOpacity = contextOrbitOpacity(plan.camera.presentation.orbitLineFade, focusInView ? focusDiameter / height : 0);
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
      // Declutter annotations without changing physical bodies. Orbit geometry is
      // projected first, then retired when an on-screen body loses annotation admission.
      type Entry = (typeof bodies)[number];
      const projectedBodies: ProjectedBody<Entry>[] = [];
      for (const entry of publishingBodies) {
        const { body } = entry;
        const isSelected = !overview && body.id === selectedId;
        const systemOpacity = systemFade.of(entry.index);
        // Category visibility never removes the object the user is inspecting.
        if (entry.bodyHidden && !isSelected) {
          // A hidden body's changing depth has no consumer. Keeping its
          // retirement state stable avoids a worker patch on every camera move.
          const stub = (prepared[entry.index]!.hiddenStub ??= { projected: { entry, x: 0, y: 0, depth: 0, diameter: 0, markerOpacity: 0, circle: false,
            visible: false, annotationVisible: false, hovered: false, inFrame: false, priority: 0, nameable: false,
            lineWidth: CONTEXT_LINE_WIDTH, orbitVisibility: 0, segments: [] } });
          stub.projected.entry = entry;
          projectedBodies.push(stub.projected as ProjectedBody<Entry>);
          continue;
        }
        const eye = frame.eye(body), depth = -eye[2];
        const occlusion = frame.occlusion(entry.parent);
        const [bodyX, bodyY] = project(eye);
        const diameter = depth > body.radiusM ? 2 * focal * body.radiusM / Math.sqrt(depth * depth - body.radiusM ** 2) : Infinity;
        const isAnchor = body.id === plan.focus.id;
        const isLocator = isAnchor || entry.orbit === null;
        const stablePlanet = entry.orbit !== null && systemFade.isSystemStar(entry.orbit.centerBodyId) &&
          (annotationPriorities[body.id] ?? 0) >= 3;
        const inFrame = depth > body.radiusM && Math.abs(bodyX) < width / 2 && Math.abs(bodyY) < height / 2;
        const visible = inFrame && !occlusion.hidden(eye, body.id);
        // Planet circles and captions are orientation landmarks, not physical
        // sprites. Keep them through occultation and pin an off-screen planet to
        // the nearest stage edge; the body sprite itself remains truthful below.
        const locatorMargin = BODY_INDICATOR_DIAMETER / 2 + 4;
        const x = stablePlanet ? Math.max(-width / 2 + locatorMargin, Math.min(bodyX, width / 2 - locatorMargin)) : bodyX;
        const y = stablePlanet ? Math.max(-height / 2 + locatorMargin, Math.min(bodyY, height / 2 - locatorMargin)) : bodyY;
        // The retained locator indicators (the anchor and placed stars) are also the galactic locators.
        // Unresolved foreground points cannot occlude this annotation; physical sprites keep exact occlusion.
        const annotationVisible = stablePlanet ? depth > body.radiusM : isLocator ? inFrame && !(selectedId !== body.id &&
          focusDiameter >= plan.camera.presentation.levelOfDetail.markerFullDiscPixels &&
          rayHitsSphereBefore(eye, selectedEye, selected.radiusM)) : visible;
        const hovered = entry.hovered, highlighted = entry.highlighted === true;
        // Satellites keep the complete, uniform path from the shared policy,
        // including selection previews and hover during navigation.
        const satellite = entry.parent !== null && !systemFade.isSystemStar(entry.parent.id);
        const fullOrbit = satellite || hovered;
        const inactiveMoon = satellite && !hovered && !activeSystems.has(entry.parent!.id);
        // Open trajectories have no physical apoapsis and read as unbounded
        // guide lines at system scale. Keep them quiet until the body itself
        // is hovered; closed orbits retain their normal category policy.
        let skipped = !hovered && (entry.orbitHidden || entry.orbit?.closed === false);
        // Prepared trail bounds enclose the faded trail; a complete orbit uses the
        // prepared sphere around every vertex. Either way a path that cannot reach
        // the fade's first visible extent inside the viewport is not projected.
        const bounds = fullOrbit ? entry.orbit?.lod?.bounds : entry.orbit?.bounds;
        const boundsEye = bounds ? toEye(bounds.centerM) : null;
        let segments: readonly OrbitSegment[] = [], measuredExtent: number | null = null;
        if (entry.orbit && systemOpacity > 0 && orbitOpacity > 0 &&
            (!bounds || orbitBoundsMayContribute(boundsEye!, bounds.radiusM, focal, [ox, oy], near, width / 2, height / 2, ORBIT_FADE_START_PIXELS))) {
          const projector = createPreparedRingProjector({ toEye, project, hidden: occlusion.hidden,
            mayOcclude: occlusion.mayOcclude,
            ...(isSelected ? { depthFade: selectedOrbitDepthFade(Math.hypot(...eye)) } : {}),
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
            segments = projector(level.vertices, level.trail, level.activeChords, fullOrbit,
              isSelected ? selectedOrbitProjection : entry.orbitProjection, entry.orbit.closed !== false);
          }
        }
        if (entry.orbit) entry.orbitAppearance = orbitPresentation(measuredExtent ?? segments);
        const appearance = entry.orbitAppearance;
        const bodyLod = levelOfDetailFor(plan.camera.presentation.levelOfDetail, diameter);
        // An explicit category names bodies even when their orbits are subpixel.
        // The shared system fade and annotation collision budget still apply.
        const proxyOpacity = highlighted ? 1 : 1 - bodyLod.markerOpacity * (1 - appearance.opacity);
        const flightDestination = navigationInFlight && body.id === emphasizedId;
        const markerOpacity = (flightDestination ? bodyLod.proxyOpacity : isSelected ? lod.proxyOpacity : 1) *
          (isLocator ? 1 : systemOpacity * (isSelected || flightDestination ? 1 : proxyOpacity));
        const orbitVisibility = skipped ? 0 : appearance.opacity * orbitOpacity * systemOpacity;
        if (entry.orbit && orbitVisibility > 0) anchorLineWidth = Math.max(anchorLineWidth, appearance.width);
        // A flight destination keeps its circle until the preview hands off to detail.
        const circle = (flightDestination ? systemOpacity * bodyLod.proxyOpacity > (entry.indicatorShown ? 0 : ANNOTATION_ENTRY_MARGIN) :
          isLocator && overview || bodyLod.markerOpacity > (entry.indicatorShown ? 0 : ANNOTATION_ENTRY_MARGIN)) &&
          (!entry.indicatorHidden || hovered || isSelected);
        const primary = !entry.orbit || systemFade.isSystemStar(entry.orbit.centerBodyId);
        const priority = (isAnchor ? 1000 : isLocator ? 500 : 0) + (primary ? 100 : 0) + body.radiusM / plan.focus.radiusM;
        const projected = (prepared[entry.index]!.projected ??= { entry, x: 0, y: 0, depth: 0, diameter: 0, markerOpacity: 0, circle: false, visible: false,
          annotationVisible: false, hovered: false, inFrame: false, priority: 0, nameable: false,
          lineWidth: 0, orbitVisibility: 0, segments: [] }) as ProjectedBody<Entry>;
        projected.entry = entry; projected.x = x; projected.y = y; projected.depth = depth; projected.diameter = diameter; projected.markerOpacity = markerOpacity;
        projected.circle = circle; projected.visible = visible; projected.annotationVisible = annotationVisible; projected.hovered = hovered;
        projected.inFrame = inFrame; projected.priority = priority;
        projected.lineWidth = appearance.width; projected.orbitVisibility = orbitVisibility;
        projected.segments = segments; projected.labelPosition = undefined;
        projectedBodies.push(projected);
      }
      // Orbitless locators use the same stroke as the visible system, then thin as they recede.
      for (const projected of projectedBodies) if (projected.entry.orbit === null && (projected === projectedBodies[0] || !projected.entry.bodyHidden)) projected.lineWidth = anchorLineWidth;
      // Shell chrome never decides whether a world annotation exists. An
      // in-frame anchor is already the visibility boundary; captions are kept
      // inside the viewport below, while partially clipped circles are left to
      // normal browser clipping. The viewport width still owns density only.
      const worldLabelBudget = () => createLabelBudget(Infinity, Infinity, [], [], labelLimit(width));
      const labelBudget = worldLabelBudget();
      const candidates: (StableLabelCandidate & { projected: ProjectedBody<Entry> })[] = [];
      for (const projected of projectedBodies) {
        const { entry, x, y, diameter, annotationVisible, hovered, priority } = projected;
        let { circle } = projected;
        const { body, labelSize: size } = entry;
        const stablePlanet = entry.orbit !== null && systemFade.isSystemStar(entry.orbit.centerBodyId) &&
          (annotationPriorities[body.id] ?? 0) >= 3;
        // An edge-on orbit can briefly drive the shared proxy alpha to zero.
        // During rotation, a planet locator that is already on stays on.
        if (stablePlanet && (rotationActive || preserveCommittedAnnotations) && entry.indicatorShown) projected.markerOpacity = 1;
        const markerOpacity = projected.markerOpacity;
        const satellite = entry.parent !== null && !systemFade.isSystemStar(entry.parent.id);
        const resolvedDisc = diameter >= plan.camera.presentation.levelOfDetail.markerFadeStartDiscPixels;
        const highlighted = entry.highlighted === true;
        const targeted = hovered || highlighted || body.id === emphasizedId;
        const localExtent = entry.parent ? Math.hypot(...body.positionM.map((value, axis) => value - entry.parent!.positionM[axis]!)) * focal /
          Math.max(1, -frame.eye(entry.parent)[2]) : Infinity;
        const inContext = !satellite || activeSystems.has(entry.parent!.id);
        const foregroundSystem = !systemFade.isSystemStar(selectedId) && !overview;
        const unrelatedMinor = !satellite && body.id !== plan.focus.id && foregroundSystem && (annotationPriorities[body.id] ?? 2) < 2;
        const flightDestination = navigationInFlight && body.id === emphasizedId;
        // Prepared orientation references (the Sun, then Earth) remain usable
        // landmarks while the Solar System is still the active scale. Camera
        // altitude is much larger than the orbital radius framed on screen, so
        // the prepared system handoff—not a literal 50 AU camera distance—owns
        // this lifetime. The annotation stands alone once its orbit is subpixel.
        const referenceAnnotationOnly = focusDistanceM <= plan.system.fadeOutStartDistanceM &&
          (annotationPriorities[body.id] ?? 0) >= 4 && !resolvedDisc &&
          labelExtentOpacity(localExtent) <= .5 + ANNOTATION_ENTRY_MARGIN;
        // The retained DOM leaf shares this opacity between its sprite and both
        // annotation pseudos. A reference whose physical marker has faded must
        // still publish non-zero leaf opacity; `visible` keeps the sprite itself
        // suppressed while the circle and caption remain paintable.
        if (referenceAnnotationOnly) projected.markerOpacity = 1;
        // Never force two locator circles to overlap. At a safe projected
        // separation Earth keeps circle + label; once its orbit collapses into
        // the Sun's locator, retain the truthful caption but retire the circle.
        if (referenceAnnotationOnly && localExtent < BODY_INDICATOR_DIAMETER + UNIVERSE_LABEL_POLICY.spacingPixels) {
          circle = projected.circle = false;
        }
        // The destination stays named through the whole flight, across its preview fade.
        const alpha = flightDestination || referenceAnnotationOnly ? 1 : targeted ? markerOpacity : Math.min(markerOpacity, resolvedDisc ? 1 : labelExtentOpacity(localExtent));
        // Naming policy, decided before any slot is contested: suppressed, unresolved, too faint
        // or out of context here, and the body is not one this camera names at all.
        projected.nameable = !(entry.labelSuppressed || !annotationVisible || size.width === 0 ||
            alpha <= (entry.labelShown ? .5 : .5 + ANNOTATION_ENTRY_MARGIN) ||
            (!targeted && !resolvedDisc && (!inContext || unrelatedMinor)));
        if (referenceAnnotationOnly) { projected.orbitVisibility = 0; projected.segments = []; }
        // A presentation setting removes the body from annotation admission;
        // final admission below retires an on-screen context orbit with the caption.
        // Selection/hover can still reveal the complete annotation.
        if (!projected.nameable || (!targeted && entry.labelHidden)) continue;
        const gap = Math.max(5, diameter / 2, circle || referenceAnnotationOnly ? BODY_INDICATOR_DIAMETER / 2 : 0) + 4;
        const positions = [[x + gap, y - size.height / 2], [x - gap - size.width, y - size.height / 2],
          [x - size.width / 2, y - gap - size.height], [x - size.width / 2, y + gap]];
        const primary = entry.orbit !== null && systemFade.isSystemStar(entry.orbit.centerBodyId);
        const radialSide = primary && entry.parent ? (() => {
          const [parentX, parentY] = project(frame.eye(entry.parent!));
          const dx = x - parentX, dy = y - parentY;
          return Math.abs(dx) >= Math.abs(dy) ? dx >= 0 ? 0 : 1 : dy >= 0 ? 3 : 2;
        })() : 0;
        const radialSides = [radialSide, ...[0, 1, 2, 3].filter(side => side !== radialSide)];
        const sides = body.id === plan.focus.id ? [2] : flightDestination ? [0, 1, 2, 3]
          : resolvedDisc || body.id === emphasizedId ? [3, 2, 0, 1] : primary ? radialSides : [0, 1, 2, 3];
        const placements = sides.map(slot => {
          let [left, top] = positions[slot];
          left = Math.max(-width / 2 + 4, Math.min(left, width / 2 - size.width - 4));
          top = Math.max(-height / 2 + 4, Math.min(top, height / 2 - size.height - 4));
          return { slot, rect: { left, top, right: left + size.width, bottom: top + size.height } };
        });
        const radius = BODY_INDICATOR_DIAMETER / 2;
        // At the outer reference range Earth's honest projected position falls
        // inside the Sun's 16 px locator. Keep the outward caption collision-safe,
        // but do not let the two reference circles suppress one another.
        const anchor = circle && !referenceAnnotationOnly
          ? { left: x - radius, right: x + radius, top: y - radius, bottom: y + radius }
          : undefined;
        candidates.push({ id: body.id, projected, navigable: true,
          pinned: hovered ? 3 : highlighted ? 2 : body.id === emphasizedId ? 1 : 0,
          priority, tier: annotationPriorities[body.id] ?? 0, shown: entry.labelShown,
          previousPlacement: entry.labelShown ? entry.labelPlacement : sides[0], placements,
          ...(anchor ? { anchor } : {}),
        });
      }
      // Circle and caption reserve space together. A rejected candidate owns no
      // annotation or context orbit; physical sprites remain independent.
      // A drag moves every candidate on every frame. Re-running collision admission
      // during that motion made adjacent bodies trade the same slot, so their circles
      // and captions blinked while the physical markers remained visible. Keep the
      // committed membership and side until release. A caption is constrained
      // rather than retired when its committed side reaches the viewport edge.
      // The system anchor and its planets are permanent orientation landmarks
      // at the zoom levels where their normal alpha policy names them. Admit
      // each independently so minor-body labels cannot make one blink.
      const landmarks = candidates.filter(candidate => candidate.projected.entry.body.id === plan.focus.id ||
        (rotationActive || preserveCommittedAnnotations) && candidate.projected.entry.orbit !== null && systemFade.isSystemStar(candidate.projected.entry.orbit.centerBodyId) &&
        (candidate.tier ?? 0) >= 3);
      const acceptedLandmarks = landmarks.flatMap(candidate => admitStableLabels([candidate], worldLabelBudget()));
      for (const { candidate, rect } of acceptedLandmarks) labelBudget.admit(rect, candidate.anchor);
      const landmarkSet = new Set(landmarks);
      const otherCandidates = candidates.filter(candidate => !landmarkSet.has(candidate));
      const acceptedOthers = rotationActive || preserveCommittedAnnotations ? (() => {
        const admitted = admitStableLabels(otherCandidates.filter(candidate => candidate.pinned > 0), labelBudget);
        const admittedCandidates = new Set(admitted.map(item => item.candidate));
        for (const candidate of otherCandidates) {
          if (admittedCandidates.has(candidate) || !candidate.shown) continue;
          const previous = candidate.placements.find(item => item.slot === candidate.previousPlacement);
          if (previous && labelBudget.admit(previous.rect, candidate.anchor)) {
            admitted.push({ candidate, placement: previous.slot, rect: previous.rect });
          }
        }
        return admitted;
      })() : admitStableLabels(otherCandidates, labelBudget);
      const accepted = [...acceptedLandmarks, ...acceptedOthers];
      for (const item of projectedBodies) { item.entry.labelShown = false; item.entry.indicatorShown = false; }
      for (const { candidate, placement, rect } of accepted) {
        const { projected } = candidate;
        projected.entry.labelShown = true; projected.entry.labelPlacement = placement;
        projected.entry.indicatorShown = projected.circle;
        projected.labelPosition = [rect.left, rect.top];
      }
      for (const projected of projectedBodies) {
        const { entry, x, y } = projected;
        if (!entry.orbit) continue;
        // A minor body's path cannot identify itself when its caption is absent:
        // highly eccentric comet trails otherwise cross the stage as anonymous
        // near-straight rays while their bodies are off screen. Major bodies retain
        // the useful orbit field, and hover/highlight/selection reveal a minor path.
        const anonymousMinor = (annotationPriorities[entry.body.id] ?? 2) < 2 && !entry.labelShown &&
          !projected.hovered && entry.highlighted !== true && entry.body.id !== emphasizedId;
        // An on-screen context path belongs to the annotation that identifies its body
        // when that annotation lost ordinary decluttering. The selected object's own
        // path remains available.
        if (anonymousMinor || projected.inFrame && !entry.labelShown &&
            (overview || entry.body.id !== selectedId)) projected.orbitVisibility = 0;
        entry.indicatorCutout = entry.indicatorShown;
        projected.segments = projected.orbitVisibility <= 0 ? [] : entry.indicatorCutout
          ? orbitOutsideMarker(projected.segments, x, y, entry.indicatorRadius) : projected.segments;
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
      const flightCueShown = navigationInFlight && entry.body.id === emphasizedId && (entry.labelShown || entry.indicatorShown);
      const output = slot.output ??= { x: 0, y: 0, diameter: 0, markerOpacity: 0, visible: false, annotationVisible: false, hovered: false, lineWidth: 0,
        orbitVisibility: 0, segments: [], labelPosition: undefined, orbitBounds: null, index: entry.index, labelShown: false, labelPlacement: 0,
        indicatorShown: false, indicatorCutout: false, orbitAppearance: entry.orbitAppearance };
      output.x = billboardShown || flightCueShown ? projected.x : 0; output.y = billboardShown || flightCueShown ? projected.y : 0;
      // Alphas travel in 1/64 steps: every rotation frame moves a marker's silhouette a
      // little, and a step this small cannot change a composited pixel, so unchanged
      // steps neither cross the worker boundary nor restyle the marker's cue and caption.
      output.diameter = billboardShown || flightCueShown ? projected.diameter : 0; output.markerOpacity = billboardShown ? quantizeAlpha(projected.markerOpacity) : 0;
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
