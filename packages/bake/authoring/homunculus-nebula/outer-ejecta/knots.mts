/**
 * The outer ejecta's knots in 3D: each moving tile of the Hubble motions
 * (./hubble-motions.mts) with its line-of-sight speed from MUSE H-beta (./muse-hbeta.mts).
 *
 * A tile counts when its motion is measured well (sigma under 6 mas a year, rms under 2.5 pixels) and points away from
 * the star (the cosine between motion and position above 0.85). Its sky speed is 4.74 mu d at d = 2.3 kpc; its age
 * rho / mu (no deceleration). Its spectrum: the narrow line (less a running median over 25 channels) summed over the
 * spaxels within 1.2 arcsec, less the median spectrum of a ring at the same distance from the star (within 2 arcsec)
 * and 25 degrees of angle, outside the tile, scaled to the tile's spaxels; less the Carina nebula's own H-beta near rest,
 * a Gaussian of its own centre (-120 to 80 km/s) and width (45 to 130 km/s) fitted to the channels within 240 km/s
 * (`curveFit`, left in when the fit does not converge; `exp` correctly rounded, as the platform's libm nearly always is). Its line-of-sight speed is the strongest peak of the spectrum
 * smoothed over three channels, between 230 and 3200 km/s and above six times the noise. Its depth (arcsec, positive
 * away from Earth) is rho v_los / v_tan: the knot is taken to move straight out from the star, so its depth over its
 * distance on the sky is its line-of-sight speed over its sky speed. No ejection date is assumed.
 *
 * Each row: east, north, depth (arcsec), v_los (km/s), v_tan (km/s), ejection year, number of peaks (knots3d.npy).
 */
import { curveFit } from './least-squares.mts';
import { exp, uniformFilter } from './ndimage.mts';
import { median } from './numpy-statistics.mts';
import { narrowLine, spaxelOffsets, type HbetaCube } from './muse-hbeta.mts';
import { HALF, PIX } from './sky-grid.mts';

/** The distance (pc) and the reference epoch of the motions. */
export const DISTANCE_PC = 2300, MOTION_EPOCH = 2014.59;
/** km/s per arcsec a year at 1 pc. */
export const KMS_PER_ARCSEC_YEAR_PC = 4.74;
const DEGREES = 180 / Math.PI;
const pyMod = (a: number, b: number) => { const r = a % b; return r !== 0 && (r < 0) !== (b < 0) ? r + b : r; };

/** A tile of the Hubble motions, read from a fit.npy row, in arcsec and arcsec a year (east positive). */
export interface Tile { east: number; north: number; muEast: number; muNorth: number; mu: number; rho: number; sigma: number; rms: number; radial: number }
export function tileOf(row: ArrayLike<number>): Tile {
  const [x, y, vx, vy, sig, , , rms] = Array.from(row) as number[], east = -(x! - HALF) * PIX, north = (y! - HALF) * PIX, muEast = -vx! * PIX, muNorth = vy! * PIX;
  const mu = Math.hypot(muEast, muNorth), rho = Math.hypot(east, north);
  return { east, north, muEast, muNorth, mu, rho, sigma: sig! * PIX, rms: rms!, radial: (muEast * east + muNorth * north) / Math.max(mu * rho, 1e-9) };
}
/** Well measured and moving away from the star. */
export const isClean = (tile: Tile) => tile.sigma < 0.006 && tile.radial > 0.85 && tile.rms < 2.5;

/** The peaks of a smoothed spectrum: channels above `level` and above the channel before, at least the one after (the
 * first and last channels are neighbours, as numpy.roll makes them), between 230 and 3200 km/s either way. */
export function spectrumPeaks(sm: ArrayLike<number>, v: ArrayLike<number>, level: number): number[] {
  const n = sm.length, peaks: number[] = [];
  for (let k = 0; k < n; k++) { const before = sm[(k - 1 + n) % n]!, after = sm[(k + 1) % n]!;
    if (sm[k]! > before && sm[k]! >= after && sm[k]! > level && Math.abs(v[k]!) >= 230 && Math.abs(v[k]!) <= 3200) peaks.push(k); }
  return peaks;
}
/** A knot's depth (arcsec, positive away from Earth) from its distance from the star on the sky and its two speeds, for
 * motion straight out from the star: depth / rho = v_los / v_tan. */
export const knotDepth = (rho: number, vlos: number, vtan: number) => rho * vlos / vtan;

