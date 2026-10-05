/**
 * Place Voyager 2 narrow-angle GEOMED frames of Neptune on the planet's spheroid.
 *
 *   recorded (SEDR) pointing → limb of the oblate planet found in the frame → corrected camera
 *
 * The recorded pointing is off by tens to hundreds of pixels, so the limb is found in the image, as for the moons
 * (`../voyager-iss/limb.mts`). Neptune is 1.7 % flattened, which is several pixels on these discs, so the edge points are
 * fitted to the spheroid's own limb as the camera projects it, not to a circle. Only the frame's translation is solved.
 */
import { pds3Keyword } from '@cssearth/telescope';
import { spiceCamera, utcToEt } from '@cssearth/spice';
import type { KernelSet } from '@cssearth/spice/node';
import { decodeGeomed } from '../voyager-iss/place.mts';

export const NEPTUNE = { observer: -32, target: 899, bodyFrame: 'IAU_NEPTUNE', instrument: -32101, frame: 'VG2_ISSNA', aberration: 'LT+S' } as const;
export interface Spheroid { equatorialKm: number; polarKm: number }
export interface NeptuneFrame {
  id: string; filter: string; imageTime: string; et: number;
  width: number; height: number; values: Float32Array;
  /** 1 where a pixel and everything within `USABLE_MARGIN_PIXELS` of it holds positive data: clear of the picture's border and dropouts. */
  usable: Uint8Array;
  /** Projects a body-fixed point in km to detector pixels, after the limb correction. */
  matrix: number[][];
  /** Observer and unit Sun direction in the body-fixed frame. */
  positionKm: number[]; sunDirection: number[];
  rangeKm: number; pixelScaleKm: number; phaseDegrees: number;
  limb: { edgePoints: number; candidates: number; rmsPixels: number; shift: [number, number]; seed: 'prediction' | 'centroid'; accepted: boolean };
}

const LIMB = { searchPixels: 320, marginPixels: 12, inlierPixels: 2.5, minimumEdgePoints: 80, maximumRmsPixels: 1.5, sunlitCosine: Math.cos(80 * Math.PI / 180) } as const;

export const USABLE_MARGIN_PIXELS = 10;
/** Pixels with positive data all round them, by a summed-area count of the bad ones. */
function usablePixels(values: ArrayLike<number>, width: number, height: number, margin: number) {
  const stride = width + 1, bad = new Int32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) { let run = 0; for (let x = 0; x < width; x++) { if (!(values[y * width + x]! > 0)) run++; bad[(y + 1) * stride + x + 1] = bad[y * stride + x + 1]! + run; } }
  const usable = new Uint8Array(width * height);
  for (let y = margin; y < height - margin; y++) for (let x = margin; x < width - margin; x++) {
    const x0 = x - margin, x1 = x + margin + 1, y0 = y - margin, y1 = y + margin + 1;
    if (bad[y1 * stride + x1]! - bad[y0 * stride + x1]! - bad[y1 * stride + x0]! + bad[y0 * stride + x0]! === 0) usable[y * width + x] = 1;
  }
  return usable;
}

const label = (text: string, key: string) => {
  const value = pds3Keyword(text, key);
  if (value === undefined) throw new Error(`PDS3 label lacks ${key}.`);
  return value.replace(/^"|"$/g, '');
};
const project = (m: number[][], p: readonly number[]): [number, number] => {
  const w = m[2]![0]! * p[0]! + m[2]![1]! * p[1]! + m[2]![2]! * p[2]! + m[2]![3]!;
  return [(m[0]![0]! * p[0]! + m[0]![1]! * p[1]! + m[0]![2]! * p[2]! + m[0]![3]!) / w, (m[1]![0]! * p[0]! + m[1]![1]! * p[1]! + m[1]![2]! * p[2]! + m[1]![3]!) / w];
};

