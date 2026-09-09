import { createLabelDeclutter } from '@cssearth/engine';
import type { PositionM } from '@cssearth/engine';
import type { PreparedWorldContext } from './prepared-world-context.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { rotateWorldPosition, transposeWorldRotation, worldRotationFromQuaternion } from '../navigation/world-camera-math.js';
import { levelOfDetailFor, orbitLineOpacity } from '../navigation/perspective-dolly.js';
import { clipSegmentToRectangle, rayHitsSphereBefore } from '../solar-system/heliocentric-geometry.js';
import { createPreparedRingProjector, createRetainedRingProjection, orbitBoundsMayContribute } from '../solar-system/prepared-ring-projection.js';
import type { OrbitSegment } from '../solar-system/heliocentric-view.js';
import { createWorldFrameProjection } from './world-frame-projection.js';
import { orbitSegmentTransform } from '../solar-system/orbit-segment-presentation.js';

export const BODY_INDICATOR_DIAMETER = 16;
export const CONTEXT_LINE_WIDTH = 1;
const ORBIT_FADE_START_PIXELS = 12;

function orbitPresentation(segments: readonly OrbitSegment[] | number, closed: boolean) {
  if (typeof segments === 'number') return orbitPresentationForExtent(segments, closed);
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const [x0, y0, x1, y1] of segments) {
    left = Math.min(left, x0, x1); right = Math.max(right, x0, x1);
    top = Math.min(top, y0, y1); bottom = Math.max(bottom, y0, y1);
  }
  return orbitPresentationForExtent(Math.max(1, right - left, bottom - top), closed);
}

function orbitPresentationForExtent(extent: number, closed: boolean) {
  const opacity = logarithmicFade(extent, ORBIT_FADE_START_PIXELS, 48);
  // Closed planetary rings and their circles share one zoom fade.
  // Fading trails retain their earlier marker-crowding threshold.
  return { width: CONTEXT_LINE_WIDTH, opacity, markerOpacity: closed ? opacity : logarithmicFade(extent, 48, 128) };
}

function orbitOverlapsLabel(orbits: readonly { segments: readonly OrbitSegment[]; orbitVisibility: number; lineWidth: number }[], x: number, y: number, width: number, height: number): boolean {
  const cx = x + width / 2, cy = y + height / 2;
  return orbits.some(({ segments, orbitVisibility, lineWidth }) => {
    // Reserve the visible stroke plus one pixel. Faded geometry cannot hide text.
    const clearance = lineWidth / 2 + 1, rx = width / 2 + clearance, ry = height / 2 + clearance;
    return segments.some(([x0, y0, x1, y1, weight]) => {
      if (orbitVisibility * weight <= 0.1) return false;
      if (Math.max(x0, x1) < cx - rx || Math.min(x0, x1) > cx + rx ||
          Math.max(y0, y1) < cy - ry || Math.min(y0, y1) > cy + ry) return false;
      return clipSegmentToRectangle([x0 - cx, y0 - cy], [x1 - cx, y1 - cy], rx, ry) !== null;
    });
  });
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
  orbitHidden: boolean;
  labelHidden: boolean;
  labelSize: { width: number; height: number };
  labelShown: boolean;
  labelPlacement: number;
  indicatorShown: boolean;
  indicatorRadius: number;
  orbitAppearance: { width: number; opacity: number; markerOpacity: number };
}
export interface WorldContextView {
  world: WorldCameraPose;
  viewport: WorldCameraViewport;
  selectedId: string;
  overview: boolean;
  selectionPreview?: string | null;
  navigationIndicatorsVisible: boolean;
  anchorOnly: boolean;
  bodies: readonly WorldBodyPresentation[];
}

/** Project the prepared bank and resolve annotations without reading or writing DOM.
 * Segment buffers are borrowed until the next plan. A transport must copy/send
 * the result before requesting another view; the synchronous renderer consumes it inline. */
