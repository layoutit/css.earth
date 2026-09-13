/** Camera providers. Each turns what an archive or a kernel set gives into the one ObservationCamera contract. */
import type { ObservationCamera } from './contract.mts';
import { parseArchivedCamera } from '../terrestrial-layers/source-records.mts';
import { fitCamera, project } from '../terrestrial-layers/osiris-geo.mts';

const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const unit = (a: readonly number[]) => { const n = Math.hypot(...a); return a.map(v => v / n); };
const cross = (a: readonly number[], b: readonly number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

/** Lens distortion between pinhole and detector pixels, such as a FITS TAN-SIP solution. Points are kilometres. */
export interface PixelDistortion { projectPoint(pointKm: readonly number[]): number[]; rayPixel(x: number, y: number): number[] }

/** A camera given as a 3 × 4 projection and its ray matrix in kilometres: an archived closure, or one derived from SPICE kernels. */
export function matrixCamera(kind: 'archived-closure' | 'kernels', value: unknown, distortion?: PixelDistortion): ObservationCamera {
  const camera = parseArchivedCamera(value);
  if (camera.schema !== 'cssearth-archived-camera@1' ||
      camera.matrix?.length !== 3 || camera.matrix.some(r => r.length !== 4 || !r.every(Number.isFinite)) ||
      camera.rayMatrix?.length !== 3 || camera.rayMatrix.some(r => r.length !== 3 || !r.every(Number.isFinite)) ||
      camera.positionKm?.length !== 3 || !camera.positionKm.every(Number.isFinite) ||
      camera.sunDirection?.length !== 3 || Math.abs(Math.hypot(...camera.sunDirection) - 1) > 1e-9) throw new Error('Invalid archived source camera.');
  const { matrix, rayMatrix, positionKm, sunDirection } = camera;
  return { kind, positionKm, positionMeters: positionKm.map(n => n * 1000), sunDirection, pinhole: !distortion, report: camera,
    project: point => { const km = point.map(n => n / 1000); return distortion ? distortion.projectPoint(km) : project(matrix, km); },
    ray: (x, y) => unit(rayMatrix.map(row => dot(row, [...(distortion ? distortion.rayPixel(x, y) : [x, y]), 1]))) };
}

/** Recover the controlled pinhole camera from archived surface-point and pixel pairs. A disjoint holdout covers every remaining
 * geometry-backed pixel, and the fit must explain it to a hundredth of a pixel. */
export function fitBackplaneCamera(frame: { width: number; height: number; valid(index: number): boolean; xyz(index: number): number[] }) {
  const points = [], pixels = [];
  for (let i = 0; i < frame.width * frame.height; i += 179) if (frame.valid(i)) {
    points.push(frame.xyz(i)); pixels.push([i % frame.width, Math.floor(i / frame.width)]);
  }
  const camera = fitCamera(points, pixels, frame.width, frame.height);
  let count = 0, maximum = 0, squared = 0;
  for (let i = 0; i < frame.width * frame.height; i++) if (i % 179 !== 0 && frame.valid(i)) {
    const p = project(camera.matrix, frame.xyz(i)), residual = Math.hypot(p[0] - i % frame.width, p[1] - Math.floor(i / frame.width));
    if (!Number.isFinite(residual) || p[2] <= 0) throw new Error('GEO camera has an invalid projection.');
    count++; maximum = Math.max(maximum, residual); squared += residual * residual;
  }
  if (count < points.length || maximum > .01) throw new Error('GEO camera does not explain independent holdout coordinates.');
  return { ...camera, fitPixels: points.length, holdoutPixels: count, maximumResidualPixels: maximum, rmsResidualPixels: Math.sqrt(squared / count) };
}

/** The fitted backplane camera as an ObservationCamera; its rays follow the inverse of the fitted projection. */
export function fittedCamera(frame: Parameters<typeof fitBackplaneCamera>[0]): ObservationCamera {
  const camera = fitBackplaneCamera(frame), report = camera;
  const m = camera.matrix.map(row => row.slice(0, 3)), columns = [cross(m[1], m[2]), cross(m[2], m[0]), cross(m[0], m[1])], determinant = dot(m[0], columns[0]);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) throw new Error('GEO camera projection is degenerate.');
  const inverse = [0, 1, 2].map(i => columns.map(column => column[i] / determinant));
  return { kind: 'backplane-fit', positionKm: camera.positionKm, positionMeters: camera.positionKm.map(n => n * 1000), pinhole: true, report,
    project: point => project(camera.matrix, point.map(n => n / 1000)),
    ray: (x, y) => unit(inverse.map(row => dot(row, [x, y, 1]))) };
}

/** The camera's angular pixel size in radians: the median angle between neighbouring pixel rays over a coarse detector grid. */
export function pixelAngle(camera: Pick<ObservationCamera, 'ray'>, width: number, height: number) {
  const angles: number[] = [], step = Math.max(1, Math.floor(Math.min(width, height) / 16));
  for (let y = step >> 1; y + 1 < height; y += step) for (let x = step >> 1; x + 1 < width; x += step) {
    const a = camera.ray(x, y);
    for (const b of [camera.ray(x + 1, y), camera.ray(x, y + 1)]) angles.push(2 * Math.asin(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 2));
  }
  if (!angles.length) throw new Error('A detector needs at least two pixels on each axis.');
  return median(angles);
}
