/**
 * The motions of the outer ejecta across the sky: each 2.4 arcsec tile of the 2014.59
 * epoch followed through every epoch, and a straight line of position against time fitted to where it is found.
 *
 * Each epoch's fine detail (a Gaussian blur of 1.5 pixels less one of 10, masked pixels 0) is put in units of its own
 * scatter. Tiles 48 pixels square on a 20-pixel lattice, between 9.5 and 57 arcsec of the star, with at most a tenth
 * masked and detail above three times the reference's noise, are matched by normalized cross-correlation
 * (./registration.mts `matchTemplate`): first in 2005.54, 2020.12 and 2018.56 over 60 pixels about the tile, then in each
 * other epoch over 14 pixels about where those predict. A match needs correlation 0.5, a peak inside the search, and the
 * search no more than 30% masked; its place is refined by a parabola through the peak. Matches more than 3 pixels (and
 * 2.5 times the median) off the line are dropped, up to four times. A tile needs four epochs spanning ten years.
 *
 * Each row: x, y (grid pixel of the tile's centre), vx, vy (pixels a year), sigma (pixels a year), epochs, span (years),
 * rms (pixels), as fit.npy holds them.
 */
import { gaussianFilter } from './python-ports/ndimage.mts';
import { median, std } from './python-ports/numpy-statistics.mts';
import { matchTemplate } from './registration.mts';
import { HALF, PIX, SIDE } from './sky-grid.mts';
import type { GridImage } from './hubble-epochs.mts';

/** The reference epoch, the tile's half side and the lattice step (pixels), and the radii the tiles lie between (arcsec). */
export const REFERENCE = '2014.59', TILE = 24, STEP = 20, INNER = 9.5, OUTER = 57;
/** The epochs searched widely first, in this order. */
export const WIDE_EPOCHS = ['2005.54', '2020.12', '2018.56'] as const;
const SHAPE = [SIDE, SIDE] as const;

/** Python's round() of a float to an integer: halves to even. */
export const roundHalfEven = (value: number) => { const floor = Math.floor(value), rest = value - floor; return rest > 0.5 || rest === 0.5 && floor % 2 !== 0 ? floor + 1 : floor; };

/** A straight line fitted by least squares: [slope, intercept] (numpy.polyfit(x, y, 1)). */
export function lineFit(x: readonly number[], y: readonly number[]): [number, number] {
  const n = x.length; let sx = 0, sy = 0; for (let i = 0; i < n; i++) { sx += x[i]!; sy += y[i]!; }
  const mx = sx / n, my = sy / n; let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (x[i]! - mx) ** 2; sxy += (x[i]! - mx) * (y[i]! - my); }
  const slope = sxy / sxx; return [slope, my - slope * mx];
}

/** Each epoch's detail in units of its scatter over unmasked pixels (float32, masked pixels 0). */
export function scaledDetail(image: GridImage, mask: Uint8Array): Float32Array {
  const known = image.map(value => Number.isFinite(value) ? value : 0), fine = gaussianFilter(known, SHAPE, 1.5), wide = gaussianFilter(known, SHAPE, 10);
  const out = new Float32Array(image.length), kept: number[] = [];
  for (let p = 0; p < out.length; p++) { out[p] = mask[p] ? 0 : fine[p]! - wide[p]!; if (!mask[p]) kept.push(out[p]!); }
  const s = std(Float32Array.from(kept), { float32: true });
  for (let p = 0; p < out.length; p++) out[p] = out[p]! / s;
  return out;
}

const meanOf = (mask: Uint8Array, y0: number, y1: number, x0: number, x1: number) => { let s = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s += mask[y * SIDE + x]!; return s / ((y1 - y0) * (x1 - x0)); };
const crop = (values: Float32Array, y0: number, y1: number, x0: number, x1: number) => { const w = x1 - x0, out = new Float64Array((y1 - y0) * w); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) out[(y - y0) * w + x - x0] = values[y * SIDE + x]!; return out; };

