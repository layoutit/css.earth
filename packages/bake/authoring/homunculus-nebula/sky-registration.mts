/**
 * An HST image placed on the bank's picture: read about the star (`readSkyImage`), registered by the fine detail it
 * shares with the picture (`register`: the scale about the star, which is the nebula's expansion between the two
 * epochs, and the star's place) and resampled at the picture's pixels (`onPicture`).
 */
import { skyProjection, type FitsHeader, type SkyProjection } from '@cssearth/fits';
import { readFitsFileHdus, readFitsFileRegion } from '@cssearth/fits/node';

/** An image on the sky: its values (row 0 the first stored), its projection and its epoch. */
export interface SkyImage { name: string; values: Float32Array; width: number; height: number; projection: SkyProjection; year: number }

/** The first two-axis science image of a drizzled HST product, cut to a square `radiusArcsec` about a sky place. A
 * drizzled image has no distortion left: the names of the distortion files that made it (D2IMFILE and the like) are
 * dropped before its projection is read. */
export async function readSkyImage(path: string, around: { raDeg: number; decDeg: number; radiusArcsec: number }, name = path): Promise<SkyImage> {
  const hdus = await readFitsFileHdus(path), sci = hdus.find(hdu => hdu.header.EXTNAME === 'SCI' && hdu.dimensions.length === 2) ?? hdus.find(hdu => hdu.dimensions.length === 2);
  if (!sci || sci.bitpix !== -32) throw new TypeError(`${name} has no 32-bit science image.`);
  const header: FitsHeader = Object.fromEntries(Object.entries(sci.header).filter(([key]) => !/^(D2IM|DP\d|CPDIS|CQDIS|NPOL)/u.test(key)));
  const whole = skyProjection(header), centre = whole.pixelOf(around.raDeg, around.decDeg); if (!centre) throw new RangeError(`${name} does not hold ${around.raDeg}, ${around.decDeg}.`);
  const half = Math.ceil(around.radiusArcsec / whole.scaleArcsec), [W, H] = sci.dimensions as [number, number];
  const x0 = Math.max(0, Math.round(centre[0]) - half), y0 = Math.max(0, Math.round(centre[1]) - half), width = Math.min(W, Math.round(centre[0]) + half + 1) - x0, height = Math.min(H, Math.round(centre[1]) + half + 1) - y0;
  const region = await readFitsFileRegion(path, sci, { x0, y0, width, height }, 2 ** 31);
  const date = hdus[0]!.header['DATE-OBS'], start = Number(hdus[0]!.header.EXPSTART ?? sci.header.EXPSTART);
  return { name, values: Float32Array.from(region.values), width, height, projection: skyProjection({ ...header, CRPIX1: Number(header.CRPIX1) - x0, CRPIX2: Number(header.CRPIX2) - y0 }),
    year: Number.isFinite(start) ? decimalYear(new Date(Date.UTC(1858, 10, 17) + start * 86400000).toISOString().slice(0, 19)) : typeof date === 'string' ? decimalYear(date) : NaN };
}
/** An image's value between its pixels (NaN off the image or next to a value that is not a number). */
export function sample(image: Pick<SkyImage, 'values' | 'width' | 'height'>, x: number, y: number): number {
  const i = Math.floor(x), j = Math.floor(y), a = x - i, b = y - j; if (i < 0 || j < 0 || i >= image.width - 1 || j >= image.height - 1) return NaN;
  const at = (u: number, v: number) => image.values[v * image.width + u]!;
  return (1 - b) * ((1 - a) * at(i, j) + a * at(i + 1, j)) + b * ((1 - a) * at(i, j + 1) + a * at(i + 1, j + 1));
}

/** Each picture pixel's place: arcsec east and north of the star. */
export interface PictureGrid { width: number; height: number; east: Float32Array; north: Float32Array; star: { raDeg: number; decDeg: number } }
/** Where an image lies on the picture: the star's place in it, as arcsec east and north of the catalogued place in the
 * image's own coordinates, and its scale against the picture (expansion between the two epochs). */
export interface Placement { scale: number; east: number; north: number }

const RAD = Math.PI / 180;
/** An image's values at the picture's pixels, placed by `placement`. */
export function onPicture(image: SkyImage, grid: PictureGrid, placement: Placement, every = 1): Float32Array {
  const { width, height } = grid, out = new Float32Array(width * height).fill(NaN), cos = Math.cos(grid.star.decDeg * RAD);
  for (let y = 0; y < height; y += every) for (let x = 0; x < width; x += every) { const p = y * width + x, e = grid.east[p]! * placement.scale + placement.east, n = grid.north[p]! * placement.scale + placement.north;
    const at = image.projection.pixelOf(grid.star.raDeg + e / 3600 / cos, grid.star.decDeg + n / 3600); out[p] = at ? sample(image, at[0], at[1]) : NaN; }
  return out;
}

/** A map blurred by a Gaussian of `sigma` pixels, NaN pixels weighing nothing (NaN where nothing is near). */
export function blurred(values: Float32Array, width: number, height: number, sigma: number): Float32Array {
  const reach = Math.ceil(3 * sigma), weights = Float64Array.from({ length: 2 * reach + 1 }, (_, k) => Math.exp(-0.5 * ((k - reach) / sigma) ** 2));
  const pass = (source: Float32Array, weight: Float32Array, horizontal: boolean) => { const sum = new Float32Array(source.length), total = new Float32Array(source.length);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { let s = 0, w = 0; for (let k = -reach; k <= reach; k++) { const u = horizontal ? x + k : x, v = horizontal ? y : y + k; if (u < 0 || v < 0 || u >= width || v >= height) continue; const q = v * width + u; s += weights[k + reach]! * source[q]!; w += weights[k + reach]! * weight[q]!; } sum[y * width + x] = s; total[y * width + x] = w; }
    return { sum, total }; };
  const known = Float32Array.from(values, value => Number.isFinite(value) ? 1 : 0), held = Float32Array.from(values, value => Number.isFinite(value) ? value : 0);
  const first = pass(held, known, true), second = pass(first.sum, first.total, false);
  return Float32Array.from(second.sum, (value, p) => second.total[p]! > 0.05 ? value / second.total[p]! : NaN);
}

