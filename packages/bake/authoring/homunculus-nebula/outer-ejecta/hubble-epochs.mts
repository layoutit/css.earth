/**
 * The Hubble [N II] F658N epochs of the outer ejecta on the common grid (./sky-grid.mts), the original study's
 * hst_grid.py and hst_wfpc2.py.
 *
 * ACS/WFC (2005.54, 2014.59) and WFC3/UVIS (2018.56, 2020.12) drizzled products are Gaia-aligned as MAST serves them:
 * each is put on the grid (`reprojectOnGrid`), in electrons per second, and the visits of one epoch averaged where they
 * cover. The seven WFPC2 visits (1993.99 to 2008.68) are not: each is put on the grid, then tied to the 2005.54 epoch by
 * an affine fit to field stars. The stars are the brightest local maxima of 2005.54's fine detail (Gaussian blur of 1.5
 * pixels less one of 8) more than 25 arcsec from the star; each is found in the visit by phase correlation of a 31-pixel
 * window, to a twentieth of a pixel; the affine is fitted by least squares four times, each time dropping the stars more
 * than three times the median residual (and 0.5 pixel) off. The visit is resampled bilinearly by that affine.
 */
import { resolve } from 'node:path';
import { affineTransform, gaussianFilter, maximumFilter } from './ndimage.mts';
import { median, percentile } from './numpy-statistics.mts';
import { phaseCrossCorrelation } from './registration.mts';
import { HALF, PIX, readScienceImage, reprojectOnGrid, SIDE } from './sky-grid.mts';

/** The ACS and WFC3 products of each epoch (MAST names, without `.fits`). */
export const GAIA_ALIGNED_EPOCHS: Readonly<Record<string, readonly string[]>> = {
  '2005.54': ['j900a6010_drc', 'j900a7010_drc', 'j900b7010_drc', 'j900b7020_drc'],
  '2014.59': ['jcdha6010_drc', 'jcdha7010_drc', 'jcdhb6010_drc', 'jcdhb6020_drc', 'jcdhb7010_drc', 'jcdhb7020_drc'],
  '2018.56': ['idtl01080_drc'], '2020.12': ['ie2w040c0_drc'],
};
/** The WFPC2 F658N visit mosaics (MAST HAP products, without `_drz.fits`). */
export const WFPC2_VISITS: Readonly<Record<string, string>> = {
  '1993.99': 'hst_5188_05_wfpc2_pc_f658n_u24105', '1995.44': 'hst_5239_02_wfpc2_pc_f658n_u2dh02', '1997.53': 'hst_7253_01_wfpc2_pc_f658n_u44601',
  '1999.45': 'hst_8178_01_wfpc2_pc_f658n_u5je01', '2001.42': 'hst_9226_01_wfpc2_pc_f658n_u6ck01', '2003.60': 'hst_9775_01_wfpc2_pc_f658n_u8pb01',
  '2008.68': 'hst_11500_01_wfpc2_pc_f658n_ub7c01',
};
/** The epoch the WFPC2 visits are tied to. */
export const ALIGNMENT_REFERENCE = '2005.54';
/** Every epoch's name, in time order. */
export const EPOCHS = [...Object.keys(GAIA_ALIGNED_EPOCHS), ...Object.keys(WFPC2_VISITS)].sort((a, b) => Number(a) - Number(b));

/** One epoch on the grid: float32, row 0 the grid's south edge, NaN where nothing covers. */
export type GridImage = Float32Array;
const SHAPE = [SIDE, SIDE] as const;

