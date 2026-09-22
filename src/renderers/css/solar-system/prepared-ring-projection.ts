import { clipSegmentToRectangle, eyeFraction, lerp, splitVisible } from './heliocentric-geometry.js';
import type { Vector3 } from './types.js';
import type { OrbitSegment } from './types.js';

const DISTANCE_FADE_STEPS = 16;
export interface OrbitDepthFade { readonly start: number; readonly end: number }
/** A depth plane cuts a prepared conic at most twice. Reserve the fade's
 * additional clipped pieces, including the existing visibility split budget. */
export const orbitProjectionCapacity = (vertices: number) => vertices ? vertices * 2 + DISTANCE_FADE_STEPS * 4 : 0;

/** A mounted line pool owns one live projection, with the same bounded capacity
 * as its drawing leaves. Consumers finish reading it before the next publish.
 * Prepared vertices remain immutable; only these screen coordinates change. */
export function createRetainedRingProjection(capacity: number) {
  if (!Number.isSafeInteger(capacity) || capacity < 0) throw new TypeError('Invalid retained orbit capacity.');
  const slots = Array.from({ length: capacity }, () => [0, 0, 0, 0, 0] as [number, number, number, number, number]);
  const segments: OrbitSegment[] = [];
  let count = 0;
  return {
    reset() { count = 0; },
    write(x0: number, y0: number, x1: number, y1: number, weight: number) {
      const slot = slots[count];
      if (!slot) throw new RangeError('Prepared orbit projection capacity exceeded.');
      slot[0] = x0; slot[1] = y0; slot[2] = x1; slot[3] = y1; slot[4] = weight;
      segments[count++] = slot;
      return true;
    },
    finish(): readonly OrbitSegment[] { segments.length = count; return segments; },
  };
}

/** The one visibility guard for prepared geometry: the largest screen extent a
 * sphere can reach, from its nearest point. Anything below `ORBIT_FADE_START`
 * or one pixel cannot be seen, so its owner skips projection entirely. */
export function projectedSphereDiameter(centerEye: Vector3, radiusM: number, focal: number, near: number): number {
  return 2 * focal * radiusM / Math.max(near, -centerEye[2] - radiusM);
}

/** Conservative projected bounds for a prepared sphere. A near-plane crossing
 * requires the exact chord path. Otherwise its enclosing eye-space cube bounds
 * every projected chord, including viewport clipping and the existing fade. */
export function orbitBoundsMayContribute(center: Vector3, radius: number, focal: number,
  offset: readonly number[], near: number, clipX: number, clipY: number, minimumExtent: number): boolean {
  // Account for subtraction/rotation roundoff at large world coordinates.
  const margin = Math.max(radius, ...center.map(Math.abs), 1) * Number.EPSILON * 32;
  const r = radius + margin, front = -center[2] - r, back = -center[2] + r;
  if (back <= near) return false;
  if (front <= near) return true;
  const left = offset[0] + focal * Math.min((center[0] - r) / front, (center[0] - r) / back);
  const right = offset[0] + focal * Math.max((center[0] + r) / front, (center[0] + r) / back);
  const top = offset[1] + focal * Math.min((center[1] - r) / front, (center[1] - r) / back);
  const bottom = offset[1] + focal * Math.max((center[1] + r) / front, (center[1] + r) / back);
  const epsilon = Math.max(1, Math.abs(left), Math.abs(right), Math.abs(top), Math.abs(bottom)) * Number.EPSILON * 32;
  const width = Math.min(clipX, right + epsilon) - Math.max(-clipX, left - epsilon);
  const height = Math.min(clipY, bottom + epsilon) - Math.max(-clipY, top - epsilon);
  return width >= 0 && height >= 0 && Math.max(width, height) > minimumExtent;
}

