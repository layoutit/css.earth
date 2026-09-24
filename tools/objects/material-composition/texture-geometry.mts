import type {Vector3} from './ellipsoid.mts';
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
