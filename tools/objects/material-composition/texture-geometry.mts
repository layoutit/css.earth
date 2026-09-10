import type { resolvePolyTextureLeafGeometry } from '@layoutit/polycss';
import type {Vector3} from './ellipsoid.mts';
type TextureGeometry = NonNullable<ReturnType<typeof resolvePolyTextureLeafGeometry>>;
/** Rescale a projective texture leaf without changing its source coordinates. */
export function fitTextureGeometry(geometry: TextureGeometry, leafWidth: number, leafHeight: number): TextureGeometry {
  const matrix = String(geometry.matrix).split(',').map(Number);
  if (matrix.length !== 16 || matrix.some((value) => !Number.isFinite(value))) {
    throw new Error('Prepared texture matrix is invalid.');
  }
  const matrixScaleX = geometry.leafWidth / leafWidth;
  const matrixScaleY = geometry.leafHeight / leafHeight;
  for (const index of [0, 1, 2, 3]) matrix[index] *= matrixScaleX;
  for (const index of [4, 5, 6, 7]) matrix[index] *= matrixScaleY;
  const rasterScaleX = leafWidth / geometry.leafWidth;
  const rasterScaleY = leafHeight / geometry.leafHeight;
  return {
    ...geometry,
    matrix: matrix.map((value) => Number(value.toFixed(6))).join(','),
    leafWidth,
    leafHeight,
    backgroundPosition: [geometry.backgroundPosition[0] * rasterScaleX,
      geometry.backgroundPosition[1] * rasterScaleY],
    backgroundSize: [geometry.backgroundSize[0] * rasterScaleX,
      geometry.backgroundSize[1] * rasterScaleY],
  };
}

/** Winding and atlas convention shared by the oblate polar-disc carriers. */
export function polarQuad({ pole, radius, z }: {pole: 'north' | 'south'; radius: number; z: number}): {vertices: Vector3[]; uvs: [number, number][]} {
  if (!['north', 'south'].includes(pole) || !Number.isFinite(radius) || radius <= 0 || !Number.isFinite(z)) {
    throw new TypeError('Invalid polar carrier geometry.');
  }
  const north = pole === 'north';
  return {
    vertices: north
      ? [[-radius, -radius, z], [radius, -radius, z], [radius, radius, z], [-radius, radius, z]]
      : [[-radius, radius, z], [radius, radius, z], [radius, -radius, z], [-radius, -radius, z]],
    uvs: north ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 1], [1, 1], [1, 0], [0, 0]],
  };
}
