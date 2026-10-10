import type { DensityVolumeFrame } from '@cssearth/objects';

/** A sight line from the Sun (Sun-ICRF unit vector) where it meets the sky plane through a frame's origin, in that
 * frame's units: the plane is local z = 0, which the image-layer banks keep across the line of sight. */
export function skyPlanePoint(ray: readonly number[], frame: Pick<DensityVolumeFrame, 'originM' | 'localToReferenceXyzw' | 'metersPerUnit'>): [number, number, number] {
  const o = frame.originM, along = ray[0]! * o[0]! + ray[1]! * o[1]! + ray[2]! * o[2]!;
  if (!(along > 0)) throw new TypeError('A photograph corner looks away from the object.');
  const t = (o[0]! * o[0]! + o[1]! * o[1]! + o[2]! * o[2]!) / along;
  const d = [ray[0]! * t - o[0]!, ray[1]! * t - o[1]!, ray[2]! * t - o[2]!];
  // The frame's quaternion turns local into reference; its conjugate turns back.
  const [qx, qy, qz, qw] = frame.localToReferenceXyzw as [number, number, number, number], x = -qx, y = -qy, z = -qz;
  const ix = qw * d[0]! + y * d[2]! - z * d[1]!, iy = qw * d[1]! + z * d[0]! - x * d[2]!, iz = qw * d[2]! + x * d[1]! - y * d[0]!, iw = -x * d[0]! - y * d[1]! - z * d[2]!;
  const local = [ix * qw - iw * x - iy * z + iz * y, iy * qw - iw * y - iz * x + ix * z, iz * qw - iw * z - ix * y + iy * x].map(value => value / frame.metersPerUnit);
  // The plane is z = 0 only when the frame's z axis is the sight line to its origin, as the image-layer bake builds it.
  if (Math.abs(local[2]!) > 1e-9 * Math.sqrt(o[0]! * o[0]! + o[1]! * o[1]! + o[2]! * o[2]!) / frame.metersPerUnit) throw new TypeError('The bank frame does not keep its z axis along the line of sight.');
  return [local[0]!, local[1]!, 0];
}