/** Project prepared chords into a bounded retained line pool; never derive an orbit. */
export function createPreparedRingProjector({ toEye, toEyeAt, project, hidden, mayOcclude, near, clipX, clipY, depthFade }: {
  toEye(point: Vector3): Vector3;
  /** The same transform from coordinates, sparing an input array per prepared vertex. */
  toEyeAt?(x: number, y: number, z: number): Vector3;
  project(eye: Vector3): readonly number[];
  hidden(eye: Vector3): boolean;
  /** Conservative screen-space broad phase; absent means all chords need the detailed test. */
  mayOcclude?(start: readonly number[], end: readonly number[]): boolean;
  near: number;
  clipX: number;
  clipY: number;
  /** Display attenuation along the selected path, in eye-space metres. */
  depthFade?: OrbitDepthFade;
}) {
  if (depthFade && !(depthFade.start > 0 && depthFade.end > depthFade.start && Number.isFinite(depthFade.end))) {
    throw new TypeError('Orbit depth fade requires a finite increasing range.');
  }
  const fadePlanes = depthFade ? Array.from({ length: DISTANCE_FADE_STEPS + 1 }, (_, i) =>
    depthFade.start * (depthFade.end / depthFade.start) ** (i / DISTANCE_FADE_STEPS)) : [];
  // Painting and presentation measurement share the exact clipping path. A
  // measurement may stop once its consumer's existing fade is fully saturated.
  const visit = (vertices: Float64Array, trail: ArrayLike<number>, activeChords: ArrayLike<number> | undefined,
    segment: (x0: number, y0: number, x1: number, y1: number, weight: number) => boolean, fullOrbit = false, closed = true) => {
    // Hover reveals every prepared chord, but cannot close an open trajectory.
    const chords = fullOrbit ? undefined : activeChords;
    const vertexCount = vertices.length / 3;
    const chordCount = closed ? vertexCount : vertexCount - 1;
    const eyes: (Vector3 | undefined)[] = [];
    const screens: (readonly number[] | undefined)[] = [];
    const eyeAt = (index: number) => eyes[index] ??= toEyeAt ? toEyeAt(vertices[index * 3]!, vertices[index * 3 + 1]!, vertices[index * 3 + 2]!)
      : toEye([vertices[index * 3]!, vertices[index * 3 + 1]!, vertices[index * 3 + 2]!]);
    // A prepared polyline shares vertices between neighbouring chords. Project
    // each endpoint once for this camera; only clipped/occluded endpoints need
    // new projections. These caches belong to one visit, never a stale view.
    const screenAt = (index: number) => screens[index] ??= project(eyeAt(index));
    const inside = (p: readonly number[]) => Math.abs(p[0]) <= clipX && Math.abs(p[1]) <= clipY;
    for (let ordinal = 0; ordinal < (chords?.length ?? chordCount); ordinal++) {
      const index = chords?.[ordinal] ?? ordinal;
      if (index >= chordCount) continue;
      const weight = fullOrbit ? 1 : trail[index]!;
      if (!(weight > 0)) continue;
      const next = (index + 1) % vertexCount;
      let start = eyeAt(index), end = eyeAt(next);
      let startDepth = -start[2], endDepth = -end[2];
      if (startDepth <= near && endDepth <= near) continue;
      if (depthFade && startDepth >= depthFade.end && endDepth >= depthFade.end) continue;
      // Interior chords outside every occluder's conservative shadow already
      // are their final screen segment. Do not run clipping, perspective lerps,
      // visibility splitting and endpoint projection again for the common case.
      if (startDepth > near && endDepth > near && mayOcclude && (!depthFade || Math.max(startDepth, endDepth) <= depthFade.start)) {
        const a = screenAt(index), b = screenAt(next);
        if (inside(a) && inside(b) && !mayOcclude(a, b)) {
          // Preserve the detailed path's endpoint arithmetic exactly, even
          // where a + (b - a) rounds differently from b at astronomical scales.
          const endPoint = lerp(start, end, 1);
          const last = endPoint[0] === end[0] && endPoint[1] === end[1] && endPoint[2] === end[2] ? b : project(endPoint);
          if (Math.hypot(last[0] - a[0], last[1] - a[1]) >= 0.05 && !segment(a[0], a[1], last[0], last[1], weight)) return;
          continue;
        }
      }
      if (startDepth <= near) {
        start = lerp(start, end, (near - startDepth) / (endDepth - startDepth));
        startDepth = near;
      } else if (endDepth <= near) {
        end = lerp(start, end, (near - startDepth) / (endDepth - startDepth));
        endDepth = near;
      }
      const startScreen = start === eyes[index] ? screenAt(index) : project(start);
      const endScreen = end === eyes[next] ? screenAt(next) : project(end);
      const window = clipSegmentToRectangle(startScreen, endScreen, clipX, clipY);
      if (window === null) continue;
      const t0 = eyeFraction(window[0], startDepth, endDepth);
      const t1 = eyeFraction(window[1], startDepth, endDepth);
      const visibleStart = lerp(start, end, t0), visibleEnd = lerp(start, end, t1);
      const pieces = mayOcclude && !mayOcclude(startScreen, endScreen)
        ? [[visibleStart, visibleEnd]] : splitVisible(visibleStart, visibleEnd, hidden);
      for (const [pieceStart, pieceEnd] of pieces) {
        if (depthFade && Math.max(-pieceStart[2], -pieceEnd[2]) > depthFade.start) {
          // Clip the existing straight chord at the fade planes. This changes
          // its visibility only; it does not generate or fit an orbital curve.
          const d0 = -pieceStart[2], d1 = -pieceEnd[2], cuts = [0, 1];
          if (d0 !== d1) for (const plane of fadePlanes) {
            const t = (plane - d0) / (d1 - d0);
            if (t > 0 && t < 1) cuts.push(t);
          }
          cuts.sort((a, b) => a - b);
          for (let i = 1; i < cuts.length; i++) {
            const from = cuts[i - 1], to = cuts[i], depth = d0 + (d1 - d0) * (from + to) / 2;
            if (depth >= depthFade.end) continue;
            const opacity = depth <= depthFade.start ? 1 : 1 - Math.log(depth / depthFade.start) / Math.log(depthFade.end / depthFade.start);
            const [x0, y0] = project(lerp(pieceStart, pieceEnd, from)), [x1, y1] = project(lerp(pieceStart, pieceEnd, to));
            if (![x0, y0, x1, y1].every(Number.isFinite) || Math.hypot(x1 - x0, y1 - y0) < .05) continue;
            if (!segment(x0, y0, x1, y1, weight * opacity)) return;
          }
          continue;
        }
        const [x0, y0] = project(pieceStart), [x1, y1] = project(pieceEnd);
        if (![x0, y0, x1, y1].every(Number.isFinite) || Math.hypot(x1 - x0, y1 - y0) < 0.05) continue;
        if (!segment(x0, y0, x1, y1, weight)) return;
      }
    }
  };
  /** `vertices` holds consecutive x, y, z coordinates, as the prepared orbit bank stores them. */
  const projectRing = (vertices: Float64Array, trail: ArrayLike<number>, activeChords?: ArrayLike<number>, fullOrbit = false,
    retained?: ReturnType<typeof createRetainedRingProjection>, closed = true): readonly OrbitSegment[] => {
    if (retained) {
      retained.reset();
      visit(vertices, trail, activeChords, retained.write, fullOrbit, closed);
      return retained.finish();
    }
    const segments: OrbitSegment[] = [];
    visit(vertices, trail, activeChords, (x0, y0, x1, y1, weight) => {
      segments.push(Object.freeze([x0, y0, x1, y1, weight]));
      return true;
    }, fullOrbit, closed);
    return Object.freeze(segments);
  };
  return Object.assign(projectRing, {
    /** Exact projected extent, capped only at the caller's saturation point.
     * No partial geometry escapes this measurement-only operation. */
    measureExtent(vertices: Float64Array, trail: ArrayLike<number>, saturation: number, activeChords?: ArrayLike<number>, closed = true): number {
      if (!(saturation >= 1) || !Number.isFinite(saturation)) throw new TypeError('Orbit extent saturation must be finite and at least one pixel.');
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
      let extent = 1;
      visit(vertices, trail, activeChords, (x0, y0, x1, y1) => {
        left = Math.min(left, x0, x1); right = Math.max(right, x0, x1);
        top = Math.min(top, y0, y1); bottom = Math.max(bottom, y0, y1);
        extent = Math.max(1, right - left, bottom - top);
        return extent < saturation;
      }, false, closed);
      return Math.min(extent, saturation);
    },
  });
}

