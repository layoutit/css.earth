import type { Matrix4 } from '../solar-system/types.js';

/** Complete raw scene coordinates to CSS eye coordinates (+Z toward the eye).
 * The matrix includes scene scale and the physical translation, without the
 * CSS perspective-origin/focal translation used to position the DOM carrier. */
export interface PhysicalProjection {
  readonly focalPixels: number;
  readonly principalOffsetPixels: readonly [number, number];
  readonly eyeFromScene: Matrix4;
}

/** Shared by detached incoming-view preparation and the mounted camera. */
export function physicalProjectionFromCamera(rotation: readonly number[], center: readonly number[], scale: number,
  viewport: { focalPixels: number; principalOffsetPixels: readonly [number, number] }): PhysicalProjection {
  return Object.freeze({ focalPixels: viewport.focalPixels, principalOffsetPixels: viewport.principalOffsetPixels,
    eyeFromScene: Object.freeze([
      rotation[0] * scale, rotation[3] * scale, rotation[6] * scale, 0,
      rotation[1] * scale, rotation[4] * scale, rotation[7] * scale, 0,
      rotation[2] * scale, rotation[5] * scale, rotation[8] * scale, 0,
      center[0], center[1], center[2], 1,
    ]) as Matrix4,
  });
}

export function requirePhysicalProjection(value: PhysicalProjection): PhysicalProjection {
  if (!(value.focalPixels > 0) || !Number.isFinite(value.focalPixels) ||
    value.principalOffsetPixels.length !== 2 || !value.principalOffsetPixels.every(Number.isFinite) ||
    value.eyeFromScene.length !== 16 || !value.eyeFromScene.every(Number.isFinite)) {
    throw new TypeError('Physical projection requires a finite eye transform and positive focal length.');
  }
  return value;
}

export interface EyePoint { x: number; y: number; z: number; }
export interface ProjectedCovariance { xx: number; xy: number; yy: number; }
export interface ProjectedEllipse { center: readonly [number, number]; covariance: ProjectedCovariance; }

/** Project the already-prepared ellipsoid (or planar disc) analytically.
 * Its dual quadric gives the exact perspective silhouette, including the
 * centre shift and radial stretch of an off-axis observer. No mesh is built. */
export function projectEyeEllipsoid(center: EyePoint, directions: readonly EyePoint[], radii: readonly number[], focal: number): ProjectedEllipse | null {
  const q = (a: keyof EyePoint, b: keyof EyePoint) => directions.reduce((sum, direction, i) =>
    sum + direction[a] * direction[b] * radii[i] ** 2, 0);
  const xx = q('x', 'x'), xy = q('x', 'y'), yy = q('y', 'y');
  const xz = q('x', 'z'), yz = q('y', 'z'), zz = q('z', 'z');
  if (center.z + Math.sqrt(Math.max(0, zz)) >= 0) return null;
  const denominator = center.z ** 2 - zz;
  const x = focal * (xz - center.x * center.z) / denominator;
  const y = focal * (yz - center.y * center.z) / denominator;
  // Expand the covariance algebra to avoid subtracting two almost identical
  // projected centres when a tiny body lies far away and off axis.
  const factor = focal * focal / (denominator * denominator);
  return { center: [x, y], covariance: {
    xx: factor * (xx * denominator + center.x ** 2 * zz - 2 * center.x * center.z * xz + xz * xz),
    xy: factor * (xy * denominator + center.x * center.y * zz - (center.x * yz + center.y * xz) * center.z + xz * yz),
    yy: factor * (yy * denominator + center.y ** 2 * zz - 2 * center.y * center.z * yz + yz * yz),
  } };
}
