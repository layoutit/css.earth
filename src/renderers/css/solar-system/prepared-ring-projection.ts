import { clipSegmentToRectangle, eyeFraction, lerp, splitVisible } from './heliocentric-geometry.js';
import type { Vector3 } from './types.js';
import type { OrbitSegment } from './types.js';

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
export function createPreparedRingProjector({ toEye, project, hidden, mayOcclude, near, clipX, clipY }: {
  toEye(point: Vector3): Vector3;
  project(eye: Vector3): readonly number[];
  hidden(eye: Vector3): boolean;
  /** Conservative screen-space broad phase; absent means all chords need the detailed test. */
  mayOcclude?(start: readonly number[], end: readonly number[]): boolean;
  near: number;
  clipX: number;
  clipY: number;
}) {
  // Painting and presentation measurement share the exact clipping path. A
  // measurement may stop once its consumer's existing fade is fully saturated.
  const visit = (vertices: readonly Vector3[], trail: readonly number[], activeChords: readonly number[] | undefined,
    segment: (x0: number, y0: number, x1: number, y1: number, weight: number) => boolean, fullOrbit = false, closed = true) => {
    // Hover reveals every prepared chord, but cannot close an open trajectory.
    const chords = fullOrbit ? undefined : activeChords;
    const chordCount = closed ? vertices.length : vertices.length - 1;
    const eyes: (Vector3 | undefined)[] = [];
    const screens: (readonly number[] | undefined)[] = [];
    const eyeAt = (index: number) => eyes[index] ??= toEye(vertices[index]);
    // A prepared polyline shares vertices between neighbouring chords. Project
    // each endpoint once for this camera; only clipped/occluded endpoints need
    // new projections. These caches belong to one visit, never a stale view.
    const screenAt = (index: number) => screens[index] ??= project(eyeAt(index));
    const inside = (p: readonly number[]) => Math.abs(p[0]) <= clipX && Math.abs(p[1]) <= clipY;
    for (let ordinal = 0; ordinal < (chords?.length ?? chordCount); ordinal++) {
      const index = chords?.[ordinal] ?? ordinal;
      if (index >= chordCount) continue;
      const weight = fullOrbit ? 1 : trail[index];
      if (!(weight > 0)) continue;
      const next = (index + 1) % vertices.length;
      let start = eyeAt(index), end = eyeAt(next);
      let startDepth = -start[2], endDepth = -end[2];
      if (startDepth <= near && endDepth <= near) continue;
      // Interior chords outside every occluder's conservative shadow already
      // are their final screen segment. Do not run clipping, perspective lerps,
      // visibility splitting and endpoint projection again for the common case.
      if (startDepth > near && endDepth > near && mayOcclude) {
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
        const [x0, y0] = project(pieceStart), [x1, y1] = project(pieceEnd);
        if (![x0, y0, x1, y1].every(Number.isFinite) || Math.hypot(x1 - x0, y1 - y0) < 0.05) continue;
        if (!segment(x0, y0, x1, y1, weight)) return;
      }
    }
  };
  const projectRing = (vertices: readonly Vector3[], trail: readonly number[], activeChords?: readonly number[], fullOrbit = false,
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
    measureExtent(vertices: readonly Vector3[], trail: readonly number[], saturation: number, activeChords?: readonly number[], closed = true): number {
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
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (const dx of [-radius, radius]) for (const dy of [-radius, radius]) for (const dz of [-radius, radius]) {
    const [x, y] = project([center[0] + dx, center[1] + dy, center[2] + dz]);
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  // Expand only the rejection bound, to keep grazing roundoff conservative.
  const epsilon = Math.max(1, Math.abs(left), Math.abs(right), Math.abs(top), Math.abs(bottom)) * Number.EPSILON * 8;
  return (start: readonly number[], end: readonly number[]) =>
    Math.max(start[0], end[0]) >= left - epsilon && Math.min(start[0], end[0]) <= right + epsilon &&
    Math.max(start[1], end[1]) >= top - epsilon && Math.min(start[1], end[1]) <= bottom + epsilon;
}