/** The spheroid's limb as the observer sees it: body-fixed points where the line of sight is tangent, `count` of them. */
export function spheroidLimb(observerKm: readonly number[], { equatorialKm: a, polarKm: c }: Spheroid, count = 720): number[][] {
  // In the space where the spheroid is the unit sphere the limb is a circle.
  const o = [observerKm[0]! / a, observerKm[1]! / a, observerKm[2]! / c], d = Math.hypot(...o), n = o.map(v => v / d);
  const seed = Math.abs(n[2]!) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const e1 = [n[1]! * seed[2]! - n[2]! * seed[1]!, n[2]! * seed[0]! - n[0]! * seed[2]!, n[0]! * seed[1]! - n[1]! * seed[0]!], l1 = Math.hypot(...e1);
  for (let i = 0; i < 3; i++) e1[i]! /= l1;
  const e2 = [n[1]! * e1[2]! - n[2]! * e1[1]!, n[2]! * e1[0]! - n[0]! * e1[2]!, n[0]! * e1[1]! - n[1]! * e1[0]!];
  const along = 1 / d, across = Math.sqrt(1 - 1 / (d * d)), points: number[][] = [];
  for (let i = 0; i < count; i++) {
    const t = 2 * Math.PI * i / count, u = [0, 1, 2].map(k => n[k]! * along + across * (Math.cos(t) * e1[k]! + Math.sin(t) * e2[k]!));
    points.push([u[0]! * a, u[1]! * a, u[2]! * c]);
  }
  return points;
}

