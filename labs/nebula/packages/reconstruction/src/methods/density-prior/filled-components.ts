/** Deterministic nonnegative decomposition into compact candidates, filled extended components and diffuse light. */

export interface FilledComponentOptions {
  /** First disk opening; the removed top-hat is retained as compact-source candidate light. */
  compactRadius: number;
  /** Strictly increasing disk radii used to separate successively broader extended emission. */
  extendedRadii: readonly number[];
  connectivity: 4 | 8;
  maxPixels?: number;
  maxWork?: number;
  maxComponents?: number;
  maxSupportEntries?: number;
}

export interface FilledComponent {
  id: string;
  scale: number;
  radius: number;
  /** Sorted raster indices, p = y * width + x; x points right and y points down. */
  pixels: Uint32Array<ArrayBuffer>;
  /** Strictly positive intensity assigned at the matching pixel. */
  contributions: Float32Array<ArrayBuffer>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  centroid: [number, number];
  axisLengths: [number, number];
  orientationDeg: number;
  peakIntensity: number;
  integratedIntensity: number;
}

export interface FilledComponentsResult {
  /** Fine positive top-hat signal: compact-source candidates, not a physical membership claim. */
  compact: Float32Array<ArrayBuffer>;
  /** Broadest nonnegative remainder after every requested disk opening. */
  diffuse: Float32Array<ArrayBuffer>;
  components: FilledComponent[];
  diagnostics: {
    inputSum: number;
    compactSum: number;
    extendedSum: number;
    diffuseSum: number;
    supportEntries: number;
    maxReconstructionError: number;
    estimatedWork: number;
  };
}

const HARD_MAX_PIXELS = 4_194_304;
const HARD_MAX_WORK = 4_800_000_000;
const HARD_MAX_COMPONENTS = 250_000;
const HARD_MAX_SUPPORT = 24_000_000;

function validate(intensity: Float32Array<ArrayBufferLike>, width: number, height: number,
  options: FilledComponentOptions) {
  const pixels = width * height;
  const maxPixels = options.maxPixels ?? 1_048_576;
  const maxWork = options.maxWork ?? 300_000_000;
  const maxComponents = options.maxComponents ?? 100_000;
  const maxSupportEntries = options.maxSupportEntries ?? Math.min(HARD_MAX_SUPPORT,
    pixels * Math.max(1, options.extendedRadii.length));
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1 ||
      pixels !== intensity.length || !Number.isInteger(maxPixels) || pixels > maxPixels ||
      maxPixels < 1 || maxPixels > HARD_MAX_PIXELS) {
    throw new TypeError('Intensity must match a positive raster within the configured pixel limit.');
  }
  if (intensity.some(value => !Number.isFinite(value) || value < 0)) {
    throw new TypeError('Intensity must contain finite nonnegative values.');
  }
  const radii = [options.compactRadius, ...options.extendedRadii];
  if (options.connectivity !== 4 && options.connectivity !== 8 || radii.length < 2 ||
      radii.some((radius, index) => !Number.isInteger(radius) || radius < 1 ||
        index > 0 && radius <= radii[index - 1]!)) {
    throw new TypeError('Radii must be positive, strictly increasing integers with at least one extended scale.');
  }
  if (!Number.isInteger(maxWork) || maxWork < 1 || maxWork > HARD_MAX_WORK ||
      !Number.isInteger(maxComponents) || maxComponents < 1 || maxComponents > HARD_MAX_COMPONENTS ||
      !Number.isInteger(maxSupportEntries) || maxSupportEntries < 1 || maxSupportEntries > HARD_MAX_SUPPORT) {
    throw new TypeError('Analysis budgets must be positive integers within hard limits.');
  }
  // Conservatively budget erosion plus reconstruction scans/propagation.
  const estimatedWork = 4 * pixels * radii.reduce((sum, radius) => sum + 2 * radius + 1, 0);
  if (estimatedWork > maxWork) throw new RangeError('Disk-opening workload exceeds the configured analysis budget.');
  return { estimatedWork, maxWork, maxComponents, maxSupportEntries };
}

