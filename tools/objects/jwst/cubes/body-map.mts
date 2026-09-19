/** Put a band measured in a JWST spectral cube onto the body it was measured on.
 *
 * A cube of a resolved Solar System body is a small picture of its disc, north up, a few pixels across. Where each pixel lies
 * on the body follows from three things: when the cube was exposed (its own header), where JWST and the Sun were (JPL Horizons,
 * observer 500@-170), and how the body was turned (the IAU rotation model in a text PCK). observer-camera.mts turns those into
 * the controlled camera every photograph lens uses, and controlledShapeCamera projects the body's surface into it. The one thing
 * the header cannot give is the disc's centre to a fraction of a pixel (JWST points to about 0.1″, one pixel), so it is fitted:
 * a disc of the body's known angular radius, blurred by a Gaussian, against the continuum image.
 *
 * The result is a full-world longitude-latitude grid, NaN where the body was not seen or was seen too obliquely, in the FITS
 * layout the scalar-map reader (terrestrial-layers/fits-image-map.mts) reads. */
import { controlledShapeCamera } from '../../terrestrial-layers/shape-camera-mosaic.mts';
import type { ObserverCamera } from '../../terrestrial-layers/observer-camera.mts';
import type { BandDepthMap } from './spectral-cube.mts';

const DEGREE = Math.PI / 180;
/** erfc to 1.2e-7 (Numerical Recipes erfcc). */
const erfc = (x: number) => {
  const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r;
};

export interface DiscCentre { readonly center: readonly [number, number]; readonly blurPixels: number; readonly residualOverPeak: number }

/** The centre of a disc of known radius in an image, in zero-based pixels of the image as stored, with the Gaussian blur that
 * fits best. The model is the blurred disc's edge profile, amplitude and background solved linearly at each trial. */
export function fitDiscCentre(image: Float64Array, width: number, height: number, radiusPixels: number): DiscCentre {
  const pixels: number[] = [];
  for (let i = 0; i < image.length; i++) if (Number.isFinite(image[i]!)) pixels.push(i);
  let sw = 0, sx = 0, sy = 0, peak = 0;
  for (const i of pixels) peak = Math.max(peak, image[i]!);
  if (!(peak > 0) || !(radiusPixels > 1)) throw new RangeError('A disc centre needs a positive image and a disc wider than two pixels.');
  for (const i of pixels) if (image[i]! > peak / 4) { sw += image[i]!; sx += image[i]! * (i % width); sy += image[i]! * Math.floor(i / width); }
  const cost = (cx: number, cy: number, blur: number) => {
    let n = 0, sm = 0, sd = 0, smm = 0, smd = 0, sdd = 0;
    for (const i of pixels) {
      const m = 0.5 * erfc((Math.hypot(i % width - cx, Math.floor(i / width) - cy) - radiusPixels) / (Math.SQRT2 * blur)), d = image[i]!;
      n++; sm += m; sd += d; smm += m * m; smd += m * d; sdd += d * d;
    }
    const gain = (n * smd - sm * sd) / (n * smm - sm * sm), offset = (sd - gain * sm) / n;
    return gain > 0 ? sdd - 2 * gain * smd - 2 * offset * sd + gain * gain * smm + 2 * gain * offset * sm + n * offset * offset : Infinity;
  };
  let best = { cx: sx / sw, cy: sy / sw, blur: 1, cost: cost(sx / sw, sy / sw, 1) };
  // A three-pixel ceiling silently turns a broader PSF into a false resolution measurement (ground-based AO halos are a
  // common case). Search up to half a disc radius, bounded so one pathological image cannot make every centre trial huge.
  const maximumBlur = Math.max(3, Math.min(12, radiusPixels / 2));
  for (const [reach, centerStep, blurReach, blurStep] of [[2, 0.25, Infinity, 0.1], [0.25, 0.05, 0.5, 0.05], [0.05, 0.01, 0.1, 0.01]] as const) {
    const { cx: x0, cy: y0 } = best;
    // Centre and blur are smooth, nearly independent dimensions of this circular model. Alternating their searches avoids
    // evaluating every image pixel for their Cartesian product while the successive passes still converge jointly.
    for (let cy = y0 - reach; cy <= y0 + reach + 1e-9; cy += centerStep) for (let cx = x0 - reach; cx <= x0 + reach + 1e-9; cx += centerStep) {
      const value = cost(cx, cy, best.blur); if (value < best.cost) best = { ...best, cx, cy, cost: value };
    }
    const blur0 = best.blur, from = blurReach === Infinity ? 0.4 : Math.max(0.4, blur0 - blurReach), to = blurReach === Infinity ? maximumBlur : Math.min(maximumBlur, blur0 + blurReach);
    for (let blur = from; blur <= to + 1e-9; blur += blurStep) {
      const value = cost(best.cx, best.cy, blur); if (value < best.cost) best = { ...best, blur, cost: value };
    }
  }
  return { center: [best.cx, best.cy], blurPixels: +best.blur.toFixed(1), residualOverPeak: Math.sqrt(best.cost / pixels.length) / peak };
}

