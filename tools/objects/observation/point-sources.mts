/** Stars in a sky band are not the extended object: a lens that places a sky image in depth would draw each one as a rod
 * along the line of sight. They are found on the band itself and reported as no coverage, like saturated plate stars
 * (plate-saturation.mts): neither light nor zero.
 *
 * A core is a sample whose excess over the median of a small window passes both `sigma` robust deviations of the band and
 * `contrast` times that median; the first test alone is set by the empty sky and would take bright filaments too. A bright
 * star's glow is wider than the small window, so each core is grown outward while samples pass the same test against the median
 * of a wide window, which the star no longer dominates, then widened by `dilate` samples for the wings. Only NaN-free samples
 * take part. */
export interface PointSourceSettings { readonly sigma: number; readonly contrast: number; readonly window: number; readonly wideWindow: number; readonly dilate: number }
export const POINT_SOURCE_DEFAULTS: PointSourceSettings = Object.freeze({ sigma: 6, contrast: 1, window: 7, wideWindow: 25, dilate: 2 });

function windowMedian(plane: Float32Array, width: number, height: number, x: number, y: number, half: number, scratch: number[]) {
  scratch.length = 0;
  for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) {
    const yy = y + dy, xx = x + dx;
    if (yy < 0 || xx < 0 || yy >= height || xx >= width) continue;
    const value = plane[yy * width + xx]!;
    if (Number.isFinite(value)) scratch.push(value);
  }
  if (!scratch.length) return NaN;
  scratch.sort((a, b) => a - b);
  return scratch[scratch.length >> 1]!;
}

export function findPointSources(plane: Float32Array, width: number, height: number, settings: PointSourceSettings = POINT_SOURCE_DEFAULTS) {
  const count = width * height, scratch: number[] = [], small = new Float32Array(count).fill(NaN);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
    if (Number.isFinite(plane[y * width + x]!)) small[y * width + x] = windowMedian(plane, width, height, x, y, settings.window >> 1, scratch);
  const residuals: number[] = [];
  for (let p = 0; p < count; p++) if (Number.isFinite(plane[p]!) && Number.isFinite(small[p]!)) residuals.push(Math.abs(plane[p]! - small[p]!));
  residuals.sort((a, b) => a - b);
  const robust = 1.4826 * (residuals[residuals.length >> 1] ?? 0);
  const passes = (p: number, reference: number) => {
    const excess = plane[p]! - reference;
    return Number.isFinite(excess) && excess > settings.sigma * robust && excess > settings.contrast * reference;
  };
  const mask = new Uint8Array(count), queue: number[] = [];
  let cores = 0;
  for (let p = 0; p < count; p++) if (passes(p, small[p]!)) { mask[p] = 1; queue.push(p); cores++; }
  const wide = new Map<number, number>();
  const wideMedian = (p: number) => {
    let value = wide.get(p);
    if (value === undefined) { value = windowMedian(plane, width, height, p % width, Math.floor(p / width), settings.wideWindow >> 1, scratch); wide.set(p, value); }
    return value;
  };
  while (queue.length) {
    const p = queue.pop()!, x = p % width, y = Math.floor(p / width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
      const q = yy * width + xx;
      if (!mask[q] && passes(q, wideMedian(q))) { mask[q] = 1; queue.push(q); }
    }
  }
  const grown = mask.slice();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (mask[y * width + x])
    for (let dy = -settings.dilate; dy <= settings.dilate; dy++) for (let dx = -settings.dilate; dx <= settings.dilate; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < width && yy < height) grown[yy * width + xx] = 1;
    }
  return { mask: grown, cores, maskedPixels: grown.reduce((sum, value) => sum + value, 0), robustDeviation: robust, settings };
}
