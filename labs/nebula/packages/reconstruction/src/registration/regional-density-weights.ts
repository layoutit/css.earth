/** Bounded smooth source-region weights at fixed geometry; an empirical tracer correction, not dynamical evolution. */
import { evaluateForwardHistogram, evaluateForwardModel, projectForwardModel,
  type WeightedPoint, type ForwardParameters, type ForwardConfig, type ForwardObservations,
  type ForwardEvaluation, type DevianceScore } from './forward-density-fit.ts';

export interface RegionalWeightOptions {
  spatialScale: number;
  bounds: readonly [number, number];
  regularization: number;
  maxSweeps: number;
  refinements: number;
}
export interface RegionalWeightFit extends ForwardEvaluation {
  coefficients: number[];
  weightedPoints: WeightedPoint[];
  objective: number;
  regularizationPenalty: number;
  evaluations: number;
  coefficientsAtBounds: number[];
  baseline: { train: DevianceScore; validation: DevianceScore; amplitude: number };
}
function validateScale(scale: number): void {
  if (!Number.isFinite(scale) || scale <= 0) throw Error('Regional spatial scale must be finite and positive');
}
function validatePoint(p: WeightedPoint): void {
  if (![p.x, p.y, p.z, p.weight].every(Number.isFinite) || p.weight < 0) throw Error('Invalid regional point');
}
/** Index bit 0/1/2 denotes positive source X/Y/Z respectively. */
export function regionalBasis(point: WeightedPoint, spatialScale: number): number[] {
  validateScale(spatialScale); validatePoint(point);
  const positive = [.5 * (1 + Math.tanh(point.x / spatialScale)), .5 * (1 + Math.tanh(point.y / spatialScale)), .5 * (1 + Math.tanh(point.z / spatialScale))];
  return Array.from({ length: 8 }, (_, octant) => {
    let value = 1;
    for (let axis = 0; axis < 3; axis++) value *= octant & (1 << axis) ? positive[axis]! : 1 - positive[axis]!;
    return value;
  });
}
/** Preserve all source coordinates and multiply only base weights. Geometry is applied separately by the forward transform. */
export function applyRegionalWeights(points: readonly WeightedPoint[], coefficients: readonly number[], spatialScale: number): WeightedPoint[] {
  validateScale(spatialScale);
  if (coefficients.length !== 8 || !coefficients.every(v => Number.isFinite(v) && v > 0)) throw Error('Expected eight positive finite regional coefficients');
  return points.map(p => {
    const basis = regionalBasis(p, spatialScale);
    const multiplier = basis.reduce((sum, value, i) => sum + value * coefficients[i]!, 0);
    return { ...p, weight: p.weight * multiplier };
  });
}
/** Every basis is projected once. Coefficient search only changes its linear combination, with geometry and observations fixed. */
export function fitRegionalWeights(points: readonly WeightedPoint[], parameters: ForwardParameters, observations: ForwardObservations,
  config: ForwardConfig, options: RegionalWeightOptions): RegionalWeightFit {
  validateScale(options.spatialScale);
  const [min, max] = options.bounds;
  if (![min, max].every(Number.isFinite) || min <= 0 || min > 1 || max < 1 || min > max) throw Error('Positive regional bounds must include one');
  if (!Number.isFinite(options.regularization) || options.regularization < 0 || !Number.isInteger(options.maxSweeps) || options.maxSweeps < 1 ||
      !Number.isInteger(options.refinements) || options.refinements < 1) throw Error('Invalid regional search configuration');
  // Also validates all points, observations, histogram axes and physical transform parameters.
  const baseline = evaluateForwardModel(points, observations, config, parameters);
  if (!Number.isFinite(baseline.train.deviance)) throw Error('No finite training likelihood at fixed geometry');
  const bases = points.map(p => regionalBasis(p, options.spatialScale));
  const projected = Array.from({ length: 8 }, (_, region) => {
    let total = 0;
    const weighted = points.map((p, i) => { const weight = p.weight * bases[i]![region]!; total += weight; return { ...p, weight }; });
    return total > 0 ? projectForwardModel(weighted, parameters, config) : new Float64Array(observations.counts.length);
  });
  const supported = projected.map(histogram => histogram.some((value, i) => {
    const sky = Math.floor(i / config.magnitude.bins);
    return value > 0 && observations.footprint[sky]! > 0 && observations.split[sky] === 1;
  }));
  let evaluations = 0;
  const evaluate = (coefficients: readonly number[]) => {
    evaluations++;
    const histogram = new Float64Array(observations.counts.length);
    for (let region = 0; region < 8; region++) for (let i = 0; i < histogram.length; i++) histogram[i]! += coefficients[region]! * projected[region]![i]!;
    const result = evaluateForwardHistogram(observations, config, histogram, parameters);
    const penalty = baseline.train.observedCount * options.regularization * coefficients.reduce((sum, value) => sum + Math.log(value) ** 2, 0);
    return { result, penalty, objective: result.train.deviance + penalty };
  };
  let coefficients = new Array<number>(8).fill(1), current = evaluate(coefficients);
  for (let level = 0; level < options.refinements; level++) {
    const step = (max - min) / (4 * 2 ** level);
    if (step === 0) break;
    for (let sweep = 0; sweep < options.maxSweeps; sweep++) {
      let changed = false;
      for (let region = 0; region < 8; region++) {
        if (!supported[region]) continue;
        const incumbent = coefficients;
        for (const direction of [-1, 1]) {
          const value = Math.max(min, Math.min(max, incumbent[region]! + direction * step));
          if (value === incumbent[region]) continue;
          const candidate = [...incumbent]; candidate[region] = value;
          const evaluated = evaluate(candidate);
          // Validation is reported by the common evaluator, but never used for proposal acceptance.
          if (evaluated.objective < current.objective) { coefficients = candidate; current = evaluated; changed = true; }
        }
      }
      if (!changed) break;
    }
  }
  return { ...current.result, coefficients, weightedPoints: applyRegionalWeights(points, coefficients, options.spatialScale),
    objective: current.objective, regularizationPenalty: current.penalty, evaluations,
    coefficientsAtBounds: coefficients.flatMap((v, i) => v === min || v === max ? [i] : []),
    baseline: { train: baseline.train, validation: baseline.validation, amplitude: baseline.amplitude } };
}
