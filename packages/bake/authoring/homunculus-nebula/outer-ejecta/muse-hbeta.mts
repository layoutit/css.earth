/**
 * MUSE H-beta about the outer ejecta (the original study's muse_look.py and the first half of muse_sheets.py).
 *
 * The cube: ESO's MUSE science cube of Eta Carinae (Mehner et al. 2016's deep wide-field data). The 160 channels from
 * 4755 to 4955 Angstrom, less a straight continuum per spaxel through the medians of 4760-4800 and 4935-4950 Angstrom,
 * are the H-beta region; velocity is c (lambda / 4861.33 - 1).
 *
 * The emission points (points-clean.npy): per channel between 300 and 3200 km/s, the narrow line above the light that is
 * smooth across about 1,100 km/s (a running median of 15 channels: the star's own scattered H-beta and its continuum),
 * less the Carina nebula's smooth light and the tile seams (a running median of 41 spaxels), smoothed over 3 spaxels and
 * put in units of its scatter between 20 and 60 arcsec. A detection is above 4 in two neighbouring channels and a spaxel
 * whose strongest detection is above 6, between 10 and 50 arcsec of the star and off the brightest percent of the smooth
 * light (field stars); each of its channels above 5 is a point: east, north, depth, velocity, signal-to-noise. Depth is
 * velocity times the time since 1843 at 2.3 kpc (Mehner et al. 2016's homologous coasting), positive away from Earth.
 */
import { skyProjection, type FitsHeader, type SkyProjection } from '@cssearth/fits';
import { readFitsFileHdus } from '@cssearth/fits/node';
import { medianFilter, uniformFilter } from './ndimage.mts';
import { median, nanmedian, percentile } from './numpy-statistics.mts';
import { readCubePlanes, STAR_DEC_DEG, STAR_RA_DEG } from './sky-grid.mts';

/** H-beta's rest wavelength (Angstrom, air) and the speed of light (km/s). */
export const HBETA = 4861.33, LIGHT = 299792.458;
/** Arcsec of depth per km/s: the years from 1843 to the cube's epoch (2014.9) at 2.3 kpc. */
export const DEPTH_PER_KMS = (2014.9 - 1843.0) * 3.156e7 / (2.3 * 3.086e16) * 206265;

/** The H-beta region of the cube: E [channel][row][column] (float32, NaN where the cube has none), v per channel (float32),
 * and the cube's celestial header. */
export interface HbetaCube { E: Float32Array; v: Float32Array; channels: number; height: number; width: number; header: FitsHeader }

/** numpy.searchsorted(sorted, value) (side left). */
const searchLeft = (sorted: Float64Array, value: number) => { let lo = 0, hi = sorted.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid]! < value) lo = mid + 1; else hi = mid; } return lo; };

/** The continuum-subtracted H-beta channels of the cube (muse_look.py). */
export async function hbetaCube(path: string): Promise<HbetaCube> {
  const hdus = await readFitsFileHdus(path), hdu = hdus[1];
  if (!hdu || hdu.dimensions.length !== 3) throw new TypeError(`${path}: its first extension is not a cube.`);
  const h = hdu.header, n = hdu.dimensions[2]!, lam = new Float64Array(n);
  for (let k = 0; k < n; k++) lam[k] = Number(h.CRVAL3) + Number(h.CD3_3) * (k + 1 - Number(h.CRPIX3));
  const first = searchLeft(lam, 4755), last = searchLeft(lam, 4955) - 1, D = await readCubePlanes(path, hdu, first, last);
  const L = lam.slice(first, last + 1), channels = L.length, [width, height] = hdu.dimensions as [number, number], plane = width * height;
  const band = (lo: number, hi: number) => [...L.keys()].filter(k => L[k]! > lo && L[k]! < hi);
  const blue = band(4760, 4800), red = band(4935, 4950), med1 = new Float32Array(plane), med2 = new Float32Array(plane), column: number[] = [];
  for (const [bins, out] of [[blue, med1], [red, med2]] as const) for (let p = 0; p < plane; p++) {
    column.length = 0; for (const k of bins) column.push(D[k * plane + p]!);
    out[p] = nanmedian(Float32Array.from(column), { float32: true });
  }
  const l1 = 4780, l2 = 4942.5, E = new Float32Array(D.length);
  for (let k = 0; k < channels; k++) { const t = (L[k]! - l1) / (l2 - l1);
    for (let p = 0; p < plane; p++) E[k * plane + p] = D[k * plane + p]! - (med1[p]! + Math.fround(med2[p]! - med1[p]!) * t); }
  const v = Float32Array.from(L, value => LIGHT * (value / HBETA - 1));
  return { E, v, channels, height, width, header: h };
}

