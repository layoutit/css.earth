/**
 * Each Hubble epoch's artefacts on the grid: straight lines through the star
 * (diffraction spikes and bleed trails), field stars, pixels no product covers, and the star's own 9 arcsec.
 *
 *   field stars - local maxima of 2005.54's fine detail above its 99.9th percentile, beyond 9 arcsec, that stay put to
 *                 2020.12 (a knot of the ejecta moves), grown by 14 pixels.
 *   lines       - the epoch's log brightness between 10 and 50 arcsec, its median in 0.25-degree bins of angle about the
 *                 star, against the median over the 41 bins about each: a line through the star is a narrow ridge at
 *                 every radius. The strongest ridges (above 0.06 dex, at least 20 degrees apart, at most six, a fifth or
 *                 sixth only above 0.3 dex) are masked 0.9 degrees and at least 0.6 arcsec either side.
 *   bleed trail - the saturated plateau joined to the star: pixels above 85% of the 99.8th percentile between 12 and 40
 *                 arcsec, in a connected patch that touches the inner 6 arcsec and reaches beyond 20, grown by 20 pixels.
 */
import { binaryDilation, gaussianFilter, label, maximumFilter, medianFilter } from './ndimage.mts';
import { median, nanmedian, percentile } from './numpy-statistics.mts';
import { HALF, PIX, SIDE } from './sky-grid.mts';
import type { GridImage } from './hubble-epochs.mts';
import { roundHalfEven } from './hubble-motions.mts';

const SHAPE = [SIDE, SIDE] as const, DEGREES = 180 / Math.PI;
/** Python's float modulo: the sign of the divisor. */
const pyMod = (a: number, b: number) => { const r = a % b; return r !== 0 && (r < 0) !== (b < 0) ? r + b : r; };

/** Distance from the star (arcsec) and angle about it (degrees, 0 to 360, counter-clockwise from the grid's +x) of each pixel. */
export function polarGrid(): { r: Float64Array; theta: Float64Array } {
  const r = new Float64Array(SIDE * SIDE), theta = new Float64Array(SIDE * SIDE);
  for (let y = 0; y < SIDE; y++) for (let x = 0; x < SIDE; x++) { const dx = x - HALF, dy = y - HALF; r[y * SIDE + x] = Math.hypot(dx, dy) * PIX; theta[y * SIDE + x] = pyMod(Math.atan2(dy, dx) * DEGREES, 360); }
  return { r, theta };
}

/** Fine detail: a Gaussian blur of 1.5 pixels less one of 8, unknown pixels taken as 0 (float32). */
function detail(image: GridImage): Float32Array {
  const known = image.map(value => Number.isFinite(value) ? value : 0), fine = gaussianFilter(known, SHAPE, 1.5), wide = gaussianFilter(known, SHAPE, 8);
  return fine.map((value, p) => value - wide[p]!);
}

/** The field-star mask shared by every epoch. */
export function fieldStars(epochs: ReadonlyMap<string, GridImage>, r: Float64Array): { mask: Uint8Array; count: number } {
  const first = epochs.get('2005.54'), last = epochs.get('2020.12'); if (!first || !last) throw new TypeError('The field stars need the 2005.54 and 2020.12 epochs.');
  const ref = detail(first), peak = maximumFilter(ref, SHAPE, 11), finite: number[] = [];
  for (let p = 0; p < ref.length; p++) if (Number.isFinite(first[p]!)) finite.push(ref[p]!);
  const level = percentile(Float32Array.from(finite), 99.9, { float32: true }), later = maximumFilter(detail(last), SHAPE, 5), still = new Uint8Array(ref.length);
  let count = 0; for (let p = 0; p < ref.length; p++) if (ref[p] === peak[p] && ref[p]! > level && r[p]! > 9 && later[p]! > 0.5 * ref[p]!) { still[p] = 1; count++; }
  return { mask: binaryDilation(still, SHAPE, 14), count };
}