function horizontalExtrema(source: Float32Array, width: number, height: number, radius: number,
  takeMinimum: boolean): Float32Array<ArrayBuffer> {
  const output = new Float32Array(source.length);
  const queue = new Int32Array(width);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    let head = 0, tail = 0, added = -1;
    for (let x = 0; x < width; x++) {
      const right = Math.min(width - 1, x + radius);
      while (added < right) {
        const next = ++added;
        while (tail > head) {
          const prior = queue[tail - 1]!;
          if (takeMinimum ? source[row + prior]! < source[row + next]! : source[row + prior]! > source[row + next]!) break;
          tail--;
        }
        queue[tail++] = next;
      }
      const left = x - radius;
      while (tail > head && queue[head]! < left) head++;
      output[row + x] = source[row + queue[head]!]!;
    }
  }
  return output;
}

function diskExtrema(source: Float32Array, width: number, height: number, radius: number,
  takeMinimum: boolean): Float32Array<ArrayBuffer> {
  const output = new Float32Array(source.length);
  output.fill(takeMinimum ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY);
  for (let dy = -radius; dy <= radius; dy++) {
    const horizontalRadius = Math.floor(Math.sqrt(radius * radius - dy * dy));
    // Recompute repeated row widths to keep peak workspace O(pixels), independent of radius.
    const horizontal = horizontalExtrema(source, width, height, horizontalRadius, takeMinimum);
    const startY = Math.max(0, -dy), endY = Math.min(height, height - dy);
    for (let y = startY; y < endY; y++) {
      const targetRow = y * width, sourceRow = (y + dy) * width;
      for (let x = 0; x < width; x++) {
        const candidate = horizontal[sourceRow + x]!, pixel = targetRow + x;
        if (takeMinimum ? candidate < output[pixel]! : candidate > output[pixel]!) output[pixel] = candidate;
      }
    }
  }
  return output;
}

function reconstructionOpening(source: Float32Array, width: number, height: number, radius: number,
  connectivity: 4 | 8, work: { count: number; limit: number }) {
  // Opening by reconstruction: erode a marker, then perform geodesic dilations constrained by the source mask.
  // The queue computes the fixed point R = min(mask, dilation(R)); unlike ordinary dilation it restores source contours.
  const result = diskExtrema(source, width, height, radius, true);
  // Only pending entries are retained: a pixel can be requeued many times during propagation.
  const queued = new Uint8Array(result.length), queue = new Uint32Array(result.length);
  for (let pixel = 0; pixel < result.length; pixel++) { queue[pixel] = pixel; queued[pixel] = 1; }
  let head = 0, tail = 0, pending = result.length;
  while (pending > 0) {
    const pixel = queue[head]!;
    head = (head + 1) % queue.length; pending--; queued[pixel] = 0;
    const x = pixel % width, y = Math.floor(pixel / width), level = result[pixel]!;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0 || connectivity === 4 && dx !== 0 && dy !== 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (++work.count > work.limit) throw new RangeError('Geodesic reconstruction exceeds the configured analysis budget.');
      const next = ny * width + nx, candidate = Math.min(level, source[next]!);
      if (candidate > result[next]!) {
        result[next] = candidate;
        if (!queued[next]) {
          queued[next] = 1; queue[tail] = next;
          tail = (tail + 1) % queue.length; pending++;
        }
      }
    }
  }
  return result;
}