/** Limb radius from a centre as a function of image angle, from a closed polyline around that centre. */
function radiusByAngle(polyline: readonly (readonly [number, number])[], centre: readonly [number, number], bins = 1440) {
  const radius = new Float64Array(bins).fill(NaN);
  for (const [x, y] of polyline) {
    const angle = Math.atan2(y - centre[1], x - centre[0]), bin = Math.floor(((angle + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * bins) % bins;
    radius[bin] = Math.hypot(x - centre[0], y - centre[1]);
  }
  // The polyline is twice as dense as needed; fill the bins it skipped from their neighbours.
  for (let i = 0; i < bins; i++) if (Number.isNaN(radius[i]!)) { let j = 1; while (Number.isNaN(radius[(i + j) % bins]!) && j < bins) j++; let k = 1; while (Number.isNaN(radius[(i - k + bins) % bins]!) && k < bins) k++; radius[i] = (radius[(i + j) % bins]! * k + radius[(i - k + bins) % bins]! * j) / (j + k); }
  return (dx: number, dy: number) => {
    const position = ((Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * bins - 0.5, i0 = Math.floor(position), f = position - i0;
    return radius[(i0 + bins) % bins]! * (1 - f) + radius[(i0 + 1 + bins) % bins]! * f;
  };
}

/** Sunlit limb points of the disc in a frame: the outermost steep bright-to-dark edge on each ray, with sky beyond and disc inside. */
function limbCandidates(image: { width: number; height: number; values: ArrayLike<number> }, centre: readonly [number, number], radius: (dx: number, dy: number) => number,
  sun: readonly [number, number], search: number) {
  const { width, height, values } = image, m = LIMB.marginPixels;
  const at = (x: number, y: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    if (x0 < m || y0 < m || x0 >= width - m - 1 || y0 >= height - m - 1) return NaN;
    const fx = x - x0, fy = y - y0, i = y0 * width + x0;
    return (values[i]! * (1 - fx) + values[i + 1]! * fx) * (1 - fy) + (values[i + width]! * (1 - fx) + values[i + width + 1]! * fx) * fy;
  };
  const all: number[] = [];
  for (let y = m; y < height - m; y += 2) for (let x = m; x < width - m; x += 2) { const v = values[y * width + x]!; if (!Number.isNaN(v)) all.push(v); }
  all.sort((p, q) => p - q);
  const sky = all[Math.floor(all.length * 0.05)]!, disc = all[Math.floor(all.length * 0.9)]!, span = disc - sky;
  const points: [number, number][] = [];
  if (!(span > 0.02)) return { points, sky, disc };
  for (let degrees = 0; degrees < 360; degrees += 0.5) {
    const c = Math.cos(degrees * Math.PI / 180), s = Math.sin(degrees * Math.PI / 180);
    if (c * sun[0] + s * sun[1] < LIMB.sunlitCosine) continue;
    const r0 = radius(c, s), step = (r: number) => at(centre[0] + c * (r - 1.5), centre[1] + s * (r - 1.5)) - at(centre[0] + c * (r + 1.5), centre[1] + s * (r + 1.5));
    for (let r = r0 + search; r > Math.max(20, r0 - search); r -= 0.5) {
      if (!(step(r) > 0.12 * span)) continue;
      let best = -Infinity, edge = r;
      for (let q = r - 3; q <= r + 3; q += 0.125) { const g = step(q); if (g > best) { best = g; edge = q; } }
      let dark = 0, outside = 0, lit = 0, inside = 0;
      for (let q = edge + 5; q < edge + 19; q++) { const v = at(centre[0] + c * q, centre[1] + s * q); if (Number.isNaN(v)) continue; outside++; if (v < sky + 0.2 * span) dark++; }
      for (let q = edge - 15; q < edge - 5; q++) { const v = at(centre[0] + c * q, centre[1] + s * q); if (Number.isNaN(v)) continue; inside++; if (v > sky + 0.3 * span) lit++; }
      if (outside >= 10 && dark >= 0.8 * outside && inside >= 6 && lit >= 0.8 * inside) { points.push([centre[0] + c * edge, centre[1] + s * edge]); break; }
      r = edge - 3;
    }
  }
  return { points, sky, disc };
}

/** Exposure time of a GEOMED frame as ephemeris time, from its label. */
export const frameEt = (labelText: string, set: KernelSet) => utcToEt(set.leapSeconds, `${label(labelText, 'IMAGE_TIME')}Z`);

/**
 * `pointingEt` names the time whose recorded scan-platform attitude is used. The SEDR kernel holds no record for many frames;
 * such a frame takes the attitude of the nearest frame that has one. The limb fit then solves where the planet sits, so only
 * the twist about the line of sight is borrowed, and the platform holds that through an approach sequence.
 */
export function placeNeptuneFrame(id: string, bytes: Buffer, labelText: string, set: KernelSet, spheroid: Spheroid, pointingEt?: number): NeptuneFrame {
  if (label(labelText, 'PRODUCT_ID') !== `${id.toUpperCase()}_GEOMED.IMG`) throw new Error(`Label does not describe ${id}.`);
  const filter = label(labelText, 'FILTER_NAME'), imageTime = label(labelText, 'IMAGE_TIME');
  const degreesPerPixel = Number(label(labelText, 'HORIZONTAL_PIXEL_FOV').split(/\s/)[0]);
  const image = decodeGeomed(bytes);
  if (!(degreesPerPixel > 0) || image.width !== 1000 || image.height !== 1000) throw new Error(`${id} is not a 1000 x 1000 GEOMED frame.`);
  const focalLengthPixels = 1 / (degreesPerPixel * Math.PI / 180), et = utcToEt(set.leapSeconds, `${imageTime}Z`);
  const optical: [number, number] = [(image.width - 1) / 2, (image.height - 1) / 2];
  const camera = spiceCamera({ pool: set.pool, ephemeris: set.ephemeris, rotation: set.rotation, observer: NEPTUNE.observer, target: NEPTUNE.target, bodyFrame: NEPTUNE.bodyFrame,
    instrument: NEPTUNE.instrument, et: pointingEt ?? et, ephemerisEt: et, aberration: NEPTUNE.aberration,
    pixels: { focalLengthPixels, center: optical, boresight: [0, 0, 1], column: [1, 0, 0], row: [0, 1, 0], frame: NEPTUNE.frame, width: image.width, height: image.height, focalLengthMm: NaN, pixelPitchMm: NaN } as never });
  const m = camera.matrix.map(row => [...row]), predictedCentre = project(m, [0, 0, 0]);
  const limbPixels = spheroidLimb(camera.positionKm, spheroid, 2880).map(point => project(m, point)), radius = radiusByAngle(limbPixels, predictedCentre);
  const sunPixel = project(m, camera.sunDirection.map(v => v * 100)), sx = sunPixel[0] - predictedCentre[0], sy = sunPixel[1] - predictedCentre[1], sn = Math.hypot(sx, sy);
  const sun: [number, number] = [sx / sn, sy / sn];
  // A disc that sits whole in the frame seeds the rays with its bright centroid; otherwise the recorded prediction does.
  const first = limbCandidates(image, predictedCentre, radius, sun, LIMB.searchPixels), middle = first.sky + 0.5 * (first.disc - first.sky), edgeMargin = LIMB.marginPixels + 2;
  // The geometric correction leaves an empty border, so the picture's own extent is where it holds data.
  let left = image.width, right = -1, top = image.height, bottom = -1;
  for (let y = 0; y < image.height; y += 4) for (let x = 0; x < image.width; x += 4) if (!Number.isNaN(image.values[y * image.width + x]!)) { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  let cx = 0, cy = 0, n = 0, whole = true;
  for (let y = LIMB.marginPixels; y < image.height - LIMB.marginPixels; y++) for (let x = LIMB.marginPixels; x < image.width - LIMB.marginPixels; x++) {
    if (!(image.values[y * image.width + x]! > middle)) continue;
    cx += x; cy += y; n++;
    if (x < left + edgeMargin || y < top + edgeMargin || x > right - edgeMargin || y > bottom - edgeMargin) whole = false;
  }
  const meanRadius = radius(1, 0) / 2 + radius(0, 1) / 2, area = Math.PI * meanRadius * meanRadius, seeded = whole && n > 0.6 * area && n < 1.2 * area;
  // Translation only: the offset most edge points agree with, then least squares on its inliers.
  const residual = (shift: readonly [number, number], [x, y]: readonly [number, number]) => { const dx = x - predictedCentre[0] - shift[0], dy = y - predictedCentre[1] - shift[1]; return Math.hypot(dx, dy) - radius(dx, dy); };
  const solve = (candidates: readonly [number, number][], start: [number, number]) => {
    let shift = start;
    for (let pass = 0; pass < 4; pass++) {
      const threshold = pass === 0 ? 8 : pass === 1 ? 4 : LIMB.inlierPixels, current = shift, used = candidates.filter(point => Math.abs(residual(current, point)) < threshold);
      if (used.length < 20) break;
      for (let iteration = 0; iteration < 30; iteration++) {
        let a11 = 0, a12 = 0, a22 = 0, b1 = 0, b2 = 0;
        for (const [x, y] of used) {
          const dx = x - predictedCentre[0] - shift[0], dy = y - predictedCentre[1] - shift[1], d = Math.hypot(dx, dy), jx = -dx / d, jy = -dy / d, res = d - radius(dx, dy);
          a11 += jx * jx; a12 += jx * jy; a22 += jy * jy; b1 -= jx * res; b2 -= jy * res;
        }
        const det = a11 * a22 - a12 * a12;
        if (!det) break;
        const stepX = (a22 * b1 - a12 * b2) / det, stepY = (a11 * b2 - a12 * b1) / det;
        shift = [shift[0] + stepX, shift[1] + stepY];
        if (Math.hypot(stepX, stepY) < 1e-4) break;
      }
    }
    const final = shift, inliers = candidates.filter(point => Math.abs(residual(final, point)) < LIMB.inlierPixels);
    const rmsPixels = inliers.length ? Math.sqrt(inliers.reduce((sum, point) => sum + residual(final, point) ** 2, 0) / inliers.length) : NaN;
    return { shift, edgePoints: inliers.length, candidates: candidates.length, rmsPixels, accepted: inliers.length >= LIMB.minimumEdgePoints && rmsPixels < LIMB.maximumRmsPixels };
  };
  const consensus = (candidates: readonly [number, number][]): [number, number] => {
    let best = -1, shift: [number, number] = [0, 0];
    for (let dy = -LIMB.searchPixels; dy <= LIMB.searchPixels; dy += 4) for (let dx = -LIMB.searchPixels; dx <= LIMB.searchPixels; dx += 4) {
      let count = 0; for (const point of candidates) if (Math.abs(residual([dx, dy], point)) < 4) count++;
      if (count > best) { best = count; shift = [dx, dy]; }
    }
    return shift;
  };
  let fit = { ...solve([], [0, 0]), seed: 'prediction' as 'prediction' | 'centroid' };
  if (seeded) {
    const centre: [number, number] = [cx / n, cy / n];
    fit = { ...solve(limbCandidates(image, centre, radius, sun, Math.max(30, 0.25 * meanRadius)).points, [centre[0] - predictedCentre[0], centre[1] - predictedCentre[1]]), seed: 'centroid' };
  }
  if (!fit.accepted) fit = { ...solve(first.points, consensus(first.points)), seed: 'prediction' };
  const shift = fit.shift;
  // Moving every projected point by the limb offset is the corrected camera: rows 0 and 1 gain shift x row 2.
  const corrected = [m[0]!.map((v, i) => v + shift[0] * m[2]![i]!), m[1]!.map((v, i) => v + shift[1] * m[2]![i]!), m[2]!];
  return { id, filter, imageTime, et, width: image.width, height: image.height, values: image.values, usable: usablePixels(image.values, image.width, image.height, USABLE_MARGIN_PIXELS), matrix: corrected, positionKm: [...camera.positionKm], sunDirection: [...camera.sunDirection],
    rangeKm: camera.report.rangeKm, pixelScaleKm: camera.report.rangeKm / focalLengthPixels, phaseDegrees: camera.report.phaseAngleDegrees,
    limb: { edgePoints: fit.edgePoints, candidates: fit.candidates, rmsPixels: fit.rmsPixels, shift, seed: fit.seed, accepted: fit.accepted } };
}