/** One epoch's artefact mask (1 masked) and the angles of the lines found. */
export function epochMask(image: GridImage, starMask: Uint8Array, polar: { r: Float64Array; theta: Float64Array }): { mask: Uint8Array; lines: number[] } {
  const { r, theta } = polar, n = image.length, bins = Array.from({ length: 1441 }, (_, k) => k * 0.25), groups: number[][] = Array.from({ length: 1440 }, () => []);
  for (let p = 0; p < n; p++) {
    const value = image[p]!; if (!(Number.isFinite(value) && r[p]! > 10 && r[p]! < 50)) continue;
    // np.digitize(theta, bins) - 1: the bin k with bins[k] <= theta < bins[k + 1] (theta < 360, so k <= 1439).
    let k = Math.floor(theta[p]! / 0.25); if (bins[k + 1]! <= theta[p]!) k++; else if (bins[k]! > theta[p]!) k--;
    groups[k]!.push(Math.fround(Math.log10(Math.max(value, Math.fround(1e-4)))));
  }
  const raw = groups.map(values => values.length > 50 ? median(Float32Array.from(values), { float32: true }) : NaN), float32 = raw.every(Number.isFinite);
  const fill = nanmedian(Float64Array.from(raw), { float32 }), prof = float32 ? Float32Array.from(raw) : Float64Array.from(raw);
  const base = medianFilter(prof.map(value => Number.isNaN(value) ? fill : value), [1440], [41], { mode: 'wrap' });
  const ridge = prof.map((value, k) => float32 ? Math.fround(value - base[k]!) : value - base[k]!);
  // The strongest ridges first (numpy's argsort of the negated ridge; NaN as 0).
  const order = Array.from({ length: 1440 }, (_, k) => k).sort((a, b) => (Number.isNaN(ridge[b]!) ? 0 : ridge[b]!) - (Number.isNaN(ridge[a]!) ? 0 : ridge[a]!) || a - b), bad: number[] = [];
  for (const k of order) {
    if (!(ridge[k]! >= 0.06) || bad.length >= 6) break;
    if (bad.every(j => Math.abs(pyMod(bins[k]! - bins[j]! + 180, 360) - 180) > 20) && (bad.length < 4 || ridge[k]! > 0.3)) bad.push(k);
  }
  const mask = new Uint8Array(n);
  for (const k of bad) { const centre = bins[k]! + 0.125;
    for (let p = 0; p < n; p++) { const d = Math.abs(pyMod(theta[p]! - centre + 180, 360) - 180); if (d < 0.9 || d < 0.6 / Math.max(r[p]!, 1e-3) * DEGREES) mask[p] = 1; } }
  // The bleed trail: bright patches touching the star's 6 arcsec and reaching past 20.
  const sample: number[] = []; for (let p = 0; p < n; p++) if (Number.isFinite(image[p]!) && r[p]! > 12 && r[p]! < 40) sample.push(image[p]!);
  const level = Math.fround(Math.fround(0.85) * percentile(Float32Array.from(sample), 99.8, { float32: true })), hot = new Uint8Array(n);
  for (let p = 0; p < n; p++) hot[p] = (Number.isFinite(image[p]!) ? image[p]! : 0) > level ? 1 : 0;
  const { labels, count } = label(hot, SHAPE), touches = new Uint8Array(count + 1), reach = new Float64Array(count + 1).fill(-Infinity);
  for (let p = 0; p < n; p++) { const c = labels[p]!; if (!c) continue; if (r[p]! < 6) touches[c] = 1; reach[c] = Math.max(reach[c]!, r[p]!); }
  const band = new Uint8Array(n); for (let p = 0; p < n; p++) { const c = labels[p]!; if (c && touches[c] && reach[c]! > 20) band[p] = 1; }
  const trail = binaryDilation(band, SHAPE, 20);
  for (let p = 0; p < n; p++) if (trail[p] || !Number.isFinite(image[p]!) || starMask[p] || r[p]! < 9) mask[p] = 1;
  return { mask, lines: bad.map(k => bins[k]!) };
}

/** Every epoch's mask. */
export function hubbleMasks(epochs: ReadonlyMap<string, GridImage>, log = console.log): Map<string, Uint8Array> {
  const polar = polarGrid(), stars = fieldStars(epochs, polar.r), out = new Map<string, Uint8Array>();
  log(`${stars.count} field stars masked`);
  for (const epoch of [...epochs.keys()].sort()) {
    const { mask, lines } = epochMask(epochs.get(epoch)!, stars.mask, polar);
    let masked = 0; for (const value of mask) masked += value;
    log(`${epoch} lines at ${[...new Set(lines.map(roundHalfEven))].sort((a, b) => a - b).join(', ')} masked ${(masked / mask.length).toFixed(3)}`);
    out.set(epoch, mask);
  }
  return out;
}