/** Fine detail of a map for comparing two pictures of one thing: its log over its log blurred by `sigma` pixels. */
export function detail(values: Float32Array, width: number, height: number, sigma: number): Float32Array {
  const finite = Array.from(values).filter(value => Number.isFinite(value) && value > 0).sort((a, b) => a - b), floor = finite[Math.floor(finite.length * 0.05)] ?? 1e-6;
  const logs = Float32Array.from(values, value => Number.isFinite(value) ? Math.log(Math.max(value, floor)) : NaN), smooth = blurred(logs, width, height, sigma);
  return Float32Array.from(logs, (value, p) => value - smooth[p]!);
}
/** The correlation of two maps over `pixels`, where both are numbers. */
export function correlation(a: ArrayLike<number>, b: ArrayLike<number>, pixels: Iterable<number>): number {
  let n = 0, sa = 0, sb = 0, ab = 0, aa = 0, bb = 0;
  for (const p of pixels) { const x = a[p]!, y = b[p]!; if (!Number.isFinite(x) || !Number.isFinite(y)) continue; n++; sa += x; sb += y; ab += x * y; aa += x * x; bb += y * y; }
  if (n < 100) return -1; const cov = ab - sa * sb / n, va = aa - sa * sa / n, vb = bb - sb * sb / n; return va > 0 && vb > 0 ? cov / Math.sqrt(va * vb) : -1;
}
/** The registration's levels, coarse to fine: the detail compared (its Gaussian's sigma, arcsec), every how many picture
 * pixels, and the search about the best so far: shifts of `shift` arcsec and scales of `scale`, `steps` each way. */
export const REGISTRATION_LEVELS = [
  { detailArcsec: 0.5, every: 6, shift: 0.2, scale: 0.01, steps: 8, scaleSteps: 3 },
  { detailArcsec: 0.2, every: 3, shift: 0.05, scale: 0.003, steps: 4, scaleSteps: 2 },
  { detailArcsec: 0.2, every: 2, shift: 0.0125, scale: 0.001, steps: 4, scaleSteps: 2 },
] as const;

/**
 * An image registered on the picture: the scale about the star and the star's place that give its fine detail the
 * greatest correlation with the picture's (`reference`, the picture's own light), compared between `inner` and `outer`
 * arcsec of the star, level by level (`REGISTRATION_LEVELS`) from `start`; `reach` scales the first level's shifts and
 * scales.
 */
export function register(image: SkyImage, grid: PictureGrid, reference: Float32Array, start: Placement, reach = 1, inner = 1.5, outer = 10.5): Placement & { correlation: number } {
  const pixelArcsec = Math.hypot(grid.east[1]! - grid.east[0]!, grid.north[1]! - grid.north[0]!), cos = Math.cos(grid.star.decDeg * RAD);
  let best: Placement & { correlation: number } = { ...start, correlation: -2 };
  for (const [level, step] of REGISTRATION_LEVELS.entries()) {
    const mine = detail(reference, grid.width, grid.height, step.detailArcsec / pixelArcsec), theirs: SkyImage = { ...image, values: detail(image.values, image.width, image.height, step.detailArcsec / image.projection.scaleArcsec) }, pixels: number[] = [];
    for (let y = 0; y < grid.height; y += step.every) for (let x = 0; x < grid.width; x += step.every) { const p = y * grid.width + x, r = Math.hypot(grid.east[p]!, grid.north[p]!); if (r >= inner && r <= outer) pixels.push(p); }
    const at = (placement: Placement) => { const out = new Float32Array(grid.width * grid.height).fill(NaN);
      for (const p of pixels) { const e = grid.east[p]! * placement.scale + placement.east, n = grid.north[p]! * placement.scale + placement.north, xy = image.projection.pixelOf(grid.star.raDeg + e / 3600 / cos, grid.star.decDeg + n / 3600); out[p] = xy ? sample(theirs, xy[0], xy[1]) : NaN; }
      return out; };
    const centre: Placement = { scale: best.scale, east: best.east, north: best.north }, widen = level ? 1 : reach; best = { ...centre, correlation: correlation(mine, at(centre), pixels) };
    for (let i = -step.steps; i <= step.steps; i++) for (let j = -step.steps; j <= step.steps; j++) for (let k = -step.scaleSteps; k <= step.scaleSteps; k++) {
      const placement = { scale: centre.scale + widen * step.scale * k, east: centre.east + widen * step.shift * i, north: centre.north + widen * step.shift * j }, c = correlation(mine, at(placement), pixels);
      if (c > best.correlation) best = { ...placement, correlation: c }; }
  }
  return best;
}

/** A decimal year from a FITS date (YYYY-MM-DD[Thh:mm:ss]). */
export function decimalYear(date: string): number {
  const at = Date.parse(date.length === 10 ? `${date}T00:00:00Z` : `${date.replace(/Z?$/u, '')}Z`); if (!Number.isFinite(at)) throw new TypeError(`${JSON.stringify(date)} is not a FITS date.`);
  const year = new Date(at).getUTCFullYear(), start = Date.UTC(year, 0, 1), end = Date.UTC(year + 1, 0, 1); return year + (at - start) / (end - start);
}
