/** Offline undecimated B3-starlet analysis and conservative morphology assignment. */
export interface WaveletSettings {
  scales: number;
  significanceSigma: number;
  /** Fine scales from zero through this inclusive index are compact candidates. */
  compactMaxScale: number;
  elongatedAxisRatio: number;
  minRegionPixels: number;
  connectivity: 4 | 8;
  /** Omit to estimate each plane from its negative-half median absolute amplitude. */
  noiseSigma?: number;
}

export type MorphologyClass = 'compact' | 'elongated' | 'diffuse';

export interface StructureRegion {
  id: string;
  scale: number;
  morphology: MorphologyClass;
  /** Raster indices in original image coordinates, sorted by scan order. */
  support: Uint32Array;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  centroid: [number, number];
  axisLengths: [number, number];
  orientationDeg: number;
  peakCoefficient: number;
  integratedCoefficient: number;
  parentId?: string;
}

export interface StructureWaveletResult {
  /** Signed detail planes. Their sum plus coarse reconstructs the input. */
  waveletPlanes: Float32Array<ArrayBuffer>[];
  coarse: Float32Array<ArrayBuffer>;
  /** Nonnegative assigned emission and a signed remainder. */
  components: {
    diffuse: Float32Array<ArrayBuffer>;
    compact: Float32Array<ArrayBuffer>;
    elongated: Float32Array<ArrayBuffer>;
    residual: Float32Array<ArrayBuffer>;
  };
  catalog: StructureRegion[];
  diagnostics: {
    noiseSigmaByScale: number[];
    thresholdByScale: number[];
    inputSum: number;
    assignedSum: number;
    residualSum: number;
    maxAnalysisReconstructionError: number;
    maxComponentReconstructionError: number;
  };
}

const B3 = [1 / 16, 4 / 16, 6 / 16, 4 / 16, 1 / 16] as const;

function reflected(index: number, length: number): number {
  while (index < 0 || index >= length) {
    index = index < 0 ? -index - 1 : 2 * length - index - 1;
  }
  return index;
}

function smoothB3(source: Float32Array, width: number, height: number, step: number): Float32Array<ArrayBuffer> {
  const horizontal = new Float32Array(source.length);
  const output = new Float32Array(source.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let tap = -2; tap <= 2; tap++) {
      sum += source[y * width + reflected(x + tap * step, width)]! * B3[tap + 2]!;
    }
    horizontal[y * width + x] = sum;
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let tap = -2; tap <= 2; tap++) {
      sum += horizontal[reflected(y + tap * step, height) * width + x]! * B3[tap + 2]!;
    }
    output[y * width + x] = sum;
  }
  return output;
}

function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
}

function robustSigma(values: Float32Array): number {
  // Positive astronomical structure can occupy much of a field. The negative
  // half-plane is the less contaminated automatic display-noise proxy.
  const negative = Array.from(values).filter(value => value <= 0).map(value => -value);
  let sample = negative;
  if (negative.length < Math.max(8, values.length / 20)) {
    const all = Array.from(values);
    const center = median([...all]);
    sample = all.map(value => Math.abs(value - center));
  }
  return median(sample) / 0.6744897501960817;
}