/** A cube plane as the camera route reads an image: top row first. The cube is north up with east on the first column already. */
export const topRowFirst = (plane: Float64Array, width: number, height: number) => {
  const out = new Float64Array(plane.length);
  for (let y = 0; y < height; y++) out.set(plane.subarray((height - 1 - y) * width, (height - y) * width), y * width);
  return out;
};

export interface BodyMap { readonly width: number; readonly height: number; readonly depth: Float32Array; readonly error: Float32Array; readonly seenCells: number; readonly areaShare: number;
  /** Cosine of the emission angle at each kept cell: 1 where the body faced the telescope, the limit's cosine at the map's edge. */
  readonly facing?: Float32Array }

/** The band map on a full-world grid: row 0 at the north pole, column 0 starting at 0° east longitude, cell centres sampled
 * bilinearly from the cube. A cell is kept when the body faced JWST within the emission limit there and the cube has a depth. */
export function projectBandMap(map: BandDepthMap, camera: ObserverCamera, radiusKm: number, grid: { width: number; height: number }, maximumEmissionDegrees: number): BodyMap {
  const { width, height } = map, depthRows = topRowFirst(map.depth, width, height), errorRows = topRowFirst(map.error, width, height);
  const lens = controlledShapeCamera(camera), cells = grid.width * grid.height, depth = new Float32Array(cells).fill(NaN), error = new Float32Array(cells).fill(NaN), seenFacing = new Float32Array(cells);
  const bilinear = (rows: Float64Array, x: number, y: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    if (x0 < 0 || y0 < 0 || x0 + 1 >= width || y0 + 1 >= height) return NaN;
    return (1 - fx) * (1 - fy) * rows[y0 * width + x0]! + fx * (1 - fy) * rows[y0 * width + x0 + 1]! + (1 - fx) * fy * rows[(y0 + 1) * width + x0]! + fx * fy * rows[(y0 + 1) * width + x0 + 1]!;
  };
  let seen = 0, area = 0, total = 0;
  for (let row = 0; row < grid.height; row++) {
    const latitude = 90 - (row + 0.5) * 180 / grid.height, weight = Math.cos(latitude * DEGREE);
    for (let column = 0; column < grid.width; column++) {
      total += weight;
      const east = (column + 0.5) * 360 / grid.width, normal = [Math.cos(latitude * DEGREE) * Math.cos(east * DEGREE), Math.cos(latitude * DEGREE) * Math.sin(east * DEGREE), Math.sin(latitude * DEGREE)];
      const facing = normal[0]! * lens.observer[0]! + normal[1]! * lens.observer[1]! + normal[2]! * lens.observer[2]!;
      if (facing < Math.cos(maximumEmissionDegrees * DEGREE)) continue;
      const pixel = lens.project(normal.map(value => value * radiusKm * 1000));
      if (!pixel) continue;
      const value = bilinear(depthRows, pixel[0]!, pixel[1]!), sigma = bilinear(errorRows, pixel[0]!, pixel[1]!);
      if (!Number.isFinite(value) || !Number.isFinite(sigma)) continue;
      depth[row * grid.width + column] = value; error[row * grid.width + column] = sigma; seenFacing[row * grid.width + column] = facing; seen++; area += weight;
    }
  }
  return { width: grid.width, height: grid.height, depth, error, seenCells: seen, areaShare: area / total, facing: seenFacing };
}

