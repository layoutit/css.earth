import { cross3 as cross } from '../../../src/platform/vector3.mts';
/** Camera providers. Each turns what an archive or a kernel set gives into the one ObservationCamera contract. */
import type { ObservationCamera } from './contract.mts';
import { parseArchivedCamera } from '../terrestrial-layers/source-records.mts';
import { fitCamera, project } from '../terrestrial-layers/osiris-geo.mts';
import { dotN as dot } from '../../../src/platform/vector3.mts';

const unit = (a: readonly number[]) => { const n = Math.hypot(...a); return a.map(v => v / n); };

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
/**
 * Recover the Sun direction from archive backplanes. At every surface point the phase angle is the angle between the
 * direction to the camera and the direction to the Sun, and the Sun is one direction for the whole frame, so the
 * archive's phase plane and its surface points determine it by least squares over the disc. A disjoint holdout must
 * agree to a stated fraction of a degree; nothing outside the archive enters.
 */
export function fitBackplaneSun(frame: { width: number; height: number; valid(index: number): boolean; xyz(index: number): number[]; planes: Record<string, ArrayLike<number>> }, positionKm: readonly number[], maximumResidualDegrees = 0.25) {
  const phase = frame.planes.PHASE_ANGLE_IMAGE;
  if (!phase) return null;
  const toCamera = (i: number) => unit(positionKm.map((n, k) => n - frame.xyz(i)[k]));
  // Normal equations for s in c·s = cos φ over the fitting pixels, then the unit vector; one pass is enough for a direction fitted to hundreds of points.
  const a = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
  let fitted = 0;
  for (let i = 0; i < frame.width * frame.height; i += 179) {
    if (!frame.valid(i) || !Number.isFinite(phase[i])) continue;
    const c = toCamera(i), y = Math.cos(phase[i]);
    for (let r = 0; r < 3; r++) { b[r] += c[r] * y; for (let k = 0; k < 3; k++) a[r][k] += c[r] * c[k]; }
    fitted++;
  }
  if (fitted < 32) return null;
  const columns = [cross(a[1], a[2]), cross(a[2], a[0]), cross(a[0], a[1])], determinant = dot(a[0], columns[0]);
  if (!(Math.abs(determinant) > 1e-12)) throw new Error('The phase plane does not determine a Sun direction.');
  const sun = unit([0, 1, 2].map(r => columns.map(column => column[r] / determinant)).map(row => dot(row, b)));
  let count = 0, squared = 0, maximum = 0;
  for (let i = 0; i < frame.width * frame.height; i++) {
    if (i % 179 === 0 || !frame.valid(i) || !Number.isFinite(phase[i])) continue;
    const residual = Math.abs(Math.acos(Math.max(-1, Math.min(1, dot(toCamera(i), sun)))) - phase[i]) * 180 / Math.PI;
    count++; squared += residual * residual; maximum = Math.max(maximum, residual);
  }
  const rms = count ? Math.sqrt(squared / count) : 0;
  if (rms > maximumResidualDegrees) throw new Error(`The fitted Sun direction disagrees with the archive's phase plane by ${rms.toFixed(3)} degrees RMS over ${count} holdout pixels.`);
  return { sunDirection: sun, fit: { method: 'phase-plane-least-squares', fittedPixels: fitted, holdoutPixels: count, rmsDegrees: rms, maximumDegrees: maximum, maximumResidualDegrees } };
}

export function fittedCamera(frame: Parameters<typeof fitBackplaneCamera>[0] & { planes?: Record<string, ArrayLike<number>> }): ObservationCamera {
  const camera = fitBackplaneCamera(frame);
  const m = camera.matrix.map(row => row.slice(0, 3)), columns = [cross(m[1], m[2]), cross(m[2], m[0]), cross(m[0], m[1])], determinant = dot(m[0], columns[0]);
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) throw new Error('GEO camera projection is degenerate.');
  const inverse = [0, 1, 2].map(i => columns.map(column => column[i] / determinant));
  // Every camera is lit: the archive's phase plane gives the Sun, and a frame without one cannot become a camera.
  const sun = frame.planes ? fitBackplaneSun({ ...frame, planes: frame.planes }, camera.positionKm) : null;
  if (!sun) throw new Error('The archive backplanes carry no phase plane, so the frame states no Sun direction.');
  return { kind: 'backplane-fit', positionKm: camera.positionKm, positionMeters: camera.positionKm.map(n => n * 1000), pinhole: true,
    sunDirection: sun.sunDirection, report: { ...camera, sun: sun.fit },
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

/**
 * A camera turned about the body's pole by a measured angle: the body turned by that angle is the same sight as the
 * camera turned the other way, so the position, the Sun and every ray are rotated and the projection takes its points
 * through the inverse turn. The provider's camera is kept in the report beside the turn, so nothing is fitted quietly.
 */
export function turnedCamera(camera: ObservationCamera, degrees: number, refinement: Record<string, unknown>): ObservationCamera {
  if (!Number.isFinite(degrees)) throw new TypeError('A camera is turned by a finite angle.');
  const a = -degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  const turn = (v: readonly number[]) => [c * v[0] - s * v[1], s * v[0] + c * v[1], v[2]];
  const back = (v: readonly number[]) => [c * v[0] + s * v[1], -s * v[0] + c * v[1], v[2]];
  const positionMeters = turn(camera.positionMeters);
  return { ...camera, positionMeters, positionKm: positionMeters.map(n => n / 1000), sunDirection: turn(camera.sunDirection),
    ray: (x, y) => turn(camera.ray(x, y)), project: point => camera.project(back(point)),
    report: { ...camera.report, refinement: { ...refinement, turnDegrees: degrees } } };
}

/**
 * A camera tilted about its own line of sight by a measured angle: the body's pole seen tilted in the sky is the same
 * sight as the camera rolled the other way about the line from the body to it, so the rays and the Sun turn about
 * that line and the projection takes its points through the inverse roll. The position stays; the provider's camera
 * is kept in the report beside the tilt.
 */
export function tiltedCamera(camera: ObservationCamera, degrees: number, refinement: Record<string, unknown>): ObservationCamera {
  if (!Number.isFinite(degrees)) throw new TypeError('A camera is tilted by a finite angle.');
  const axis = unit(camera.positionMeters), a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  // Rodrigues' rotation about the line of sight, and its inverse.
  const roll = (v: readonly number[], sign: number) => {
    const k = axis, kv = cross(k, v), kd = dot(k, v);
    return v.map((n, i) => n * c + sign * s * kv[i] + k[i] * kd * (1 - c));
  };
  return { ...camera, sunDirection: roll(camera.sunDirection, 1), ray: (x, y) => roll(camera.ray(x, y), 1), project: point => camera.project(roll(point, -1)),
    report: { ...camera.report, refinement: { ...(camera.report.refinement as Record<string, unknown> | undefined ?? {}), ...refinement, tiltDegrees: degrees } } };
}
