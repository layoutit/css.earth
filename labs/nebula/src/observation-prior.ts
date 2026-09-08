/** Offline calibrated image/ray mapping and sampling of the unchanged neutral stellar prior. */
import { prepareOverlayGeometry } from './overlay-geometry.js';
import { overlayCorners, type ImageWcs, type OverlayFrame } from './overlay-wcs.js';
import { sampleEncoded, type VolumeSource } from '../../../src/preparation/volume/source.js';
import { channelDensity } from '../../../src/preparation/volume/slices.js';

type Vec3 = [number, number, number];
type Vec2 = [number, number];
export interface ObservationMapping {
  distanceUnits: number;
  boundsUnits: { min: Vec2; max: Vec2 };
  tangentAtUv(u: number, v: number): Vec2;
  /** Null outside the full calibrated photo footprint; no edge extension. */
  uvAtTangent(x: number, y: number): Vec2 | null;
  pointAtDepth(x0: number, y0: number, z: number): Vec3;
  tangentAtPoint(x: number, y: number, z: number): Vec2;
  /** ds/dz for physical ray-length integration. */
  rayPathPerDepth(x0: number, y0: number): number;
}
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
export interface ObservationPrior {
  density: Float32Array;
  dimensions: Vec3;
  /** These are tangent-X, tangent-Y and physical-Z coordinates; caller's local unit must be kpc. */
  boundsKpc: { min: Vec3; max: Vec3 };
  diagnostics: { sampledCells: number; nonzeroCells: number; sourceDepthRetained: boolean; meaning: string };
}
/** A coarse ray-coordinate prior, not a crop or mutation of the source volume. */
export function reprojectObservationPrior(source: VolumeSource, mapping: ObservationMapping, options: {
  dimensions: Vec3; boundsUnits?: { min: Vec2; max: Vec2 };
}): ObservationPrior {
  const dimensions = [...options.dimensions] as Vec3, [nx, ny, nz] = dimensions;
  if (dimensions.length !== 3 || dimensions.some(value => !Number.isInteger(value) || value < 1) || nx * ny * nz > 8_388_608) {
    throw new TypeError('Observation prior requires at most 8,388,608 positive integer cells.');
  }
  const rectangle = options.boundsUnits ?? mapping.boundsUnits;
  if (rectangle.min.length !== 2 || rectangle.max.length !== 2 || rectangle.min.some((value, i) =>
    !Number.isFinite(value) || !Number.isFinite(rectangle.max[i]) || value >= rectangle.max[i])) throw new TypeError('Observation bounds must be finite increasing intervals.');
  const boundsKpc = { min: [...rectangle.min, source.recipe.grid.bounds.min[2]] as Vec3,
    max: [...rectangle.max, source.recipe.grid.bounds.max[2]] as Vec3 };
  if (boundsKpc.min[2] <= -mapping.distanceUnits) throw new TypeError('Density extends behind the observation origin.');
  const density = new Float32Array(nx * ny * nz), encoded: [number, number, number, number] = [0, 0, 0, 0];
  let nonzeroCells = 0;
  for (let z = 0; z < nz; z++) {
    const pz = boundsKpc.min[2] + (z + .5) / nz * (boundsKpc.max[2] - boundsKpc.min[2]);
    const factor = 1 + pz / mapping.distanceUnits;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const px = rectangle.min[0] + (x + .5) / nx * (rectangle.max[0] - rectangle.min[0]);
      const py = rectangle.min[1] + (y + .5) / ny * (rectangle.max[1] - rectangle.min[1]);
      sampleEncoded(source, px * factor, py * factor, pz, encoded);
      const value = channelDensity(encoded[3], source.recipe.grid.encoding);
      density[(z * ny + y) * nx + x] = value;
      if (value > 0) nonzeroCells++;
    }
  }
  return { density, dimensions, boundsKpc, diagnostics: { sampledCells: density.length, nonzeroCells,
    sourceDepthRetained: true,
    meaning: 'Trilinearly filtered encoded stellar support decoded after filtering, sampled on calibrated observer rays. Relative clipped/quantized density prior; no luminosities, dust, or measured star depths.' } };
}
