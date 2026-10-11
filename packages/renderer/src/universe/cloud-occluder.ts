import type { CloudPointEllipsoid } from '@cssearth/objects';

/** What is behind the occluder keeps this share of its opacity, at an ellipsoid's middle; none is taken at its rim. */
export const OCCLUDED_FLOOR = .15;

/** How deep the segment from an eye to a point passes through an occluder's ellipsoids: 0 clear, up to 1 through an
 * ellipsoid's middle. The eye and the point's offset from it are in the bank's units. */
export function occluderDepth(occluder: readonly CloudPointEllipsoid[]) {
  // each ellipsoid as a map into its unit sphere: the inverse of the matrix whose columns are its three axes (any three
  // that span space, not only perpendicular ones), as rows
  const ellipsoids = occluder.map(e => ({ c: e.centreUnits, rows: inverseRows(e.axesUnits) }));
  return (ex: number, ey: number, ez: number, dx: number, dy: number, dz: number) => {
    let most = 0;
    for (const { c, rows } of ellipsoids) {
      const o = [ex - c[0], ey - c[1], ez - c[2]], O = rows.map(r => r[0]! * o[0]! + r[1]! * o[1]! + r[2]! * o[2]!), D = rows.map(r => r[0]! * dx + r[1]! * dy + r[2]! * dz);
      const a = D[0]! ** 2 + D[1]! ** 2 + D[2]! ** 2, b = 2 * (O[0]! * D[0]! + O[1]! * D[1]! + O[2]! * D[2]!), cc = O[0]! ** 2 + O[1]! ** 2 + O[2]! ** 2 - 1;
      if (b * b - 4 * a * cc <= 0) continue;
      const t = -b / (2 * a); if (t <= 0 || t >= 1) continue;               // the closest approach lies between eye and point
      const r2 = cc - b * b / (4 * a) + 1;                                    // squared distance from the middle at closest approach
      const share = 1 - Math.max(0, Math.min(1, r2)); most = Math.max(most, 1 - (1 - share) * (1 - share));
    }
    return most;
  };
}

/** The rows of the inverse of the 3x3 matrix whose columns are `axes`: row k of it, dotted with an offset, is that
 * offset's k-th coordinate along the axes. The axes span space (@cssearth/objects `occluderAxesSpanSpace`). */
function inverseRows(axes: readonly (readonly [number, number, number])[]): number[][] {
  const [a, b, c] = [axes[0]!, axes[1]!, axes[2]!];
  // the rows of the inverse are the cross products of the other two columns over the determinant
  const cross = (u: readonly number[], v: readonly number[]) => [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
  const bc = cross(b, c), ca = cross(c, a), ab = cross(a, b), det = a[0] * bc[0]! + a[1] * bc[1]! + a[2] * bc[2]!;
  return [bc, ca, ab].map(row => row.map(value => value / det));
}
