/** Offline full-precision sky-plane geometry. Photographs have calibrated edges, so no seam bleed. */
import { computeProjectiveQuadCoefficients, resolveProjectiveQuadGuards } from '@layoutit/polycss';

export function prepareOverlayGeometry(vertices: readonly (readonly [number, number, number])[], width: number, height: number): {
  matrix: string; leafWidth: number; leafHeight: number; backgroundSize: [number, number]; backgroundPosition: [number, number];
} {
  if (vertices.length !== 4 || vertices.some(point => point.length !== 3 || !point.every(Number.isFinite) || Math.abs(point[2]) > 1e-10) ||
      !Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new TypeError('An astrometric overlay needs four finite vertices in the local z=0 sky plane and positive integer texture dimensions.');
  }
  // PolyCSS stores the two physical tangent axes in [y,x,z] order at 50 CSS pixels/unit.
  const q: [number, number][] = vertices.map(point => [point[1] * 50, point[0] * 50]);
  const turns = q.map((point, i) => {
    const next = q[(i + 1) % 4], after = q[(i + 2) % 4];
    return (next[0] - point[0]) * (after[1] - next[1]) - (next[1] - point[1]) * (after[0] - next[0]);
  });
  if (!turns.every(value => Number.isFinite(value) && value > 0) && !turns.every(value => Number.isFinite(value) && value < 0)) {
    throw new TypeError('An astrometric overlay must be a nondegenerate convex quad.');
  }
  const guards = resolveProjectiveQuadGuards({ bleed: 0 });
  const coefficients = computeProjectiveQuadCoefficients(q, guards);
  if (!coefficients) throw new TypeError('Astrometric overlay has an unsafe projective divisor.');
  const { g, h, w1, w3 } = coefficients;
  const weights = [1, 1 + g, 1 + g + h, 1 + h];
  if (!weights.every(value => Number.isFinite(value) && value > guards.denomEps) ||
      Math.max(...weights) / Math.min(...weights) > guards.maxWeightRatio) throw new TypeError('Astrometric overlay crosses the projection horizon.');
  const [x0, y0] = q[0], [x1, y1] = q[1], [x3, y3] = q[3];
  // Public coefficients map the unit square; convert columns to texture-pixel coordinates.
  // Do not use the generic leaf formatter: its six-decimal projective rounding changes sky rays.
  const matrix = [(x1 * w1 - x0) / width, (y1 * w1 - y0) / width, 0, g / width,
    (x3 * w3 - x0) / height, (y3 * w3 - y0) / height, 0, h / height,
    0, 0, 1, 0, x0, y0, 0, 1];
  if (!matrix.every(Number.isFinite)) throw new TypeError('Astrometric overlay matrix is not finite.');
  return { matrix: matrix.join(','), leafWidth: width, leafHeight: height,
    backgroundSize: [width, height], backgroundPosition: [0, 0] };
}