/** The cube's celestial projection: its first two axes' cards only. */
export function cubeProjection(header: FitsHeader): SkyProjection {
  return skyProjection(Object.fromEntries(Object.entries(header).filter(([key]) => /^(CTYPE[12]|CRPIX[12]|CRVAL[12]|CD[12]_[12]|CDELT[12]|PC[12]_[12]|CUNIT[12]|RADESYS|LONPOLE)$/u.test(key))));
}

/** Each spaxel's offset from the star: arcsec east and north, and the distance (muse_sheets.py: the RA offset times the cosine of the star's declination). */
export function spaxelOffsets(cube: Pick<HbetaCube, 'width' | 'height' | 'header'>): { east: Float64Array; north: Float64Array; r: Float64Array } {
  const projection = cubeProjection(cube.header), n = cube.width * cube.height, east = new Float64Array(n), north = new Float64Array(n), r = new Float64Array(n), cos = Math.cos(STAR_DEC_DEG * Math.PI / 180);
  for (let y = 0; y < cube.height; y++) for (let x = 0; x < cube.width; x++) {
    const p = y * cube.width + x, [ra, dec] = projection.skyOf(x, y); east[p] = (ra - STAR_RA_DEG) * cos * 3600; north[p] = (dec - STAR_DEC_DEG) * 3600; r[p] = Math.hypot(east[p]!, north[p]!);
  }
  return { east, north, r };
}

/** The cube with NaN as 0, less its running median over `size` channels (float32), as both later steps begin. */
export function narrowLine(cube: HbetaCube, size: number): { E: Float32Array; N: Float32Array; broad: Float32Array } {
  const E = cube.E.map(value => Number.isNaN(value) ? 0 : value), shape = [cube.channels, cube.height, cube.width] as const;
  const broad = medianFilter(E, shape, [size, 1, 1], { mode: 'nearest' }) as Float32Array;
  return { E, N: E.map((value, i) => value - broad[i]!), broad };
}

/** The emission points (points-clean.npy): rows of east, north, depth (arcsec), velocity (km/s), signal-to-noise; float32. */
export function emissionPoints(cube: HbetaCube, log = console.log): Float32Array {
  const { east, north, r } = spaxelOffsets(cube), { N, broad } = narrowLine(cube, 15), plane = cube.width * cube.height, shape2 = [cube.height, cube.width] as const;
  const cont = new Float32Array(plane), column = new Float32Array(cube.channels);
  for (let p = 0; p < plane; p++) { for (let k = 0; k < cube.channels; k++) column[k] = Math.abs(broad[k * plane + p]!); cont[p] = median(column, { float32: true }); }
  const ringValues: number[] = []; for (let p = 0; p < plane; p++) if (r[p]! > 20 && r[p]! < 70) ringValues.push(cont[p]!);
  const starLevel = percentile(Float32Array.from(ringValues), 99.0, { float32: true }), starry = Uint8Array.from(cont, value => value > starLevel ? 1 : 0);
  const K = [...cube.v.keys()].filter(k => Math.abs(cube.v[k]!) >= 300 && Math.abs(cube.v[k]!) <= 3200), M = new Float32Array(K.length * plane);
  for (const [i, k] of K.entries()) {
    const channel = N.subarray(k * plane, (k + 1) * plane), smooth = medianFilter(channel, shape2, [41, 41], { mode: 'nearest' }) as Float32Array;
    const m = uniformFilter(channel.map((value, p) => value - smooth[p]!), shape2, 3) as Float32Array, sample: number[] = [];
    for (let p = 0; p < plane; p++) if (r[p]! > 20 && r[p]! < 60 && !starry[p]) sample.push(Math.abs(m[p]!));
    const sig = Math.fround(Math.fround(1.4826) * median(Float32Array.from(sample), { float32: true }));
    for (let p = 0; p < plane; p++) M[i * plane + p] = m[p]! / sig;
  }
  // A detection: above 4 here and in a neighbouring channel (np.roll: the first and last channels are neighbours), and positive.
  const count = K.length, det = new Uint8Array(M.length), peak = new Float32Array(plane);
  for (let i = 0; i < count; i++) for (let p = 0; p < plane; p++) {
    const hi = (j: number) => M[(((j % count) + count) % count) * plane + p]! > 4, value = M[i * plane + p]!;
    if (value > 4 && (hi(i - 1) || hi(i + 1)) && value > 0) { det[i * plane + p] = 1; if (value > peak[p]!) peak[p] = value; }
  }
  const rows: number[] = [];
  for (let i = 0; i < count; i++) { const v = cube.v[K[i]!]!;
    for (let p = 0; p < plane; p++) if (det[i * plane + p] && peak[p]! > 6 && !starry[p] && r[p]! > 10 && r[p]! < 50 && M[i * plane + p]! > 5)
      rows.push(east[p]!, north[p]!, Math.fround(v * Math.fround(DEPTH_PER_KMS)), v, M[i * plane + p]!); }
  log(`${rows.length / 5} clean points`);
  return Float32Array.from(rows);
}
