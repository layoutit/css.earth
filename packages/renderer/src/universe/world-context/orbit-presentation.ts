import type { OrbitSegment } from '../../solar-system/types.js';
import { logarithmicFade, CONTEXT_LINE_WIDTH } from './context-scale.js';

export const ORBIT_FADE_START_PIXELS = 12, ORBIT_FULL_PIXELS = 48;

export function orbitPresentation(segments: readonly OrbitSegment[] | number) {
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
export const quantizeAlpha = (alpha: number) => Math.round(alpha * EXTENT_FADE_STEPS) / EXTENT_FADE_STEPS;
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

/** The picking bounds of the final clipped chords, including the marker cutout,
 * written into the body's retained bounds object; the paint owner formats the strokes. */
export function orbitBounds<Bounds extends { left: number; top: number; right: number; bottom: number }>(segments: readonly OrbitSegment[], into: Bounds) {
  if (segments.length === 0) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const [x0, y0, x1, y1] of segments) {
    left = Math.min(left, x0, x1); right = Math.max(right, x0, x1);
    top = Math.min(top, y0, y1); bottom = Math.max(bottom, y0, y1);
  }
  into.left = left; into.top = top; into.right = right; into.bottom = bottom;
  return into;
}