/** The perspective projection of a sphere lies inside its enclosing cube's
 * projected bounds. Chords outside those bounds cannot enter its shadow.
 * Keep the exact ray test whenever the cube crosses the eye plane. */
export function createSphereChordTest(center: Vector3, radius: number, project: (eye: Vector3) => readonly number[]) {
  if (center[2] + radius >= 0) return () => true;
  // A pinhole x depends only on a point's x and z, so the sphere's x extent is that of its xz footprint, a disc of the
  // same radius: it lies between the two tangent directions from the eye. Likewise for y. This is the exact screen
  // bound; the enclosing cube's near corners overstated a near sphere by about half its width on each side.
  const tangents = (across: number, depth: number) => {
    const middle = Math.atan2(across, -depth), half = Math.asin(Math.min(1, radius / Math.hypot(across, depth)));
    return [middle - half, middle + half];
  };
  const xs = tangents(center[0], center[2]).map(angle => project([Math.sin(angle), 0, -Math.cos(angle)])[0]!);
  const ys = tangents(center[1], center[2]).map(angle => project([0, Math.sin(angle), -Math.cos(angle)])[1]!);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
  // Expand only the rejection bound, to keep grazing roundoff conservative.
  const epsilon = Math.max(1, Math.abs(left), Math.abs(right), Math.abs(top), Math.abs(bottom)) * Number.EPSILON * 8;
  return (start: readonly number[], end: readonly number[]) =>
    Math.max(start[0], end[0]) >= left - epsilon && Math.min(start[0], end[0]) <= right + epsilon &&
    Math.max(start[1], end[1]) >= top - epsilon && Math.min(start[1], end[1]) <= bottom + epsilon;
}
