/** A sky image placed in depth along a fitted three-dimensional model: the repository's rule for giving a flat image depth.
 * The model supplies, for each line of sight, where along it the matter is; the image supplies how bright the line of sight is.
 * Each sky column keeps its measured value and is spread over the model's depth profile for that column, normalised so the
 * column integral reproduces the value. It is never extruded: a column the model leaves empty has no depth to go to and is
 * dropped, and its share of the light is reported.
 *
 * Up to four channels (bands or colour stops) share one depth profile per column, so a column's chromaticity is the same at
 * every depth; shared-opacity compositing then reproduces the image exactly from the front. The grid is encoded as
 * sqrt-density-unorm8 RGBA, x fastest, then y, then depth. */
export interface ColumnDepthInput {
  /** Sky columns across (x) and down the other sky axis (y), and depth cells along the line of sight (z). */
  readonly width: number; readonly height: number; readonly depth: number;
  /** One array per channel, width * height values in x-fastest order; NaN or non-positive means no light. */
  readonly channels: readonly Float32Array[];
  /** Depth weights of column (x, y) written into `out` (length depth); returns their sum. */
  readonly profile: (x: number, y: number, out: Float64Array) => number;
  /** Length of one depth cell in the volume's units, so a decoded column integrates to its value. */
  readonly depthStep: number;
}

export function spreadColumns(input: ColumnDepthInput) {
  const { width, height, depth, channels, profile, depthStep } = input, columns = width * height;
  if (!channels.length || channels.length > 4 || channels.some(channel => channel.length !== columns)) throw new RangeError('One to four channels of one value per column.');
  if (![width, height, depth].every(n => Number.isSafeInteger(n) && n > 0) || !(depthStep > 0)) throw new RangeError('Invalid column grid.');
  const weights = new Float64Array(depth), totals = new Float64Array(columns);
  const light = (c: number, p: number) => { const v = channels[c]![p]!; return Number.isFinite(v) && v > 0 ? v : 0; };
  const offered = new Float64Array(channels.length), dropped = new Float64Array(channels.length);
  let peak = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x, total = profile(x, y, weights);
    totals[p] = total > 0 ? total : 0;
    let maxWeight = 0;
    for (let k = 0; k < depth; k++) maxWeight = Math.max(maxWeight, weights[k]!);
    for (let c = 0; c < channels.length; c++) {
      const value = light(c, p);
      offered[c]! += value;
      if (!(total > 0)) { dropped[c]! += value; continue; }
      peak = Math.max(peak, value * maxWeight / total / depthStep);
    }
  }
  const rgba = new Uint8Array(columns * depth * 4), integral = channels.map(() => new Float64Array(columns));
  let filled = 0;
  if (peak > 0) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x, total = totals[p]!;
    if (!(total > 0)) continue;
    profile(x, y, weights);
    for (let k = 0; k < depth; k++) {
      const o = 4 * (k * columns + p);
      let any = false;
      for (let c = 0; c < channels.length; c++) {
        const byte = Math.round(255 * Math.sqrt(Math.min(1, light(c, p) * weights[k]! / total / depthStep / peak)));
        if (!byte) continue;
        rgba[o + c] = byte; any = true;
        integral[c]![p]! += (byte / 255) ** 2 * peak * depthStep;
      }
      if (any) filled++;
    }
  }
  return { rgba, integral, peak, filledVoxels: filled,
    droppedShare: Array.from(offered, (total, c) => total > 0 ? dropped[c]! / total : 0) };
}

/** The exposure gain at which the brightest decoded column reaches `topAlpha` under the renderer's 1 - exp(-gain * column). */
export function gainForTopAlpha(integrals: readonly Float64Array[], peak: number, topAlpha: number) {
  if (!(topAlpha > 0 && topAlpha < 1)) throw new RangeError('The top alpha lies strictly between 0 and 1.');
  let brightest = 0;
  for (const integral of integrals) for (const value of integral) brightest = Math.max(brightest, value / peak);
  if (!(brightest > 0)) throw new RangeError('No column carries light.');
  return -Math.log(1 - topAlpha) / brightest;
}

/** Close masked gaps (stars and their spikes) in one channel before it is spread. Only samples marked in `fillable` are filled,
 * never the edge of coverage; they are filled inward from observed sky: a sample with at least `minimumNeighbours` finite samples
 * within `radius` takes their median, pass after pass until every fillable sample that touches observed sky is closed.
 * Returns the filled channel and the count. */
export function fillMaskedGaps(channel: Float32Array, fillable: Uint8Array, width: number, height: number, radius = 2, minimumNeighbours = 3) {
  const count = width * height, current = Float32Array.from(channel), pending = Uint8Array.from(fillable);
  if (fillable.length !== count || channel.length !== count) throw new RangeError('One fill flag per sample.');
  let filled = 0;
  const window: number[] = [];
  for (;;) {
    const updates: [number, number][] = [];
    for (let p = 0; p < count; p++) {
      if (!pending[p]) continue;
      const x = p % width, y = Math.floor(p / width);
      window.length = 0;
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
        const value = current[yy * width + xx]!;
        if (Number.isFinite(value)) window.push(value);
      }
      if (window.length < minimumNeighbours) continue;
      window.sort((a, b) => a - b);
      updates.push([p, window[window.length >> 1]!]);
    }
    if (!updates.length) break;
    for (const [p, value] of updates) { current[p] = value; pending[p] = 0; }
    filled += updates.length;
  }
  return { channel: current, filled };
}