function regionMetrics(
  support: number[],
  plane: Float32Array,
  width: number,
): Omit<StructureRegion, 'id' | 'scale' | 'morphology' | 'support' | 'parentId'> {
  let total = 0;
  let peak = 0;
  let meanX = 0;
  let meanY = 0;
  let minX = width;
  let minY = Number.MAX_SAFE_INTEGER;
  let maxX = -1;
  let maxY = -1;
  for (const pixel of support) {
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const weight = Math.max(0, plane[pixel]!);
    total += weight;
    peak = Math.max(peak, weight);
    meanX += weight * x;
    meanY += weight * y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  meanX /= total;
  meanY /= total;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (const pixel of support) {
    const x = pixel % width - meanX;
    const y = Math.floor(pixel / width) - meanY;
    const weight = Math.max(0, plane[pixel]!);
    xx += weight * x * x;
    yy += weight * y * y;
    xy += weight * x * y;
  }
  xx /= total;
  yy /= total;
  xy /= total;
  const trace = xx + yy;
  const radius = Math.sqrt(Math.max(0, (xx - yy) ** 2 + 4 * xy ** 2));
  const majorVariance = Math.max(0, (trace + radius) / 2);
  const minorVariance = Math.max(0, (trace - radius) / 2);
  const orientationDeg = 0.5 * Math.atan2(2 * xy, xx - yy) * 180 / Math.PI;
  return {
    bounds: { minX, minY, maxX, maxY },
    centroid: [meanX, meanY],
    axisLengths: [2 * Math.sqrt(majorVariance), 2 * Math.sqrt(minorVariance)],
    orientationDeg,
    peakCoefficient: peak,
    integratedCoefficient: total,
  };
}

function connectedRegions(
  plane: Float32Array,
  width: number,
  height: number,
  threshold: number,
  settings: WaveletSettings,
  scale: number,
): StructureRegion[] {
  const seen = new Uint8Array(plane.length);
  const regions: StructureRegion[] = [];
  const diagonal = settings.connectivity === 8;
  for (let start = 0; start < plane.length; start++) {
    if (seen[start] || !(plane[start]! > threshold)) continue;
    const queue = [start];
    seen[start] = 1;
    for (let head = 0; head < queue.length; head++) {
      const pixel = queue[head]!;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((dx === 0 && dy === 0) || (!diagonal && dx !== 0 && dy !== 0)) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (!seen[next] && plane[next]! > threshold) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
    if (queue.length < settings.minRegionPixels) continue;
    queue.sort((a, b) => a - b);
    const metrics = regionMetrics(queue, plane, width);
    const ratio = metrics.axisLengths[0] / Math.max(.5, metrics.axisLengths[1]);
    const morphology: MorphologyClass = ratio >= settings.elongatedAxisRatio ? 'elongated' :
      scale <= settings.compactMaxScale ? 'compact' : 'diffuse';
    regions.push({
      id: '',
      scale,
      morphology,
      support: Uint32Array.from(queue),
      ...metrics,
    });
  }
  regions.forEach((region, index) => {
    region.id = `s${scale}-${String(index).padStart(4, '0')}`;
  });
  return regions;
}

function overlapCount(left: Uint32Array, right: Uint32Array): number {
  let a = 0;
  let b = 0;
  let count = 0;
  while (a < left.length && b < right.length) {
    if (left[a] === right[b]) {
      count++;
      a++;
      b++;
    } else if (left[a]! < right[b]!) {
      a++;
    } else {
      b++;
    }
  }
  return count;
}

/** Links morphology across scales by raster support only; it implies no physical ancestry. */
export function linkStructureParents(catalog: StructureRegion[]): void {
  for (const child of catalog) {
    delete child.parentId;
    let best: StructureRegion | undefined;
    let bestOverlap = 0;
    for (const candidate of catalog) {
      if (candidate.scale <= child.scale) continue;
      if (best && candidate.scale > best.scale) continue;
      const overlap = overlapCount(child.support, candidate.support);
      if (overlap === 0) continue;
      if (!best || candidate.scale < best.scale || overlap > bestOverlap ||
          overlap === bestOverlap && candidate.id < best.id) {
        best = candidate;
        bestOverlap = overlap;
      }
    }
    if (best) child.parentId = best.id;
  }
}

export function decomposeStructures(
  luminance: Float32Array<ArrayBufferLike>,
  width: number,
  height: number,
  settings: WaveletSettings,
): StructureWaveletResult {
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1 ||
      luminance.length !== width * height || luminance.length > 50_000_000) {
    throw new TypeError('Luminance must match a positive raster of at most 50,000,000 pixels.');
  }
  if (luminance.some(value => !Number.isFinite(value) || value < 0)) {
    throw new TypeError('Luminance must contain finite nonnegative values.');
  }
  if (!Number.isInteger(settings.scales) || settings.scales < 1 || settings.scales > 8 ||
      !Number.isFinite(settings.significanceSigma) || settings.significanceSigma <= 0 ||
      !Number.isInteger(settings.compactMaxScale) || settings.compactMaxScale < 0 ||
      settings.compactMaxScale >= settings.scales || !Number.isFinite(settings.elongatedAxisRatio) ||
      settings.elongatedAxisRatio <= 1 || !Number.isInteger(settings.minRegionPixels) ||
      settings.minRegionPixels < 1 || (settings.connectivity !== 4 && settings.connectivity !== 8) ||
      !(settings.noiseSigma === undefined || Number.isFinite(settings.noiseSigma) && settings.noiseSigma >= 0)) {
    throw new TypeError('Invalid explicit wavelet settings.');
  }
  if (luminance.length * (settings.scales + 6) > 150_000_000) {
    throw new TypeError('Wavelet planes and component workspace exceed the bounded analysis budget.');
  }

  const waveletPlanes: Float32Array<ArrayBuffer>[] = [];
  let current = Float32Array.from(luminance);
  for (let scale = 0; scale < settings.scales; scale++) {
    const next = smoothB3(current, width, height, 2 ** scale);
    const plane = new Float32Array(current.length);
    for (let pixel = 0; pixel < plane.length; pixel++) plane[pixel] = current[pixel]! - next[pixel]!;
    waveletPlanes.push(plane);
    current = next;
  }
  const coarse = current;
  const noiseSigmaByScale = waveletPlanes.map(plane => settings.noiseSigma ?? robustSigma(plane));
  const thresholdByScale = noiseSigmaByScale.map(sigma => sigma * settings.significanceSigma);
  const catalog = waveletPlanes.flatMap((plane, scale) =>
    connectedRegions(plane, width, height, thresholdByScale[scale]!, settings, scale));
  linkStructureParents(catalog);

  const diffuseEvidence = new Float32Array(luminance.length);
  const compactEvidence = new Float32Array(luminance.length);
  const elongatedEvidence = new Float32Array(luminance.length);
  for (let pixel = 0; pixel < coarse.length; pixel++) diffuseEvidence[pixel] = Math.max(0, coarse[pixel]!);
  for (const region of catalog) {
    const target = region.morphology === 'compact' ? compactEvidence :
      region.morphology === 'elongated' ? elongatedEvidence : diffuseEvidence;
    const plane = waveletPlanes[region.scale]!;
    for (const pixel of region.support) target[pixel] += Math.max(0, plane[pixel]!);
  }

  const diffuse = new Float32Array(luminance.length);
  const compact = new Float32Array(luminance.length);
  const elongated = new Float32Array(luminance.length);
  const residual = new Float32Array(luminance.length);
  let inputSum = 0;
  let assignedSum = 0;
  let residualSum = 0;
  let maxAnalysisReconstructionError = 0;
  let maxComponentReconstructionError = 0;
  for (let pixel = 0; pixel < luminance.length; pixel++) {
    let analysis = coarse[pixel]!;
    for (const plane of waveletPlanes) analysis += plane[pixel]!;
    maxAnalysisReconstructionError = Math.max(maxAnalysisReconstructionError,
      Math.abs(analysis - luminance[pixel]!));
    const evidence = diffuseEvidence[pixel]! + compactEvidence[pixel]! + elongatedEvidence[pixel]!;
    const scale = evidence > 0 ? Math.min(1, luminance[pixel]! / evidence) : 0;
    diffuse[pixel] = diffuseEvidence[pixel]! * scale;
    compact[pixel] = compactEvidence[pixel]! * scale;
    elongated[pixel] = elongatedEvidence[pixel]! * scale;
    const assigned = diffuse[pixel]! + compact[pixel]! + elongated[pixel]!;
    residual[pixel] = luminance[pixel]! - assigned;
    const reconstructed = diffuse[pixel]! + compact[pixel]! + elongated[pixel]! + residual[pixel]!;
    maxComponentReconstructionError = Math.max(maxComponentReconstructionError,
      Math.abs(reconstructed - luminance[pixel]!));
    inputSum += luminance[pixel]!;
    assignedSum += assigned;
    residualSum += residual[pixel]!;
  }
  return {
    waveletPlanes,
    coarse,
    components: { diffuse, compact, elongated, residual },
    catalog,
    diagnostics: { noiseSigmaByScale, thresholdByScale, inputSum, assignedSum, residualSum,
      maxAnalysisReconstructionError, maxComponentReconstructionError },
  };
}
