import type { PreparedCssPointField, PreparedPointFieldStar, PreparedPointFieldNode, PointFieldVector as Vector3 } from './types.js';
import type { PreparedPointFieldInput } from '@cssearth/engine';
type Matrix3 = PreparedPointFieldInput['viewRotation'];

// A retained numeric sample belongs to a DOM slot. Observer translation changes
// distance/photometry; orientation and optics only change its screen projection.
// Keeping those dependencies separate avoids allocation and repeated logarithms
// during rotation, without quantizing the physical observer or delaying a frame.
export function createPointSample() {
  return { point: null as PreparedPointFieldStar | PreparedPointFieldNode | null,
    eye: [NaN, NaN, NaN], relative: [0, 0, 0] as [number, number, number],
    light: { magnitude: 0, radiusPx: 0, luminance: 0 },
    x: 0, y: 0, depth: 0, size: 0 };
}
export type PointSample = ReturnType<typeof createPointSample>;
export function samplePreparedPoint(sample: PointSample, point: PreparedPointFieldStar | PreparedPointFieldNode,
  payload: PreparedCssPointField, eye: Vector3, rotation: Matrix3, focal: number, ox: number, oy: number) {
  if (sample.point !== point || sample.eye[0] !== eye[0] || sample.eye[1] !== eye[1] || sample.eye[2] !== eye[2]) {
    sample.point = point;
    for (let axis = 0; axis < 3; axis++) {
      sample.eye[axis] = eye[axis];
      sample.relative[axis] = point.positionUnits[axis] - eye[axis];
    }
    sample.light = pointPhotometry(payload, point.absoluteMagnitude, Math.hypot(...sample.relative),
      'coverageAnchor' in point && point.coverageAnchor);
    sample.size = sample.light.radiusPx * 2 * payload.atlas.haloRadii;
  }
  const [x, y, z] = sample.relative;
  sample.depth = -(rotation[6] * x + rotation[7] * y + rotation[8] * z);
  sample.x = ox + focal * (rotation[0] * x + rotation[1] * y + rotation[2] * z) / sample.depth;
  sample.y = oy + focal * (rotation[3] * x + rotation[4] * y + rotation[5] * z) / sample.depth;
  return sample;
}

export function projectPreparedPoint(position: Vector3, eye: Vector3, rotation: Matrix3, focal: number, ox = 0, oy = 0) {
  const x = position[0] - eye[0], y = position[1] - eye[1], z = position[2] - eye[2];
  const depth = -(rotation[6] * x + rotation[7] * y + rotation[8] * z);
  return { x: ox + focal * (rotation[0] * x + rotation[1] * y + rotation[2] * z) / depth,
    y: oy + focal * (rotation[3] * x + rotation[4] * y + rotation[5] * z) / depth,
    depth, distanceUnits: Math.hypot(x, y, z) };
}

/** Opacity below half an 8-bit step cannot change a composited pixel. Coverage
 * anchors keep their prepared floor and stay shown at any positive luminance. */
export const IMPERCEPTIBLE_LUMINANCE = 0.5 / 255;
export function pointLuminanceVisible(luminance: number, coverageAnchor = false) {
  return coverageAnchor ? luminance > 0 : luminance >= IMPERCEPTIBLE_LUMINANCE;
}

/** Apparent magnitude selects/interpolates prepared exposure samples, not source imagery. */
export function pointPhotometry(payload: PreparedCssPointField, absoluteMagnitude: number, distanceUnits: number, coverageAnchor = false) {
  const distancePc = distanceUnits * payload.frame.metersPerUnit / 3.085677581491367e16;
  const magnitude = absoluteMagnitude + 5 * Math.log10(Math.max(distancePc, Number.MIN_VALUE)) - 5;
  const table = payload.photometry;
  const coordinate = Math.max(0, Math.min(table.samples.length - 1, (magnitude - table.minimumMagnitude) / table.step));
  const index = Math.floor(coordinate), t = coordinate - index;
  const a = table.samples[index], b = table.samples[Math.min(index + 1, table.samples.length - 1)];
  return { magnitude, radiusPx: Math.max(coverageAnchor ? table.minimumRadiusPx : 0, a.radiusPx + (b.radiusPx - a.radiusPx) * t),
    luminance: Math.max(coverageAnchor ? table.floor : 0, a.luminance + (b.luminance - a.luminance) * t) };
}
