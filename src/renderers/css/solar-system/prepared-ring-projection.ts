import { clipSegmentToRectangle, eyeFraction, lerp, splitVisible } from './heliocentric-geometry.js';
import type { Vector3 } from './types.js';
import type { OrbitSegment } from './heliocentric-view.js';

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
  return (vertices: readonly Vector3[], trail: readonly number[], activeChords?: readonly number[], fullOrbit = false): readonly OrbitSegment[] => {
    // Full orbits include prepared chords omitted by the trail fade.
    const chords = fullOrbit ? undefined : activeChords;
    const eyes = chords ? null : vertices.map(toEye);
    const segments: OrbitSegment[] = [];
    let lastEndIndex = -1, lastEnd: Vector3 | null = null;
    for (let ordinal = 0; ordinal < (chords?.length ?? vertices.length); ordinal++) {
      const index = chords?.[ordinal] ?? ordinal;
      const weight = fullOrbit ? 1 : trail[index];
      if (!(weight > 0)) continue;
      const next = (index + 1) % vertices.length;
      let start = eyes ? eyes[index] : lastEndIndex === index ? lastEnd! : toEye(vertices[index]);
      let end = eyes ? eyes[next] : toEye(vertices[next]);
      lastEndIndex = next; lastEnd = end;
      let startDepth = -start[2], endDepth = -end[2];
      if (startDepth <= near && endDepth <= near) continue;
      if (startDepth <= near) {
        start = lerp(start, end, (near - startDepth) / (endDepth - startDepth));
        startDepth = near;
      } else if (endDepth <= near) {
        end = lerp(start, end, (near - startDepth) / (endDepth - startDepth));
        endDepth = near;
      }
      const startScreen = project(start), endScreen = project(end);
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
        segments.push(Object.freeze([x0, y0, x1, y1, weight]));
      }
    }
    return Object.freeze(segments);
  };
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
