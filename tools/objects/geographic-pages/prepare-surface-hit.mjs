import { prepareCityPageGeometry } from './page-geometry.mjs';

const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

/** Reuse the retained root faces, including the same circular polar coverage. */
export function preparePagedSurfaceHit(scene, target) {
  const triangles = [], discs = [];
  for (let y = 0; y < 16; y++) {
    const polar = y === 0 || y === 15;
    for (let x = 0; x < (polar ? 1 : 32); x++) {
      // The default offset is the existing fine-page plane. Coarse imagery
      // sits below it; camera clearance must respect the outer painted layer.
      const page = prepareCityPageGeometry({ level: 0, x, y }, scene);
      const q = page.corners, firstTriangle = triangles.length;
      triangles.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]);
      if (polar) {
        const { matrix: m, side } = page.geographicProjection;
        const u = m.slice(0, 3).map(n => n * side / 2), v = m.slice(4, 7).map(n => n * side / 2);
        const uu = dot(u, u), vv = dot(v, v), uv = dot(u, v), determinant = uu * vv - uv * uv;
        discs.push({ firstTriangle, triangleCount: 2,
          center: q[0].map((_, i) => q.reduce((sum, point) => sum + point[i], 0) / 4),
          axisU: u.map((n, i) => (n * vv - v[i] * uv) / determinant),
          axisV: v.map((n, i) => (n * uu - u[i] * uv) / determinant) });
      }
    }
  }
  return { target, triangles, discs };
}
