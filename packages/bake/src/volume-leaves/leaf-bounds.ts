import type { PreparedLeafBounds } from '@cssearth/renderer/rendering/prepared-leaf-frustum.ts';

/** Prepare conservative bounds from the final PolyCSS image rectangle,
 * including its edge extension and serialized transform, not source vertices. */
export function compileLeafBounds(matrix: string, width: number, height: number): PreparedLeafBounds | undefined {
  const m = matrix.split(',').map(Number);
  if (m.length !== 16 || !m.every(Number.isFinite) || !(width > 0) || !(height > 0)) throw new TypeError('Invalid compiled leaf geometry.');
  // Future projective leaves remain drawable until their bounds are prepared.
  if (m[3] !== 0 || m[7] !== 0 || m[11] !== 0 || m[15] !== 1) return undefined;
  const corners = [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) =>
    [0, 1, 2].map(axis => m[axis]! * x! + m[axis + 4]! * y! + m[axis + 12]!));
  return {
    min: [0, 1, 2].map(axis => Math.min(...corners.map(p => p[axis]!))) as [number, number, number],
    max: [0, 1, 2].map(axis => Math.max(...corners.map(p => p[axis]!))) as [number, number, number],
  };
}
