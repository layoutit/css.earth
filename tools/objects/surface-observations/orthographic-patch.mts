/** Geometry for a bounded photographic patch, independent of the image's registration quality. */
import type { SourceMesh } from '../terrestrial-layers/contracts.mts';

export const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: readonly number[], b: readonly number[]) => a.map((n, i) => n - b[i]);
const cross = (a: readonly number[], b: readonly number[]) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const unit = (a: readonly number[]) => a.map(n => n / Math.hypot(...a));

export function polygonInteriorDistance(point: readonly number[], polygon: readonly (readonly number[])[]) {
  const [x, y] = point;
  let inside = false, distance = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i], dx = b[0] - a[0], dy = b[1] - a[1];
    if ((a[1] > y) !== (b[1] > y) && x < dx * (y - a[1]) / dy + a[0]) inside = !inside;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x-a[0])*dx+(y-a[1])*dy)/lengthSquared));
    distance = Math.min(distance, Math.hypot(x-a[0]-t*dx, y-a[1]-t*dy));
  }
  return inside ? distance : -distance;
}

export function interpolatedNormals(mesh: SourceMesh) {
  const sums = mesh.positions.map(() => [0, 0, 0]);
  for (const f of mesh.indices) {
    const n = cross(sub(mesh.positions[f[1]], mesh.positions[f[0]]), sub(mesh.positions[f[2]], mesh.positions[f[0]]));
    for (const index of f) for (let k = 0; k < 3; k++) sums[index][k] += n[k];
  }
  const normals = sums.map(unit);
  return (point: readonly number[], faceId: number) => {
    const f = mesh.indices[faceId], [a,b,c] = f.map(i => mesh.positions[i]);
    const v0 = sub(b,a), v1 = sub(c,a), v2 = sub(point,a);
    const d00 = dot(v0,v0), d01 = dot(v0,v1), d11 = dot(v1,v1), d20 = dot(v2,v0), d21 = dot(v2,v1);
    const denominator = d00*d11-d01*d01, v = (d11*d20-d01*d21)/denominator, w = (d00*d21-d01*d20)/denominator;
    return unit([0,1,2].map(k => normals[f[0]][k]*(1-v-w)+normals[f[1]][k]*v+normals[f[2]][k]*w));
  };
}