/** One map from several, each seen from its own direction. A cell's value is the mean of the maps that kept it, weighted by
 * (facing - limit)², the square of how far inside its own edge each map saw the cell: a map counts most where the body faced
 * the telescope and nothing at its edge, so no map's outline shows. Errors combine the same way. The overlaps are returned
 * too, since two maps of one cell are two measurements: how many cells each pair shares, and how they differ there. */
export function combineBodyMaps(maps: readonly BodyMap[], maximumEmissionDegrees: number) {
  const first = maps[0]; if (!first || maps.some(map => map.width !== first.width || map.height !== first.height || !map.facing)) throw new RangeError('Maps to combine share one grid and carry their facing.');
  const cells = first.width * first.height, sum = new Float64Array(cells), variance = new Float64Array(cells), weights = new Float64Array(cells), edge = Math.cos(maximumEmissionDegrees * DEGREE);
  for (const map of maps) for (let cell = 0; cell < cells; cell++) if (Number.isFinite(map.depth[cell]!)) { const weight = Math.max(0, map.facing![cell]! - edge) ** 2; sum[cell]! += weight * map.depth[cell]!; variance[cell]! += (weight * map.error[cell]!) ** 2; weights[cell]! += weight; }
  const depth = new Float32Array(cells).fill(NaN), error = new Float32Array(cells).fill(NaN); let seen = 0, area = 0, total = 0;
  for (let cell = 0; cell < cells; cell++) { const share = Math.cos((90 - (Math.floor(cell / first.width) + 0.5) * 180 / first.height) * DEGREE); total += share; if (weights[cell]! > 0) { depth[cell] = sum[cell]! / weights[cell]!; error[cell] = Math.sqrt(variance[cell]!) / weights[cell]!; seen++; area += share; } }
  const overlaps: { first: number; second: number; cells: number; rmsDifference: number; correlation: number }[] = [];
  for (let a = 0; a < maps.length; a++) for (let b = a + 1; b < maps.length; b++) {
    let n = 0, dd = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let cell = 0; cell < cells; cell++) { const x = maps[a]!.depth[cell]!, y = maps[b]!.depth[cell]!; if (!Number.isFinite(x) || !Number.isFinite(y)) continue; n++; dd += (x - y) ** 2; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y; }
    if (n) overlaps.push({ first: a, second: b, cells: n, rmsDifference: Math.sqrt(dd / n), correlation: (n * sab - sa * sb) / Math.sqrt((n * saa - sa * sa) * (n * sbb - sb * sb)) });
  }
  return { map: { width: first.width, height: first.height, depth, error, seenCells: seen, areaShare: area / total } as BodyMap, overlaps };
}

const card = (key: string, value: string | number | boolean) => `${key.padEnd(8)}= ${typeof value === 'string' ? `'${value.replace(/'/gu, "''").padEnd(8)}'`.padEnd(20) : String(value === true ? 'T' : value === false ? 'F' : value).padStart(20)}`.padEnd(80);
const headerBlock = (cards: readonly string[]) => { const text = [...cards, 'END'.padEnd(80)].join(''); return Buffer.from(text.padEnd(Math.ceil(text.length / 2880) * 2880), 'ascii'); };

/** The map as FITS: an empty primary HDU that says what it is, then float32 IMAGE extensions named by quantity. */
export function bodyMapFits(map: BodyMap, identity: Readonly<Record<string, string>>, planes: readonly { name: string; units: string; values: Float32Array }[]): Buffer {
  const parts = [headerBlock([card('SIMPLE', true), card('BITPIX', 8), card('NAXIS', 0), card('EXTEND', true), ...Object.entries(identity).map(([key, value]) => card(key, value))])];
  for (const plane of planes) {
    const data = Buffer.alloc(Math.ceil(plane.values.length * 4 / 2880) * 2880);
    plane.values.forEach((value, index) => data.writeFloatBE(value, index * 4));
    parts.push(headerBlock([card('XTENSION', 'IMAGE'), card('BITPIX', -32), card('NAXIS', 2), card('NAXIS1', map.width), card('NAXIS2', map.height), card('PCOUNT', 0), card('GCOUNT', 1),
      card('EXTNAME', plane.name), card('UNITS', plane.units)]), data);
  }
  return Buffer.concat(parts);
}
