import type { OrbitSegment } from './types.js';

/** CSS unit-bar transform for an already projected, clipped prepared chord. */
export function orbitSegmentTransform([x0, y0, x1, y1]: OrbitSegment): string {
  const dx = x1 - x0, dy = y1 - y0, length = Math.hypot(dx, dy);
  return `matrix(${formatLineNumber(dx)}, ${formatLineNumber(dy)}, ${
    formatLineNumber(-dy / length)}, ${formatLineNumber(dx / length)}, ${
    formatLineNumber(x0)}, ${formatLineNumber(y0)})`;
}

export function formatLineNumber(value: number): string {
  return Math.abs(value) < 1e-9 ? '0' : value.toFixed(6);
}
