import { type ObservationMapping, overlayCorners, type ImageWcs, type OverlayFrame, reprojectObservationPrior as reproject } from '@cssearth/bake/volume';
export type { ObservationMapping } from '@cssearth/bake/volume';
/** Offline calibrated image/ray mapping and sampling of the unchanged neutral stellar prior. */
import { prepareOverlayGeometry } from '../renderer/overlay-geometry.ts';
import { sampleEncoded, type VolumeSource } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { channelDensity } from '@cssearth/volume-bake/slices/density';

type Vec3 = [number, number, number];
type Vec2 = [number, number];
function invert3(m: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = m;
  const values = [e * i - f * h, c * h - b * i, b * f - c * e,
    f * g - d * i, a * i - c * g, c * d - a * f,
    d * h - e * g, b * g - a * h, a * e - b * d];
  const determinant = a * values[0] + b * values[3] + c * values[6];
  if (!Number.isFinite(determinant) || determinant === 0) throw new TypeError('Observation mapping is singular.');
  return values.map(value => value / determinant);
}
function project(m: number[], x: number, y: number): Vec2 {
  const divisor = m[6] * x + m[7] * y + m[8];
  if (![x, y, divisor].every(Number.isFinite) || Math.abs(divisor) < 1e-12) throw new TypeError('Observation point crosses the projection horizon.');
  return [(m[0] * x + m[1] * y + m[2]) / divisor, (m[3] * x + m[4] * y + m[5]) / divisor];
}
/** UV uses full image edges, top-left (0,0); pixel centre is ((column+.5)/width,(row+.5)/height). */
export function createObservationMapping(wcs: ImageWcs, frame: OverlayFrame): ObservationMapping {
  if (!(frame.metersPerUnit > 0) || !Number.isFinite(frame.metersPerUnit)) throw new TypeError('Observation units must be positive.');
  const distanceUnits = Math.hypot(...frame.originM) / frame.metersPerUnit;
  if (!(distanceUnits > 0) || !Number.isFinite(distanceUnits)) throw new TypeError('Observation needs a finite observer distance.');
  const [qx, qy, qz, qw] = frame.localToReferenceXyzw;
  const away = [2 * (qx * qz + qw * qy), 2 * (qy * qz - qw * qx), 1 - 2 * (qx * qx + qy * qy)];
  const originLength = Math.hypot(...frame.originM);
  if (Math.abs(Math.hypot(qx, qy, qz, qw) - 1) > 1e-10 ||
      away.some((value, axis) => !Number.isFinite(value) || Math.abs(value - frame.originM[axis] / originLength) > 1e-10)) {
    throw new TypeError('Observation mapping requires local +z to point away from the observer.');
  }
  const corners = overlayCorners(wcs, frame);
  const geometry = prepareOverlayGeometry(corners, 1, 1), css = geometry.matrix.split(',').map(Number);
  // Undo offline PolyCSS [y,x,z]*50 transport. Only the calibrated physical plane remains.
  const forward = [css[1] / 50, css[5] / 50, css[13] / 50,
    css[0] / 50, css[4] / 50, css[12] / 50, css[3], css[7], css[15]];
  const inverse = invert3(forward);
  const factor = (z: number) => {
    const value = 1 + z / distanceUnits;
    if (!Number.isFinite(value) || value <= 0) throw new TypeError('Observation depth is at or behind the observer.');
    return value;
  };
  return { distanceUnits,
    boundsUnits: { min: [Math.min(...corners.map(p => p[0])), Math.min(...corners.map(p => p[1]))],
      max: [Math.max(...corners.map(p => p[0])), Math.max(...corners.map(p => p[1]))] },
    tangentAtUv: (u, v) => project(forward, u, v),
    uvAtTangent(x, y) {
      const uv = project(inverse, x, y);
      if (uv.some(value => value < -1e-12 || value > 1 + 1e-12)) return null;
      return uv.map(value => Math.max(0, Math.min(1, value))) as Vec2;
    },
    pointAtDepth(x, y, z) { const scale = factor(z); return [x * scale, y * scale, z]; },
    tangentAtPoint(x, y, z) { const scale = factor(z); return [x / scale, y / scale]; },
    rayPathPerDepth: (x, y) => Math.hypot(1, x / distanceUnits, y / distanceUnits),
  };
}
export type {ObservationPrior} from '@cssearth/bake/volume';
export function reprojectObservationPrior(source:VolumeSource,mapping:ObservationMapping,options:Parameters<typeof reproject>[2]) {
 const encoded:[number,number,number,number]=[0,0,0,0];
 return reproject({bounds:source.recipe.grid.bounds,densityAt(x,y,z){sampleEncoded(source,x,y,z,encoded);return channelDensity(encoded[3],source.recipe.grid.encoding);}},mapping,options);
}