/** The tracked tiles (fit.npy's rows). */
export function hubbleMotions(epochs: ReadonlyMap<string, GridImage>, masks: ReadonlyMap<string, Uint8Array>, log = console.log): number[][] {
  const names = [...epochs.keys()].sort((a, b) => Number(a) - Number(b)), T0 = Number(REFERENCE), hp = new Map<string, Float32Array>();
  for (const e of names) hp.set(e, scaledDetail(epochs.get(e)!, masks.get(e)!));
  const ref = hp.get(REFERENCE)!, refMask = masks.get(REFERENCE)!, kept: number[] = [];
  for (let p = 0; p < ref.length; p++) if (!refMask[p]) kept.push(Math.abs(ref[p]!));
  const noise = Math.fround(Math.fround(1.4826) * median(Float32Array.from(kept), { float32: true })), T = TILE, rows: number[][] = [];
  let template = new Float64Array(0);
  const parabola = (m: number, l: number, r: number) => { const den = Math.fround(Math.fround(l - Math.fround(2 * m)) + r); return den !== 0 ? Math.fround(Math.fround(Math.fround(0.5) * Math.fround(l - r)) / den) : 0; };
  const match = (e: string, y: number, x: number, cy: number, cx: number, R: number): [number, number, number] | undefined => {
    const mask = masks.get(e)!;
    if (meanOf(mask, y - T, y + T, x - T, x + T) > 0.2) return undefined;
    const yy = roundHalfEven(y + cy), xx = roundHalfEven(x + cx);
    if (yy - T - R < 0 || xx - T - R < 0 || yy + T + R > SIDE || xx + T + R > SIDE) return undefined;
    if (meanOf(mask, yy - T - R, yy + T + R, xx - T - R, xx + T + R) > 0.3) return undefined;
    const side = 2 * (T + R), h = side - 2 * T + 1, w = h;
    // skimage answers in float32 for float32 images.
    const c = Float32Array.from(matchTemplate(crop(hp.get(e)!, yy - T - R, yy + T + R, xx - T - R, xx + T + R), [side, side], template, [2 * T, 2 * T]));
    let best = 0; for (let q = 1; q < c.length; q++) if (c[q]! > c[best]!) best = q;
    const j = Math.floor(best / w), i = best % w;
    if (c[best]! < 0.5 || j === 0 || j === h - 1 || i === 0 || i === w - 1) return undefined;
    return [yy - y + j - R + parabola(c[best]!, c[best - w]!, c[best + w]!), xx - x + i - R + parabola(c[best]!, c[best - 1]!, c[best + 1]!), c[best]!];
  };
  let tried = 0;
  for (let y = HALF - 1150; y < HALF + 1150; y += STEP) for (let x = HALF - 1150; x < HALF + 1150; x += STEP) {
    const rr = Math.hypot(x - HALF, y - HALF) * PIX; if (rr < INNER || rr > OUTER) continue;
    template = crop(ref, y - T, y + T, x - T, x + T);
    if (meanOf(refMask, y - T, y + T, x - T, x + T) > 0.1 || std(Float32Array.from(template), { float32: true }) < Math.fround(3 * noise)) continue;
    tried++;
    const points: [number, number, number, number][] = [[T0, 0, 0, 1]];
    for (const e of WIDE_EPOCHS) { const m = match(e, y, x, 0, 0, 60); if (m) points.push([Number(e), ...m]); }
    if (points.length < 2) continue;
    const vy = lineFit(points.map(p => p[0] - T0), points.map(p => p[1]))[0], vx = lineFit(points.map(p => p[0] - T0), points.map(p => p[2]))[0];
    for (const e of names) {
      if ((WIDE_EPOCHS as readonly string[]).includes(e) || e === REFERENCE) continue;
      const dt = Number(e) - T0, m = match(e, y, x, vy * dt, vx * dt, 14); if (m) points.push([Number(e), ...m]);
    }
    let P = points;
    const residuals = (cy: [number, number], cx: [number, number]) => P.map(p => Math.hypot(cy[0] * (p[0] - T0) + cy[1] - p[1], cx[0] * (p[0] - T0) + cx[1] - p[2]));
    for (let iteration = 0; iteration < 4; iteration++) {
      if (P.length < 4) break;
      const t = P.map(p => p[0] - T0), cy = lineFit(t, P.map(p => p[1])), cx = lineFit(t, P.map(p => p[2])), res = residuals(cy, cx);
      const limit = Math.max(3, 2.5 * median(Float64Array.from(res))), bad = res.map(value => value > limit);
      if (!bad.some(Boolean)) break;
      P = P.filter((_, i) => !bad[i]);
    }
    const years = P.map(p => p[0]), span = Math.max(...years) - Math.min(...years);
    if (P.length < 4 || span < 10) continue;
    const t = P.map(p => p[0] - T0), cy = lineFit(t, P.map(p => p[1])), cx = lineFit(t, P.map(p => p[2])), res = residuals(cy, cx);
    const meanYear = years.reduce((s, v) => s + v, 0) / years.length, spread = years.reduce((s, v) => s + (v - meanYear) ** 2, 0);
    const sig = Math.sqrt(res.reduce((s, v) => s + v * v, 0) / (P.length - 2) / spread), rms = Math.sqrt(res.reduce((s, v) => s + v * v, 0) / res.length);
    rows.push([x, y, cx[0], cy[0], sig, P.length, span, rms]);
  }
  log(`${tried} tiles tried, ${rows.length} fitted`);
  return rows;
}
