/** Observation-space forward modelling. No fitted parameter is a claim of recovered physical truth. */
export interface WeightedPoint { x: number; y: number; z: number; weight: number }
export interface ForwardParameters {
  rotationXDeg: number; rotationYDeg: number; rotationZDeg: number;
  xyScale: number; yScale: number; zScale: number; offsetX: number; offsetY: number; offsetZ: number;
}
export interface HistogramAxis { min: number; max: number; bins: number }
export interface ForwardConfig {
  distance: number;
  referenceDistance: number;
  x: HistogramAxis; y: HistogramAxis; magnitude: HistogramAxis;
  /** Observable magnitude uncertainty only; never applied to latent coordinates. */
  sigmaMag: number;
  /** Odd-length symmetric nonnegative kernel in sky cells, normalized by this module. */
  xyKernel: readonly number[];
  contaminationFraction: number;
}
export interface ForwardObservations {
  /** Index = (y * xBins + x) * magnitudeBins + magnitude. */
  counts: ArrayLike<number>;
  /** Fixed empirical selection/completeness, [0,1], one entry per sky cell. */
  footprint: ArrayLike<number>;
  /** 0 excluded, 1 train, 2 held out. Split must be fixed before fitting. */
  split: ArrayLike<number>;
}
export type ParameterBounds = { [K in keyof ForwardParameters]: readonly [number, number] };
export interface FitOptions {
  maxSweeps: number;
  refinements: number;
  initialStepFraction: number;
}
export interface DevianceScore {
  observedCount: number; expectedCount: number; deviance: number;
  deviancePerObservedCount: number | null;
}
export interface ForwardEvaluation {
  parameters: ForwardParameters;
  amplitude: number;
  expected: Float64Array;
  train: DevianceScore;
  validation: DevianceScore;
}
export interface ForwardFit extends ForwardEvaluation {
  evaluations: number;
  startResults: { parameters: ForwardParameters; trainDeviance: number; evaluations: number }[];
  parametersAtBounds: (keyof ForwardParameters)[];
  termination: 'bounded-coordinate-descent-completed';
}
export const FORWARD_PARAMETER_KEYS: readonly (keyof ForwardParameters)[] = [
  'rotationXDeg', 'rotationYDeg', 'rotationZDeg', 'xyScale', 'yScale', 'zScale', 'offsetX', 'offsetY', 'offsetZ',
];
function finite(value: number, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw Error(`Invalid ${label}`);
}
function validateParameters(p: ForwardParameters): void {
  if (!p || typeof p !== 'object') throw Error('Missing forward parameters');
  for (const key of FORWARD_PARAMETER_KEYS) finite(p[key], key);
  if (p.xyScale <= 0 || p.yScale <= 0 || p.zScale <= 0) throw Error('Scales must be positive');
}
function validateConfig(c: ForwardConfig): void {
  finite(c.distance, 'distance'); finite(c.referenceDistance, 'reference distance');
  if (c.distance <= 0 || c.referenceDistance <= 0) throw Error('Distances must be positive');
  for (const axis of [c.x, c.y, c.magnitude]) {
    finite(axis.min, 'axis minimum'); finite(axis.max, 'axis maximum');
    if (axis.max <= axis.min || !Number.isInteger(axis.bins) || axis.bins < 1) throw Error('Invalid histogram axis');
  }
  if (c.x.bins * c.y.bins * c.magnitude.bins > 10_000_000) throw Error('Histogram exceeds bounded allocation');
  finite(c.sigmaMag, 'sigmaMag'); finite(c.contaminationFraction, 'contamination fraction');
  if (c.sigmaMag < 0 || c.contaminationFraction < 0 || c.contaminationFraction >= 1) throw Error('Invalid uncertainty or contamination');
  if (!c.xyKernel.length || c.xyKernel.length % 2 !== 1) throw Error('Sky kernel must have odd length');
  let total = 0;
  for (let i = 0; i < c.xyKernel.length; i++) {
    const value = c.xyKernel[i]!; finite(value, 'sky kernel');
    if (value < 0 || value !== c.xyKernel[c.xyKernel.length - 1 - i]) throw Error('Sky kernel must be nonnegative and symmetric');
    total += value;
  }
  if (!(total > 0) || !Number.isFinite(total)) throw Error('Empty sky kernel');
}
function validateParticles(particles: readonly WeightedPoint[]): void {
  if (!particles.length) throw Error('No particles');
  let weight = 0;
  for (const p of particles) {
    finite(p.x, 'particle x'); finite(p.y, 'particle y'); finite(p.z, 'particle z'); finite(p.weight, 'particle weight');
    if (p.weight < 0) throw Error('Negative particle weight');
    weight += p.weight;
  }
  if (!(weight > 0) || !Number.isFinite(weight)) throw Error('Invalid total particle weight');
}
function validateObservations(o: ForwardObservations, c: ForwardConfig): void {
  const sky = c.x.bins * c.y.bins;
  if (o.counts.length !== sky * c.magnitude.bins || o.footprint.length !== sky || o.split.length !== sky) throw Error('Histogram shape mismatch');
  let trainCount = 0;
  for (let s = 0; s < sky; s++) {
    const f = o.footprint[s]!; finite(f, 'footprint');
    if (f < 0 || f > 1 || ![0, 1, 2].includes(o.split[s]!)) throw Error('Invalid selection or split');
    for (let m = 0; m < c.magnitude.bins; m++) {
      const count = o.counts[s * c.magnitude.bins + m]!; finite(count, 'observed count');
      if (count < 0) throw Error('Negative observed count');
      if (f > 0 && o.split[s] === 1) trainCount += count;
    }
  }
  if (!(trainCount > 0) || !Number.isFinite(trainCount)) throw Error('Training set must contain positive observed counts');
}
/** Scale input axes, rotate X then Y then Z, then translate. Input particles remain immutable. */
function transformer(p: ForwardParameters): (point: WeightedPoint) => WeightedPoint {
  const rad = Math.PI / 180;
  const cx = Math.cos(p.rotationXDeg * rad), sx = Math.sin(p.rotationXDeg * rad);
  const cy = Math.cos(p.rotationYDeg * rad), sy = Math.sin(p.rotationYDeg * rad);
  const cz = Math.cos(p.rotationZDeg * rad), sz = Math.sin(p.rotationZDeg * rad);
  return (point) => {
    const x = point.x * p.xyScale, y = point.y * p.xyScale * p.yScale, z = point.z * p.zScale;
    const y1 = cx * y - sx * z, z1 = sx * y + cx * z;
    const x2 = cy * x + sy * z1, z2 = -sy * x + cy * z1;
    return { x: cz * x2 - sz * y1 + p.offsetX, y: sz * x2 + cz * y1 + p.offsetY, z: z2 + p.offsetZ, weight: point.weight };
  };
}
export function transformForwardPoint(point: WeightedPoint, p: ForwardParameters): WeightedPoint {
  validateParticles([point]); validateParameters(p);
  return transformer(p)(point);
}
export function observableForwardPoint(point: WeightedPoint, distance: number, referenceDistance: number): { x: number; y: number; magnitude: number } | null {
  finite(distance, 'distance'); finite(referenceDistance, 'reference distance');
  finite(point.x, 'x'); finite(point.y, 'y'); finite(point.z, 'z');
  if (distance <= 0 || referenceDistance <= 0) throw Error('Distances must be positive');
  const lineOfSight = distance + point.z;
  if (lineOfSight <= 0) return null;
  return { x: distance * point.x / lineOfSight, y: distance * point.y / lineOfSight,
    magnitude: 5 * Math.log10(Math.hypot(point.x, point.y, lineOfSight) / referenceDistance) };
}
function normalized(kernel: readonly number[]): number[] {
  const sum = kernel.reduce((a, b) => a + b, 0);
  return kernel.map(value => value / sum);
}
function magnitudeKernel(c: ForwardConfig): number[] {
  if (c.sigmaMag === 0) return [1];
  const width = (c.magnitude.max - c.magnitude.min) / c.magnitude.bins;
  // Truncated at four sigma; globally normalized. Out-of-grid probability is lost, never clamped to edge cells.
  const radius = Math.ceil(4 * c.sigmaMag / width);
  if (radius > 10_000) throw Error('Magnitude kernel exceeds bounded allocation');
  return normalized(Array.from({ length: 2 * radius + 1 }, (_, i) => Math.exp(-0.5 * ((i - radius) * width / c.sigmaMag) ** 2)));
}
function convolve(input: Float64Array, c: ForwardConfig, axis: 'x' | 'y' | 'magnitude', kernel: readonly number[]): Float64Array {
  if (kernel.length === 1) return input;
  const output = new Float64Array(input.length), half = (kernel.length - 1) / 2;
  const nx = c.x.bins, ny = c.y.bins, nm = c.magnitude.bins;
  const stride = axis === 'x' ? nm : axis === 'y' ? nx * nm : 1;
  const dimension = axis === 'x' ? nx : axis === 'y' ? ny : nm;
  for (let i = 0; i < input.length; i++) {
    const coordinate = Math.floor(i / stride) % dimension;
    let sum = 0;
    for (let k = 0; k < kernel.length; k++) {
      const other = coordinate + k - half;
      if (other >= 0 && other < dimension) sum += input[i + (k - half) * stride]! * kernel[k]!;
    }
    output[i] = sum;
  }
  return output;
}
interface PreparedProjection { skyKernel: number[]; magKernel: number[] }
function project(particles: readonly WeightedPoint[], p: ForwardParameters, c: ForwardConfig, kernels: PreparedProjection): Float64Array {
  const original = c;
  const skyPad = (kernels.skyKernel.length - 1) / 2, magPad = (kernels.magKernel.length - 1) / 2;
  const padded = (axis: HistogramAxis, pad: number): HistogramAxis => {
    const width = (axis.max - axis.min) / axis.bins;
    return { min: axis.min - pad * width, max: axis.max + pad * width, bins: axis.bins + 2 * pad };
  };
  c = { ...c, x: padded(c.x, skyPad), y: padded(c.y, skyPad), magnitude: padded(c.magnitude, magPad) };
  const nx = c.x.bins, ny = c.y.bins, nm = c.magnitude.bins;
  if (nx * ny * nm > 10_000_000) throw Error('Padded histogram exceeds bounded allocation');
  const histogram = new Float64Array(nx * ny * nm), transform = transformer(p);
  for (const particle of particles) {
    if (!particle.weight) continue;
    const q = transform(particle), denominator = c.distance + q.z;
    if (denominator <= 0) continue;
    const skyX = c.distance * q.x / denominator, skyY = c.distance * q.y / denominator;
    const magnitude = 5 * Math.log10(Math.hypot(q.x, q.y, denominator) / c.referenceDistance);
    const x = (skyX - c.x.min) / (c.x.max - c.x.min) * nx - .5;
    const y = (skyY - c.y.min) / (c.y.max - c.y.min) * ny - .5;
    const m = (magnitude - c.magnitude.min) / (c.magnitude.max - c.magnitude.min) * nm - .5;
    const ix = Math.floor(x), iy = Math.floor(y), im = Math.floor(m), fx = x - ix, fy = y - iy, fm = m - im;
    for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) for (let dm = 0; dm <= 1; dm++) {
      const bx = ix + dx, by = iy + dy, bm = im + dm;
      if (bx < 0 || bx >= nx || by < 0 || by >= ny || bm < 0 || bm >= nm) continue;
      histogram[(by * nx + bx) * nm + bm]! += particle.weight * (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dm ? fm : 1 - fm);
    }
  }
  const smoothed = convolve(convolve(convolve(histogram, c, 'x', kernels.skyKernel), c, 'y', kernels.skyKernel), c, 'magnitude', kernels.magKernel);
  const result = new Float64Array(original.x.bins * original.y.bins * original.magnitude.bins);
  for (let y = 0; y < original.y.bins; y++) for (let x = 0; x < original.x.bins; x++) for (let m = 0; m < original.magnitude.bins; m++)
    result[(y * original.x.bins + x) * original.magnitude.bins + m] = smoothed[((y + skyPad) * nx + x + skyPad) * nm + m + magPad]!;
  return result;
}
/** Before selection and contamination. Counts outside histogram bounds are not folded into edge bins. */
export function projectForwardModel(particles: readonly WeightedPoint[], p: ForwardParameters, c: ForwardConfig): Float64Array {
  validateConfig(c); validateParameters(p); validateParticles(particles);
  return project(particles, p, c, { skyKernel: normalized(c.xyKernel), magKernel: magnitudeKernel(c) });
}
function selectedProbabilities(histogram: Float64Array, o: ForwardObservations, c: ForwardConfig): Float64Array | null {
  let signal = 0, background = 0;
  for (let i = 0; i < histogram.length; i++) {
    const sky = Math.floor(i / c.magnitude.bins), f = o.split[sky] === 0 ? 0 : o.footprint[sky]!;
    histogram[i]! *= f;
    signal += histogram[i]!; background += f;
  }
  if (!(signal > 0) || !Number.isFinite(signal) || !(background > 0)) return null;
  for (let i = 0; i < histogram.length; i++) {
    const sky = Math.floor(i / c.magnitude.bins), f = o.split[sky] === 0 ? 0 : o.footprint[sky]!;
    histogram[i] = (1 - c.contaminationFraction) * histogram[i]! / signal + c.contaminationFraction * f / background;
  }
  return histogram;
}
function devianceTerm(observed: number, expected: number): number {
  if (observed === 0) return 2 * expected;
  if (expected <= 0) return Infinity;
  return Math.max(0, 2 * (expected - observed + observed * Math.log(observed / expected)));
}
function score(probability: Float64Array, o: ForwardObservations, c: ForwardConfig, amplitude: number, split: 1 | 2): DevianceScore {
  let observedCount = 0, expectedCount = 0, deviance = 0;
  for (let i = 0; i < probability.length; i++) {
    const sky = Math.floor(i / c.magnitude.bins);
    if (o.split[sky] !== split || o.footprint[sky] === 0) continue;
    const observed = o.counts[i]!, expected = amplitude * probability[i]!;
    observedCount += observed; expectedCount += expected; deviance += devianceTerm(observed, expected);
  }
  return { observedCount, expectedCount, deviance, deviancePerObservedCount: observedCount > 0 ? deviance / observedCount : null };
}
function trainAmplitude(probability: Float64Array, o: ForwardObservations, c: ForwardConfig): number {
  let observed = 0, model = 0;
  for (let i = 0; i < probability.length; i++) {
    const sky = Math.floor(i / c.magnitude.bins);
    if (o.split[sky] !== 1 || o.footprint[sky] === 0) continue;
    observed += o.counts[i]!; model += probability[i]!;
  }
  return model > 0 ? observed / model : Infinity;
}
function prepare(particles: readonly WeightedPoint[], o: ForwardObservations, c: ForwardConfig): PreparedProjection {
  validateConfig(c); validateParticles(particles); validateObservations(o, c);
  return { skyKernel: normalized(c.xyKernel), magKernel: magnitudeKernel(c) };
}
function histogramEvaluation(o: ForwardObservations, c: ForwardConfig, histogram: Float64Array, p: ForwardParameters): ForwardEvaluation {
  const probability = selectedProbabilities(histogram, o, c);
  if (!probability) throw Error('No projected signal within selected histogram');
  const amplitude = trainAmplitude(probability, o, c);
  if (!Number.isFinite(amplitude)) throw Error('No model probability in training footprint');
  const train = score(probability, o, c, amplitude, 1), validation = score(probability, o, c, amplitude, 2);
  return { parameters: { ...p }, amplitude, expected: probability.map(value => value * amplitude), train, validation };
}
/** Shared selected Poisson likelihood for cached linear basis projections. Input histogram is not mutated. */
export function evaluateForwardHistogram(o: ForwardObservations, c: ForwardConfig, histogram: Float64Array, p: ForwardParameters): ForwardEvaluation {
  validateConfig(c); validateParameters(p); validateObservations(o, c);
  if (histogram.length !== o.counts.length) throw Error('Forward histogram shape mismatch');
  for (const value of histogram) if (!Number.isFinite(value) || value < 0) throw Error('Invalid projected histogram');
  return histogramEvaluation(o, c, histogram.slice(), p);
}
function finalEvaluation(particles: readonly WeightedPoint[], o: ForwardObservations, c: ForwardConfig, p: ForwardParameters, kernels: PreparedProjection): ForwardEvaluation {
  return histogramEvaluation(o, c, project(particles, p, c, kernels), p);
}
export function evaluateForwardModel(particles: readonly WeightedPoint[], o: ForwardObservations, c: ForwardConfig, p: ForwardParameters): ForwardEvaluation {
  validateParameters(p);
  return finalEvaluation(particles, o, c, p, prepare(particles, o, c));
}
/** Deterministic bounded search. Only training counts determine amplitude, objective, parameter steps and chosen start. */
export function fitForwardModel(particles: readonly WeightedPoint[], o: ForwardObservations, c: ForwardConfig,
  bounds: ParameterBounds, starts: readonly ForwardParameters[], options: FitOptions): ForwardFit {
  const kernels = prepare(particles, o, c);
  if (!starts.length) throw Error('At least one explicit starting point is required');
  if (!Number.isInteger(options.maxSweeps) || options.maxSweeps < 1 || !Number.isInteger(options.refinements) || options.refinements < 1 ||
      !Number.isFinite(options.initialStepFraction) || options.initialStepFraction <= 0 || options.initialStepFraction > 1) throw Error('Invalid search budget');
  for (const key of FORWARD_PARAMETER_KEYS) {
    const range = bounds[key];
    if (!range || range.length !== 2) throw Error(`Missing bounds for ${key}`);
    finite(range[0], `${key} minimum`); finite(range[1], `${key} maximum`);
    if (range[0] > range[1] || ((key === 'xyScale' || key === 'yScale' || key === 'zScale') && range[0] <= 0)) throw Error(`Invalid bounds for ${key}`);
  }
  for (const start of starts) {
    validateParameters(start);
    for (const key of FORWARD_PARAMETER_KEYS) if (start[key] < bounds[key][0] || start[key] > bounds[key][1]) throw Error(`Start outside ${key} bounds`);
  }
  let evaluations = 0;
  const objective = (p: ForwardParameters): number => {
    evaluations++;
    const probability = selectedProbabilities(project(particles, p, c, kernels), o, c);
    if (!probability) return Infinity;
    const amplitude = trainAmplitude(probability, o, c);
    return Number.isFinite(amplitude) ? score(probability, o, c, amplitude, 1).deviance : Infinity;
  };
  const startResults: ForwardFit['startResults'] = [];
  let best: ForwardParameters | undefined, bestScore = Infinity;
  for (const start of starts) {
    const before = evaluations;
    let current = { ...start }, currentScore = objective(current);
    for (let level = 0; level < options.refinements; level++) {
      for (let sweep = 0; sweep < options.maxSweeps; sweep++) {
        let changed = false;
        for (const key of FORWARD_PARAMETER_KEYS) {
          const [min, max] = bounds[key], step = (max - min) * options.initialStepFraction / 2 ** level;
          if (step === 0) continue;
          // Both directions use the same incumbent to avoid direction-dependent step lengths.
          const incumbent = current;
          for (const direction of [-1, 1]) {
            const value = Math.max(min, Math.min(max, incumbent[key] + direction * step));
            if (value === incumbent[key]) continue;
            const candidate = { ...incumbent, [key]: value }, candidateScore = objective(candidate);
            if (candidateScore < currentScore) { current = candidate; currentScore = candidateScore; changed = true; }
          }
        }
        if (!changed) break;
      }
    }
    startResults.push({ parameters: current, trainDeviance: currentScore, evaluations: evaluations - before });
    if (currentScore < bestScore) { best = current; bestScore = currentScore; }
  }
  if (!best || !Number.isFinite(bestScore)) throw Error('No finite training likelihood within the bounded search');
  return { ...finalEvaluation(particles, o, c, best, kernels), evaluations, startResults,
    parametersAtBounds: FORWARD_PARAMETER_KEYS.filter(key => best![key] === bounds[key][0] || best![key] === bounds[key][1]),
    termination: 'bounded-coordinate-descent-completed' };
}