export function createWorldContextPlanner(plan: PreparedWorldContext) {
  const points = [plan.focus, ...plan.bodies];
  const byId = new Map(points.map(point => [point.id, point]));
  const prepared = points.map(body => {
    const orbit = 'orbit' in body ? body.orbit ?? null : null;
    return { body, orbit, parent: orbit ? byId.get(orbit.centerBodyId) ?? null : null,
      closedOrbit: orbit?.trail.every(weight => weight === 1) === true,
      orbitProjection: createRetainedRingProjection(orbit ? orbit.verticesM.length * 2 : 0) };
  });
  const labels = createLabelDeclutter({ capacity: points.length, spacingPixels: 4 });
  const indicators = createLabelDeclutter({ capacity: points.length, spacingPixels: 2 });
  return (view: WorldContextView) => {
    const { world, viewport, selectedId, overview, selectionPreview, navigationIndicatorsVisible } = view;
    if (world.referenceFrame !== plan.frame.referenceFrame || world.epochJdTt !== plan.frame.epochJdTt ||
        view.bodies.length !== prepared.length || !(viewport.widthPixels! > 0 && viewport.heightPixels! > 0)) {
      throw new TypeError('World context planning requires a matching frame, body state and measured viewport.');
    }
    const bodies = prepared.map((entry, index) => ({ ...entry, ...view.bodies[index], index,
      orbitClip: null as { segments: readonly OrbitSegment[]; x: number; y: number } | null }));
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
      const orbitOpacity = orbitLineOpacity(plan.camera.presentation.orbitLineFade, focusDiameter / height);
      const near = navigationIndicatorsVisible && opacity > 0 && orbitOpacity > 0
        ? Math.max(1, Math.min(...bodies.map(entry => Math.hypot(...frame.eye(entry.body)))) * 0.01) : 1;
      let anchorLineWidth = CONTEXT_LINE_WIDTH;
      // Project first, resolve shared body visibility, then place labels and publish once.
      // Marker decluttering suppresses body proxies, not independently resolved orbit paths.
      const projectedBodies: { entry: (typeof bodies)[number]; x: number; y: number; depth: number; diameter: number; markerOpacity: number; indicatorOpacity: number; visible: boolean; annotationVisible: boolean; hovered: boolean; inFrame: boolean; parentDiameter: number; priority: number; lineWidth: number; orbitVisibility: number; segments: readonly OrbitSegment[]; labelPosition?: readonly number[] }[] = [];
      for (const entry of publishingBodies) {
        const { body } = entry;
        const eye = frame.eye(body), depth = -eye[2];
        const parentEye = entry.parent ? frame.eye(entry.parent) : null;
        const occlusion = frame.occlusion(entry.parent);
        const [x, y] = project(eye);
        const diameter = depth > body.radiusM ? 2 * focal * body.radiusM / Math.sqrt(depth * depth - body.radiusM ** 2) : Infinity;
        const isSelected = body.id === selectedId;
        const isAnchor = body.id === plan.focus.id;
        const inFrame = depth > body.radiusM && Math.abs(x) < width / 2 && Math.abs(y) < height / 2;
        const visible = inFrame && !occlusion.hidden(eye, body.id);
        // The one retained anchor indicator is also the galactic locator.
        // Unresolved foreground points cannot occlude this annotation; physical sprites keep exact occlusion.
        const annotationVisible = isAnchor ? inFrame && !(selectedId !== body.id &&
          focusDiameter >= plan.camera.presentation.levelOfDetail.markerFullDiscPixels &&
          rayHitsSphereBefore(eye, selectedEye, selected.radiusM)) : visible;
        const parentDepth = parentEye === null ? 0 : -parentEye[2];
        const parentDiameter = entry.parent && parentDepth > entry.parent.radiusM
          ? 2 * focal * entry.parent.radiusM / Math.sqrt(parentDepth ** 2 - entry.parent.radiusM ** 2) : 0;
        const hovered = entry.hovered;
        const bounds = entry.orbit?.bounds;
        let segments: readonly OrbitSegment[] = [], measuredExtent: number | null = null;
        if (navigationIndicatorsVisible && entry.orbit && opacity > 0 && orbitOpacity > 0 &&
            (!bounds || orbitBoundsMayContribute(toEye(bounds.centerM), bounds.radiusM, focal, [ox, oy], near, width / 2, height / 2, ORBIT_FADE_START_PIXELS))) {
          const projector = createPreparedRingProjector({ toEye, project, hidden: occlusion.hidden,
            mayOcclude: occlusion.mayOcclude,
            near, clipX: width / 2, clipY: height / 2 });
          if (entry.orbitHidden && !hovered) {
            // Hidden paths have no geometry consumer. Their proxies still need
            // the exact existing fade, which saturates at 48/128 CSS pixels.
            measuredExtent = projector.measureExtent(entry.orbit.verticesM, entry.orbit.trail,
              entry.closedOrbit ? 48 : 128, entry.orbit.extentChords ?? entry.orbit.activeChords);
          } else segments = projector(entry.orbit.verticesM, entry.orbit.trail, entry.orbit.activeChords, entry.orbitProjection);
        }
        if (entry.orbit && navigationIndicatorsVisible) entry.orbitAppearance = orbitPresentation(measuredExtent ?? segments, entry.closedOrbit);
        const appearance = entry.orbitAppearance;
        const bodyLod = levelOfDetailFor(plan.camera.presentation.levelOfDetail, diameter);
        const proxyOpacity = 1 - bodyLod.markerOpacity * (1 - appearance.markerOpacity);
        const markerOpacity = (isSelected ? lod.billboardOpacity : 1) *
          (isAnchor ? 1 : opacity * (isSelected ? 1 : proxyOpacity));
        const orbitVisibility = entry.orbitHidden && !hovered ? 0 : appearance.opacity * orbitOpacity * opacity;
        if (entry.orbit && orbitVisibility > 0) anchorLineWidth = Math.max(anchorLineWidth, appearance.width);
        const indicatorOpacity = isAnchor && overview ? 1 :
          bodyLod.markerOpacity * (isAnchor ? 1 : entry.orbitHidden ? opacity : entry.closedOrbit
            ? orbitVisibility : opacity * (isSelected ? 1 : appearance.markerOpacity));
        const primary = !entry.orbit || entry.orbit.centerBodyId === plan.focus.id;
        const priority = (isAnchor ? 4e6 : 0) + (hovered ? 2e6 : 0) + (body.id === emphasizedId ? 6e6 : isSelected ? 1e6 : 0) + (primary ? 1000 : 0) + Math.min(99, diameter);
        if (navigationIndicatorsVisible && annotationVisible && indicatorOpacity > 0) {
          const radius = BODY_INDICATOR_DIAMETER / 2, padding = entry.indicatorShown ? 0 : 2;
          indicators.add({ owner: 0, id: body.id, priority: priority + (entry.indicatorShown ? 100 : 0),
            anchor: [x, y], widthPx: BODY_INDICATOR_DIAMETER + padding * 2,
            bottomOffsetPx: -radius - padding, topOffsetPx: radius + padding });
        }
        projectedBodies.push({ entry, x, y, depth, diameter, markerOpacity, indicatorOpacity, visible, annotationVisible, hovered, inFrame, parentDiameter, priority, lineWidth: appearance.width, orbitVisibility, segments });
      }
      // An orbitless anchor uses the same stroke as the visible system, then thins as it recedes.
      projectedBodies[0].lineWidth = anchorLineWidth;
      if (navigationIndicatorsVisible) indicators.resolve();
      for (const projected of projectedBodies) {
        const { entry, x, y, indicatorOpacity, segments } = projected;
        if (!navigationIndicatorsVisible) continue;
        entry.indicatorShown = indicators.accepted(0, entry.body.id);
        const crowded = projected.annotationVisible && indicatorOpacity > 0 && !entry.indicatorShown;
        if (crowded) {
          projected.markerOpacity = 0;
          if (entry.closedOrbit) projected.orbitVisibility = 0;
        }
        const orbitVisibility = projected.orbitVisibility;
        if (!entry.orbit) continue;
        entry.orbitClip = { segments: orbitVisibility > 0 ? segments : [], x, y };
        const clipped = entry.indicatorShown
          ? orbitOutsideMarker(entry.orbitClip.segments, x, y, entry.indicatorRadius) : entry.orbitClip.segments;
        projected.segments = clipped;
      }
      for (const projected of projectedBodies) {
        const { entry, x, y, diameter, markerOpacity, indicatorOpacity, annotationVisible, hovered, parentDiameter, priority, orbitVisibility } = projected;
        if (!navigationIndicatorsVisible) break;
        const { body, labelSize: size } = entry;
        const satellite = entry.parent !== null && entry.parent.id !== plan.focus.id;
        const resolvedDisc = diameter >= plan.camera.presentation.levelOfDetail.markerFadeStartDiscPixels;
        const labelOpacity = entry.orbitHidden ? opacity * (body.id === selectedId ? lod.billboardOpacity : 1) : markerOpacity;
        if ((entry.labelHidden && !hovered && body.id !== emphasizedId) || !annotationVisible || labelOpacity <= 0.5 || size.width === 0 ||
            (!resolvedDisc && body.id !== emphasizedId &&
              ((satellite && parentDiameter < plan.camera.presentation.levelOfDetail.billboardFadeStartDiscPixels) ||
               (entry.orbit && !entry.orbitHidden && !hovered && orbitVisibility <= 0.5))) ||
            (indicatorOpacity > 0 && !entry.indicatorShown)) continue;
        const gap = Math.max(5, diameter / 2, entry.indicatorShown ? BODY_INDICATOR_DIAMETER / 2 : 0) + 4;
        const positions = [[x + gap, y - size.height / 2], [x - gap - size.width, y - size.height / 2],
          [x - size.width / 2, y - gap - size.height], [x - size.width / 2, y + gap]];
        // Keep a clear placement stable; try other sides before hiding a label.
        const placements = body.id === plan.focus.id ? [3] :
          diameter >= plan.camera.presentation.levelOfDetail.billboardFullDiscPixels ? [3, 2, 0, 1] :
          [entry.labelPlacement, ...[0, 1, 2, 3].filter(index => index !== entry.labelPlacement)];
        const withinViewport = (index: number) => {
          const [lx, ly] = positions[index];
          return lx >= -width / 2 + 4 && lx + size.width <= width / 2 - 4 &&
            ly >= -height / 2 + 4 && ly + size.height <= height / 2 - 4;
        };
        const placement = placements.find(index => {
          const [lx, ly] = positions[index];
          return withinViewport(index) &&
            !projectedBodies.some(other => {
              if (other.entry === entry || other.entry.orbitHidden || !other.entry.indicatorShown || other.indicatorOpacity <= 0.1) return false;
              const nearestX = Math.max(lx, Math.min(lx + size.width, other.x));
              const nearestY = Math.max(ly, Math.min(ly + size.height, other.y));
              return Math.hypot(nearestX - other.x, nearestY - other.y) < BODY_INDICATOR_DIAMETER / 2 + 4;
            }) && (hovered || body.id === emphasizedId || entry.closedOrbit || satellite || body.id === plan.focus.id ||
              !orbitOverlapsLabel(projectedBodies, lx, ly, size.width, size.height));
        });
        if (placement === undefined) continue;
        entry.labelPlacement = placement;
        const [labelX, labelY] = positions[placement];
        const padding = entry.labelShown ? 0 : 2;
        labels.add({ owner: 0, id: body.id, priority: priority + (entry.labelShown ? 100 : 0),
          anchor: [labelX + size.width / 2, labelY + size.height + padding],
          widthPx: size.width + padding * 2, bottomOffsetPx: 0, topOffsetPx: size.height + padding * 2 });
        projected.labelPosition = [labelX, labelY];
      }
      if (navigationIndicatorsVisible) labels.resolve();
      for (const projected of projectedBodies) {
        if (navigationIndicatorsVisible) projected.entry.labelShown = labels.accepted(0, projected.entry.body.id);
      }
    return { emphasizedId, lod, opacity, width, height,
      projectedBodies: projectedBodies.map(({ entry, ...projected }) => ({ ...projected,
        transforms: projected.segments.map(orbitSegmentTransform),
        index: entry.index, labelShown: entry.labelShown, labelPlacement: entry.labelPlacement,
        indicatorShown: entry.indicatorShown, orbitAppearance: entry.orbitAppearance, orbitClip: entry.orbitClip })) };
  };
}
export type PlannedWorldContext = ReturnType<ReturnType<typeof createWorldContextPlanner>>;
