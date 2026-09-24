/** Display convention for shapes without measured surface imagery or color.
 * sRGB bytes, not physical albedo. Lighting is prepared separately.
 */
export const SHAPE_MATERIAL = Object.freeze({
  color: '#808080',
  channel: 128,
  appearance: 'Neutral gray with gentle prepared shape shading; a display convention, not observed surface color or albedo.',
});

/** Broad fill around the existing prepared Sun direction: no hard terminator
 * or cast shadows in the default view. This is illustrative shape lighting.
 */
export function shapeFillIllumination(incidence: number): number {
  return .775 + .225 * Math.max(-1, Math.min(1, incidence));
}

export function shapeMaterialRaster(width: number, height: number): Buffer {
  if (![width, height].every(value => Number.isSafeInteger(value) && value > 0))
    throw new TypeError('Shape material requires positive integer dimensions.');
  return Buffer.alloc(width * height * 3, SHAPE_MATERIAL.channel);
}

import { BASE_TILE } from '@layoutit/polycss';
import type { PreparedTriangle } from './contracts.mts';
import { dotN as dot } from '../../../src/platform/vector3.mts';
interface ShapeAtlas {
  width: number; height: number;
  plans: readonly { face: PreparedTriangle; rect: { x: number; y: number; width: number; height: number }; matrix: readonly number[];
    geometry: { leafWidth: number; leafHeight: number } }[];
}

/** Same interpolated normals and Lambert law as radial materials, without
 * sampling a constant cylindrical image millions of times. Preparation only.
 */
export function neutralShapeAtlas(atlas: ShapeAtlas, sun: readonly number[]) {
  const { width, height } = atlas;
  if (![width, height].every(n => Number.isSafeInteger(n) && n > 0) || sun.length !== 3 || !sun.every(Number.isFinite))
    throw new TypeError('Invalid neutral shape atlas.');
  const flood = Buffer.alloc(width * height * 4), shadow = Buffer.alloc(flood.length);
  for (const { face, rect, matrix: m, geometry } of atlas.plans) {
    if (face.estimated || m.length !== 16 || m[3] !== 0 || m[7] !== 0 || m[15] !== 1 ||
        ![rect.x, rect.y].every(Number.isSafeInteger) || rect.x < 0 || rect.y < 0 || rect.x + rect.width > width || rect.y + rect.height > height)
      throw new Error('Neutral material requires a retained affine source triangle.');
    const [a, b, c] = face.vertices, ab = b.map((v, i) => v - a[i]), ac = c.map((v, i) => v - a[i]);
    const aa = dot(ab, ab), bb = dot(ac, ac), abac = dot(ab, ac), denominator = aa * bb - abac * abac;
    if (!(denominator > 0)) throw new Error('Degenerate neutral shape triangle.');
    const barycentric = (px: number, py: number) => {
      const x = (px + .5) * geometry.leafWidth / rect.width, y = (py + .5) * geometry.leafHeight / rect.height;
      const point = [(m[1] * x + m[5] * y + m[13]) / BASE_TILE,
        (m[0] * x + m[4] * y + m[12]) / BASE_TILE, (m[2] * x + m[6] * y + m[14]) / BASE_TILE];
      const ap = point.map((v, i) => v - a[i]);
      return [(dot(ap, ab) * bb - dot(ap, ac) * abac) / denominator,
        (dot(ap, ac) * aa - dot(ap, ab) * abac) / denominator];
    };
    const [u0, v0] = barycentric(0, 0), [ux, vx] = barycentric(1, 0), [uy, vy] = barycentric(0, 1);
    const [n0, n1, n2] = face.vertexNormals;
    const base = n0.map((n, i) => n + (n1[i] - n) * u0 + (n2[i] - n) * v0);
    const dx = n0.map((n, i) => (n1[i] - n) * (ux - u0) + (n2[i] - n) * (vx - v0));
    const dy = n0.map((n, i) => (n1[i] - n) * (uy - u0) + (n2[i] - n) * (vy - v0));
    for (let py = 0; py < rect.height; py++) {
      const row = ((rect.y + py) * width + rect.x) * 4;
      for (let px = 0; px < rect.width; px++) {
        const x = base[0] + dx[0] * px + dy[0] * py, y = base[1] + dx[1] * px + dy[1] * py, z = base[2] + dx[2] * px + dy[2] * py;
        const incidence = (x * sun[0] + y * sun[1] + z * sun[2]) / Math.hypot(x, y, z);
        const color = Math.round(SHAPE_MATERIAL.channel * (.12 + .88 * Math.max(0, incidence))), offset = row + px * 4;
        const fill = Math.round(SHAPE_MATERIAL.channel * shapeFillIllumination(incidence));
        flood[offset] = flood[offset + 1] = flood[offset + 2] = fill; flood[offset + 3] = 255;
        shadow[offset] = shadow[offset + 1] = shadow[offset + 2] = color; shadow[offset + 3] = 255;
      }
    }
  }
  return { flood, shadow };
}
