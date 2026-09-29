/** Perry et al. (2025) registered JIRAM FITS products. Geometry and image planes
 * retain the producer's pixel order; the archived radiance is already mirrored.
 * https://doi.org/10.3847/PSJ/adbae3, Appendix B.
 */
import { readFitsImage } from '@cssearth/fits';
import { fitCamera, project } from '@cssearth/bake/objects/layers/terrestrial';
import { subtractColumnBackground } from './jiram-mosaic.mts';

export const WIDTH = 432, HEIGHT = 128, IFOV = 2.378e-4;
export interface RegisteredPlanes {
  radiance: Float64Array; latitude: Float64Array; longitude: Float64Array;
  emission: Float64Array; range: Float64Array; saturation: Float64Array;
}

export function readPlane(bytes: Buffer, mask = false) {
  const image = readFitsImage(bytes);
  if (image.width !== WIDTH || image.height !== HEIGHT || image.dimensions.length !== 2 ||
      image.header.BITPIX !== (mask ? 16 : -32) || (image.header.BSCALE ?? 1) !== 1 || (image.header.BZERO ?? 0) !== 0 ||
      image.values.some(v => !Number.isFinite(v) || (mask && v !== 0 && v !== 255))) {
    throw new Error('Expected a finite 432 × 128 Perry JIRAM plane; saturation must be 0 or 255.');
  }
  return image.values;
}

/** Invert the producer's recpgr(IO, point, a, (a-c)/a) on its triaxial
 * ellipsoid, not on the oblate reference spheroid alone. The unpublished
 * geodetic height is recovered from the ellipsoid intersection nearest zero.
 * Producer: volcanopele/juno, fe0fea9, jiramgeombackplane.py:328–340.
 */
export function planetographicPoint(latitude: number, longitudeWest: number, radii: readonly number[]) {
  const lat = latitude * Math.PI / 180, lon = -longitudeWest * Math.PI / 180;
  const e2 = 1 - (radii[2] / radii[0]) ** 2, N = radii[0] / Math.sqrt(1 - e2 * Math.sin(lat) ** 2);
  const normal = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  const base = [N * normal[0], N * normal[1], N * (1 - e2) * normal[2]];
  const A = normal.reduce((s, v, k) => s + v * v / radii[k] ** 2, 0);
  const B = 2 * base.reduce((s, v, k) => s + v * normal[k] / radii[k] ** 2, 0);
  const C = base.reduce((s, v, k) => s + v * v / radii[k] ** 2, 0) - 1;
  const h = -2 * C / (B + Math.sqrt(B * B - 4 * A * C));
  return base.map((v, k) => v + h * normal[k]);
}

/** Recover the controlled camera using distributed native pixels, check disjoint
 * pixels and archived ranges, and subtract the same cold-column background as
 * the RDR mosaic. Reprojection precision measures this transfer, not absolute
 * feature-location accuracy. Saturation and unsupported columns stay missing.
 */
export function registerFrame(planes: RegisteredPlanes, radii: readonly number[], sunDirection: readonly number[], policy: {
  maximumEmissionDegrees: number; terminatorFootprints: number; minimumBackgroundSamples: number;
  maximumResidualPixels: number; maximumRangeFraction: number;
}) {
  if (Object.values(planes).some(p => p.length !== WIDTH * HEIGHT)) throw new Error('Mismatched JIRAM planes.');
  const points: number[][] = [], pixels: number[][] = [], holdouts: { point: number[]; x: number; y: number; index: number }[] = [];
  const values = Float32Array.from(planes.radiance), night = new Uint8Array(values.length);
  const radius = (radii[0] * radii[1] * radii[2]) ** (1 / 3);
  let saturated = 0;
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const i = y * WIDTH + x, lat = planes.latitude[i], lon = planes.longitude[i], emission = planes.emission[i], range = planes.range[i];
    if (planes.saturation[i] !== 0) { values[i] = NaN; saturated++; }
    if (lat === -1024 || lon === -1024 || emission === -1024 || range === -1024) { values[i] = NaN; continue; }
    if (Math.abs(lat) > 90 || lon < 0 || lon > 360 || emission < 0 || emission > 90 || !(range > 0)) throw new Error('Invalid on-body JIRAM geometry.');
    if (emission > policy.maximumEmissionDegrees) { values[i] = NaN; continue; }
    const point = planetographicPoint(lat, lon, radii), n = point.map((v, k) => v / radii[k] ** 2), length = Math.hypot(...n);
    const footprint = range * IFOV / Math.cos(emission * Math.PI / 180);
    if (n.reduce((s, v, k) => s + v / length * sunDirection[k], 0) <= -policy.terminatorFootprints * footprint / radius) night[i] = 1;
    else values[i] = NaN;
    // Fit every eighth sample/line; holdouts occupy different rows and columns.
    if (x % 8 === 0 && y % 8 === 0) { points.push(point); pixels.push([x, y]); }
    else if (x % 7 === 3 && y % 7 === 3) holdouts.push({ point, x, y, index: i });
  }
  const corrected = subtractColumnBackground(values, night, policy.minimumBackgroundSamples);
  const offsets = Array.from(corrected.offsets).filter(Number.isFinite).sort((a, b) => a - b);
  const background = { columns: offsets.length, median: offsets.length ? offsets[offsets.length >> 1] : null };
  const report = { saturatedPixels: saturated, background, fitPixels: points.length, holdoutPixels: holdouts.length };
  if (!offsets.length || points.length < 12 || holdouts.length < 12) return { report, rejected: 'insufficient geometry or cold-night column samples' };
  let camera: ReturnType<typeof fitCamera>;
  try { camera = fitCamera(points, pixels, WIDTH, HEIGHT); }
  catch { return { report, rejected: 'degenerate geometry' }; }
  let maximumResidualPixels = 0, maximumRangeFraction = 0;
  for (const { point, x, y, index } of holdouts) {
    const p = project(camera.matrix, point);
    maximumResidualPixels = Math.max(maximumResidualPixels, Math.hypot(p[0] - x, p[1] - y));
    maximumRangeFraction = Math.max(maximumRangeFraction, Math.abs(Math.hypot(...camera.positionKm.map((v, k) => v - point[k])) / planes.range[index] - 1));
  }
  const checked = { ...report, maximumResidualPixels, maximumRangeFraction };
  if (!Number.isFinite(maximumResidualPixels + maximumRangeFraction) || maximumResidualPixels > policy.maximumResidualPixels || maximumRangeFraction > policy.maximumRangeFraction) {
    return { report: checked, rejected: 'camera disagrees with archived geometry' };
  }
  return { report: checked, camera: { ...camera, sunDirection: [...sunDirection] }, values: corrected.values };
}
