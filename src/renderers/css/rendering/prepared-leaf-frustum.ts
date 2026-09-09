import type { PositionM } from '@cssearth/engine';
import type { WorldCameraViewport } from '../navigation/world-camera.js';

/** Bounds of the final compiled image rectangle, in its scene's CSS coordinates. */
export interface PreparedLeafBounds { readonly min: PositionM; readonly max: PositionM; }

export function validatePreparedLeafBounds(value: unknown): void {
  const bounds = value as PreparedLeafBounds | undefined;
  if (!bounds || Object.keys(bounds).length !== 2 || !Array.isArray(bounds.min) || !Array.isArray(bounds.max) ||
      bounds.min.length !== 3 || bounds.max.length !== 3 ||
      !bounds.min.every((n, axis) => Number.isFinite(n) && Number.isFinite(bounds.max[axis]) && n <= bounds.max[axis]!)) {
    throw new TypeError('Prepared leaf bounds must be finite ordered CSS coordinates.');
  }
}

/** Transport five camera clip planes into the prepared leaf coordinate frame.
 * Missing viewport dimensions conservatively retain every leaf. The two-pixel
 * guard keeps grazing images across browser matrix/raster rounding. No DOM reads. */
export function createPreparedLeafFrustum(rotation: readonly number[], translation: readonly number[], viewport: WorldCameraViewport) {
  const { widthPixels: width, heightPixels: height, focalPixels: f } = viewport;
  if (!width || !height || !Number.isFinite(width) || !Number.isFinite(height) || width < 0 || height < 0) return null;
  // Match the published CSS camera, rather than a different ideal matrix.
  const r = rotation.map(n => Number(n.toFixed(12))), t = translation.map(n => Number(n.toFixed(6)));
  const [ox, oy] = viewport.principalOffsetPixels.map(n => Number(n.toFixed(6))), focal = Number(f.toFixed(6)), guard = 2;
  return [
    [0, 0, -1, focal],
    [focal, 0, -(width / 2 + ox! + guard), focal * (width / 2 + guard)],
    [-focal, 0, -(width / 2 - ox! + guard), focal * (width / 2 + guard)],
    [0, focal, -(height / 2 + oy! + guard), focal * (height / 2 + guard)],
    [0, -focal, -(height / 2 - oy! + guard), focal * (height / 2 + guard)],
  ].map(([a, b, c, d]) => [
    a! * r[0]! + b! * r[3]! + c! * r[6]!,
    a! * r[1]! + b! * r[4]! + c! * r[7]!,
    a! * r[2]! + b! * r[5]! + c! * r[8]!,
    a! * t[0]! + b! * t[1]! + c! * t[2]! + d!,
  ]);
}

export function preparedLeafMayContribute(bounds: PreparedLeafBounds | undefined, planes: ReturnType<typeof createPreparedLeafFrustum>): boolean {
  if (!bounds || !planes) return true;
  for (const plane of planes) {
    let maximum = plane[3]!;
    for (let axis = 0; axis < 3; axis++) maximum += plane[axis]! * (plane[axis]! >= 0 ? bounds.max[axis]! : bounds.min[axis]!);
    if (maximum < -1e-7) return false;
  }
  return true;
}