function metrics(pixels: number[], contributions: Float32Array, width: number) {
  let total = 0, peak = 0, meanX = 0, meanY = 0;
  let minX = width, minY = Number.POSITIVE_INFINITY, maxX = -1, maxY = -1;
  for (const pixel of pixels) {
    const value = contributions[pixel]!, x = pixel % width, y = Math.floor(pixel / width);
    total += value; peak = Math.max(peak, value); meanX += value * x; meanY += value * y;
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  meanX /= total; meanY /= total;
  let xx = 0, yy = 0, xy = 0;
  for (const pixel of pixels) {
    const value = contributions[pixel]!, x = pixel % width - meanX, y = Math.floor(pixel / width) - meanY;
    xx += value * x * x; yy += value * y * y; xy += value * x * y;
  }
  xx /= total; yy /= total; xy /= total;
  const trace = xx + yy, delta = Math.sqrt(Math.max(0, (xx - yy) ** 2 + 4 * xy ** 2));
  return {
    bounds: { minX, minY, maxX, maxY }, centroid: [meanX, meanY] as [number, number],
    axisLengths: [2 * Math.sqrt(Math.max(0, (trace + delta) / 2)),
      2 * Math.sqrt(Math.max(0, (trace - delta) / 2))] as [number, number],
    orientationDeg: .5 * Math.atan2(2 * xy, xx - yy) * 180 / Math.PI,
    peakIntensity: peak, integratedIntensity: total,
  };
}

function connectedComponents(contributions: Float32Array<ArrayBuffer>, width: number, height: number,
  connectivity: 4 | 8, scale: number, radius: number,
  limits: { components: number; support: number; componentLimit: number; supportLimit: number },
): FilledComponent[] {
  const seen = new Uint8Array(contributions.length), output: FilledComponent[] = [];
  for (let start = 0; start < contributions.length; start++) {
    if (seen[start] || !(contributions[start]! > 0)) continue;
    const queue = [start]; seen[start] = 1;
    for (let head = 0; head < queue.length; head++) {
      const pixel = queue[head]!, x = pixel % width, y = Math.floor(pixel / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0 || connectivity === 4 && dx !== 0 && dy !== 0) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (!seen[next] && contributions[next]! > 0) { seen[next] = 1; queue.push(next); }
      }
    }
    limits.support += queue.length;
    if (++limits.components > limits.componentLimit || limits.support > limits.supportLimit) {
      throw new RangeError('Connected-component catalogue exceeds the configured output budget.');
    }
    queue.sort((a, b) => a - b);
    const values = new Float32Array(queue.length);
    for (let index = 0; index < queue.length; index++) values[index] = contributions[queue[index]!]!;
    output.push({ id: `e${scale}-${String(output.length).padStart(6, '0')}`, scale, radius,
      pixels: Uint32Array.from(queue), contributions: values, ...metrics(queue, contributions, width) });
  }
  return output;
}

export function decomposeFilledComponents(intensity: Float32Array<ArrayBufferLike>, width: number, height: number,
  options: FilledComponentOptions): FilledComponentsResult {
  const checked = validate(intensity, width, height, options);
  const work = { count: 0, limit: checked.maxWork };
  let current = Float32Array.from(intensity);
  const compactBase = reconstructionOpening(current, width, height, options.compactRadius, options.connectivity, work);
  const compact = new Float32Array(current.length);
  for (let pixel = 0; pixel < current.length; pixel++) compact[pixel] = Math.max(0, current[pixel]! - compactBase[pixel]!);
  current = compactBase;
  const components: FilledComponent[] = [];
  const limits = { components: 0, support: 0,
    componentLimit: options.maxComponents ?? 100_000,
    supportLimit: options.maxSupportEntries ?? Math.min(HARD_MAX_SUPPORT, intensity.length * options.extendedRadii.length) };
  for (let scale = 0; scale < options.extendedRadii.length; scale++) {
    const radius = options.extendedRadii[scale]!, opened = reconstructionOpening(current, width, height, radius, options.connectivity, work);
    const band = new Float32Array(current.length);
    for (let pixel = 0; pixel < current.length; pixel++) band[pixel] = Math.max(0, current[pixel]! - opened[pixel]!);
    components.push(...connectedComponents(band, width, height, options.connectivity, scale, radius, limits));
    current = opened;
  }
  const diffuse = current;
  const reconstructed = Float64Array.from(compact, value => value);
  let inputSum = 0, compactSum = 0, extendedSum = 0, diffuseSum = 0, maxReconstructionError = 0;
  for (const value of compact) compactSum += value;
  for (const component of components) for (let index = 0; index < component.pixels.length; index++) {
    reconstructed[component.pixels[index]!] += component.contributions[index]!;
    extendedSum += component.contributions[index]!;
  }
  for (let pixel = 0; pixel < intensity.length; pixel++) {
    reconstructed[pixel] += diffuse[pixel]!; inputSum += intensity[pixel]!; diffuseSum += diffuse[pixel]!;
    maxReconstructionError = Math.max(maxReconstructionError, Math.abs(reconstructed[pixel]! - intensity[pixel]!));
  }
  return { compact, diffuse, components, diagnostics: { inputSum, compactSum, extendedSum, diffuseSum,
    supportEntries: limits.support, maxReconstructionError, estimatedWork: checked.estimatedWork } };
}