/** An epoch of drizzled ACS or WFC3 products averaged on the grid (hst_grid.py). */
export async function gaiaAlignedEpoch(directory: string, files: readonly string[], log = console.log): Promise<GridImage> {
  const acc = new Float64Array(SIDE * SIDE), count = new Float64Array(SIDE * SIDE);
  for (const file of files) {
    const image = await readScienceImage(resolve(directory, `${file}.fits`)), exposure = Number(image.primary.EXPTIME);
    const unit = typeof image.hdu.header.BUNIT === 'string' ? image.hdu.header.BUNIT : '';
    if (!unit.toUpperCase().includes('ELECTRONS/S') && !(exposure > 0)) throw new TypeError(`${file}: counts without an exposure time.`);
    const values = await reprojectOnGrid(image, unit.toUpperCase().includes('ELECTRONS/S') ? undefined : raw => raw.map(value => value / exposure));
    for (let p = 0; p < values.length; p++) if (Number.isFinite(values[p]!)) { acc[p] += values[p]!; count[p]++; }
  }
  const out = new Float32Array(SIDE * SIDE);
  for (let p = 0; p < out.length; p++) out[p] = count[p]! > 0 ? acc[p]! / Math.max(count[p]!, 1) : NaN;
  let covered = 0; for (const value of out) if (Number.isFinite(value)) covered++;
  log(`${files.length} products: covered ${(covered / out.length).toFixed(3)}`);
  return out;
}

/** Fine detail for finding stars: a Gaussian blur of 1.5 pixels less one of 8, unknown pixels taken as 0 (dtype kept). */
export function starDetail<T extends Float32Array | Float64Array>(image: T): T {
  const known = image.map(value => Number.isFinite(value) ? value : 0) as T, fine = gaussianFilter(known, SHAPE, 1.5), wide = gaussianFilter(known, SHAPE, 8);
  return fine.map((value, p) => value - wide[p]!) as T;
}

/** The field stars of the reference epoch: local maxima of its detail over 11 pixels, above its 99.95th percentile, more
 * than 25 arcsec from the star and 30 pixels from the grid's edge (row, column), in numpy's row-major order. */
export function referenceStars(reference: GridImage): { detail: Float32Array; stars: [number, number][] } {
  const detail = starDetail(reference), peak = maximumFilter(detail, SHAPE, 11), finite: number[] = [];
  for (let p = 0; p < detail.length; p++) if (Number.isFinite(reference[p]!)) finite.push(detail[p]!);
  const level = percentile(Float32Array.from(finite), 99.95, { float32: true }), stars: [number, number][] = [];
  for (let y = 0; y < SIDE; y++) for (let x = 0; x < SIDE; x++) {
    const p = y * SIDE + x;
    if (detail[p] === peak[p] && detail[p]! > level && Math.hypot(x - HALF, y - HALF) * PIX > 25 && Number.isFinite(reference[p]!) && y > 30 && y < SIDE - 30 && x > 30 && x < SIDE - 30) stars.push([y, x]);
  }
  return { detail, stars };
}

/** Least squares of `y` on the columns of `X` (n x 3), by Householder QR: the coefficients. */
export function leastSquares3(X: readonly (readonly [number, number, number])[], y: readonly number[]): [number, number, number] {
  const n = X.length; if (n < 3 || y.length !== n) throw new RangeError(`An affine fit needs at least 3 points; got ${n}.`);
  const A = X.map(row => [...row]), b = [...y];
  for (let k = 0; k < 3; k++) {
    let norm = 0; for (let i = k; i < n; i++) norm += A[i]![k]! ** 2; norm = Math.sqrt(norm);
    if (!(norm > 0)) throw new RangeError('A singular affine fit.');
    const alpha = A[k]![k]! > 0 ? -norm : norm, v = A.map((row, i) => i < k ? 0 : row[k]!); v[k] -= alpha;
    const vv = v.reduce((s, value) => s + value * value, 0);
    if (vv > 0) for (let j = k; j < 3; j++) { let s = 0; for (let i = k; i < n; i++) s += v[i]! * A[i]![j]!; const f = 2 * s / vv; for (let i = k; i < n; i++) A[i]![j] -= f * v[i]!; }
    if (vv > 0) { let s = 0; for (let i = k; i < n; i++) s += v[i]! * b[i]!; const f = 2 * s / vv; for (let i = k; i < n; i++) b[i] -= f * v[i]!; }
  }
  const c = [0, 0, 0]; for (let k = 2; k >= 0; k--) { let s = b[k]!; for (let j = k + 1; j < 3; j++) s -= A[k]![j]! * c[j]!; c[k] = s / A[k]![k]!; }
  return c as [number, number, number];
}