/** The knots (knots3d.npy's rows) from the motion rows and the H-beta cube. */
export function knots3d(fit: readonly ArrayLike<number>[], cube: HbetaCube, log = console.log): number[][] {
  const tiles = fit.map(tileOf).filter(isClean), plane = cube.width * cube.height, channels = cube.channels, v = cube.v;
  const { east, north, r } = spaxelOffsets(cube), { E, N } = narrowLine(cube, 25), lit = new Uint8Array(plane), angle = new Float64Array(plane);
  for (let k = 0; k < channels; k++) for (let p = 0; p < plane; p++) if (Math.abs(E[k * plane + p]!) > 0) lit[p] = 1;
  for (let p = 0; p < plane; p++) angle[p] = Math.atan2(north[p]!, east[p]!) * DEGREES;
  const K = [...v.keys()].filter(k => Math.abs(v[k]!) >= 230 && Math.abs(v[k]!) <= 3200), window = [...v.keys()].filter(k => Math.abs(v[k]!) < 240);
  const rows: number[][] = [], column: number[] = [];
  for (const tile of tiles) {
    const sel: number[] = []; for (let p = 0; p < plane; p++) if (Math.abs(east[p]! - tile.east) < 1.2 && Math.abs(north[p]! - tile.north) < 1.2) sel.push(p);
    if (sel.length < 10) continue;
    const a0 = Math.atan2(tile.north, tile.east) * DEGREES, inSel = new Set(sel), ring: number[] = [];
    for (let p = 0; p < plane; p++) if (Math.abs(r[p]! - tile.rho) < 2 && Math.abs(pyMod(angle[p]! - a0 + 180, 360) - 180) < 25 && !inSel.has(p) && lit[p]) ring.push(p);
    // The tile's spectrum: float32 sums over the spaxels one after another (numpy reduces the cube's [channel, spaxel]
    // selection, which is not contiguous along the spaxels, that way); float64 once anything is taken off it.
    let full: Float64Array = new Float64Array(channels), full32 = true;
    for (let k = 0; k < channels; k++) { let total = 0; for (const p of sel) total = Math.fround(total + N[k * plane + p]!); full[k] = total; }
    if (ring.length > 30) {
      for (let k = 0; k < channels; k++) { column.length = 0; for (const p of ring) column.push(N[k * plane + p]!); full[k] = full[k]! - median(Float32Array.from(column), { float32: true }) * sel.length; }
      full32 = false;
    }
    // The Carina nebula's own line near rest.
    try {
      const top = Math.max(...window.map(k => full[k]!)), p0 = [Math.max(top, 1e-3), -20, 70];
      const [A, c, s] = curveFit((q, p) => q.map(value => p[0]! * exp(-0.5 * ((value - p[1]!) / p[2]!) ** 2)), window.map(k => v[k]!), window.map(k => full[k]!), p0, [[0, -120, 45], [Infinity, 80, 130]]);
      full = full.map((value, k) => value - A! * exp(-0.5 * ((v[k]! - c!) / s!) ** 2)); full32 = false;
    } catch (error) { if (!(error instanceof Error && /optimal parameters not found/u.test(error.message))) throw error; }
    const values = full32 ? Float32Array.from(full) : full, sm = uniformFilter(values, [channels], 3);
    const centre = median(Float64Array.from(K, k => values[k]!), { float32: full32 }), noise = full32 ? Math.fround(Math.fround(1.4826) * median(Float32Array.from(K, k => Math.fround(Math.abs(values[k]! - centre))), { float32: true }))
      : 1.4826 * median(Float64Array.from(K, k => Math.abs(values[k]! - centre)));
    const peaks = spectrumPeaks(sm, v, (full32 ? Math.fround(6 * noise) : 6 * noise) / Math.sqrt(3));
    if (!peaks.length) continue;
    let best = peaks[0]!; for (const k of peaks) if (sm[k]! > sm[best]!) best = k;
    const vlos = v[best]!, vtan = KMS_PER_ARCSEC_YEAR_PC * tile.mu * DISTANCE_PC, age = tile.rho / tile.mu;
    rows.push([tile.east, tile.north, knotDepth(tile.rho, vlos, vtan), vlos, vtan, MOTION_EPOCH - age, peaks.length]);
  }
  log(`${rows.length} knots with a MUSE line of ${tiles.length}`);
  return rows;
}
