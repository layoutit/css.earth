import { clipSegmentToRectangle, eyeFraction, lerp, splitVisible } from './heliocentric-geometry.js';
import type { Vector3 } from './types.js';
import type { OrbitSegment } from './heliocentric-view.js';

/** Project prepared chords into a bounded retained line pool; never derive an orbit. */
export function createPreparedRingProjector({ toEye, project, hidden, near, clipX, clipY }: {
  toEye(point: Vector3): Vector3;
  project(eye: Vector3): readonly number[];
  hidden(eye: Vector3): boolean;
  near: number;
  clipX: number;
  clipY: number;
}) {
  return (vertices: readonly Vector3[], trail: readonly number[]): readonly OrbitSegment[] => {
    const eyes = vertices.map(toEye);
    const segments: OrbitSegment[] = [];
    for (let index = 0; index < eyes.length; index++) {
      const weight = trail[index];
      if (!(weight > 0)) continue;
      let start = eyes[index], end = eyes[(index + 1) % eyes.length];
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
      for (const [pieceStart, pieceEnd] of splitVisible(visibleStart, visibleEnd, hidden)) {
        const [x0, y0] = project(pieceStart), [x1, y1] = project(pieceEnd);
        if (![x0, y0, x1, y1].every(Number.isFinite) || Math.hypot(x1 - x0, y1 - y0) < 0.05) continue;
        segments.push(Object.freeze([x0, y0, x1, y1, weight]));
      }
    }
    return Object.freeze(segments);
  };
}