/** A WFPC2 visit on the grid, tied to the reference epoch by its field stars (hst_wfpc2.py). */
export async function wfpc2Visit(path: string, reference: { detail: Float32Array; stars: [number, number][] }, log = console.log): Promise<GridImage> {
  const image = await readScienceImage(path), img = await reprojectOnGrid(image), b = starDetail(img), P: [number, number][] = [], Q: [number, number][] = [];
  const window = (values: ArrayLike<number>, y: number, x: number, out: Float64Array) => { for (let j = 0; j < 31; j++) for (let i = 0; i < 31; i++) out[j * 31 + i] = values[(y - 15 + j) * SIDE + x - 15 + i]!; return out; };
  const w0 = new Float64Array(961), w1 = new Float64Array(961), raw = new Float64Array(961);
  for (const [y, x] of reference.stars) {
    window(img, y, x, raw); window(b, y, x, w1);
    if (!raw.every(Number.isFinite)) continue;
    let mean = 0; for (const value of w1) mean += value; mean /= 961; let spread = 0; for (const value of w1) spread += (value - mean) ** 2;
    if (!(spread > 0)) continue;
    window(reference.detail, y, x, w0);
    const { shift: [dy, dx] } = phaseCrossCorrelation(w0, w1, [31, 31], 20);
    if (Math.hypot(dy, dx) < 12) { P.push([y, x]); Q.push([y - dy, x - dx]); }
  }
  // The affine from reference pixel to visit pixel, refitted four times without the stars far off it.
  let p = P, q = Q, Ay: [number, number, number] = [0, 0, 0], Ax: [number, number, number] = [0, 0, 0], res: number[] = [], ok: boolean[] = [];
  for (let iteration = 0; iteration < 4; iteration++) {
    const X = p.map(([py, px]) => [py, px, 1] as [number, number, number]);
    Ay = leastSquares3(X, q.map(item => item[0])); Ax = leastSquares3(X, q.map(item => item[1]));
    res = X.map((row, i) => Math.hypot(row[0] * Ay[0] + row[1] * Ay[1] + Ay[2] - q[i]![0], row[0] * Ax[0] + row[1] * Ax[1] + Ax[2] - q[i]![1]));
    const limit = Math.max(3 * median(Float64Array.from(res)), 0.5); ok = res.map(value => value < limit);
    p = p.filter((_, i) => ok[i]); q = q.filter((_, i) => ok[i]);
  }
  const kept = res.filter((_, i) => ok[i]), rms = Math.sqrt(kept.reduce((s, value) => s + value * value, 0) / kept.length);
  log(`${path.split('/').pop()}: ${p.length} stars, rms ${(rms * PIX * 1000).toFixed(1)} mas, shift ${(Ay[2] + Ay[0] * HALF + Ay[1] * HALF - HALF).toFixed(2)}, ${(Ax[2] + Ax[0] * HALF + Ax[1] * HALF - HALF).toFixed(2)} px`);
  const moved = affineTransform(img, SHAPE, [[Ay[0], Ay[1]], [Ax[0], Ax[1]]], [Ay[2], Ax[2]], { order: 1, cval: NaN });
  return Float32Array.from(moved);
}

/** Every epoch on the grid: the Gaia-aligned products first, then each WFPC2 visit tied to `ALIGNMENT_REFERENCE`. */
export async function hubbleEpochs(directory: string, log = console.log): Promise<Map<string, GridImage>> {
  const out = new Map<string, GridImage>();
  for (const [epoch, files] of Object.entries(GAIA_ALIGNED_EPOCHS)) { log(`epoch ${epoch}`); out.set(epoch, await gaiaAlignedEpoch(directory, files, log)); }
  const reference = referenceStars(out.get(ALIGNMENT_REFERENCE)!);
  log(`${reference.stars.length} reference stars`);
  for (const [epoch, file] of Object.entries(WFPC2_VISITS)) out.set(epoch, await wfpc2Visit(resolve(directory, `${file}_drz.fits`), reference, log));
  return out;
}
