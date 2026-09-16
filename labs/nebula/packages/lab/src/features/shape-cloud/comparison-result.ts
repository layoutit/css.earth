import type { ShapeCloudComparison, ShapeCloudPin } from './types.ts';

const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export const comparisonChannels = ['source', 'model', 'sourceEdges', 'modelEdges', 'difference'] as const;
export const comparisonGains = [1, 2, 4, 8] as const;

export function readShapeCloudComparison(value: unknown, width: number, height: number, readPin: (value: unknown) => ShapeCloudPin): ShapeCloudComparison {
  if (!record(value) || value.schema !== 'cssearth-shape-cloud-comparison@1' || value.width !== width || value.height !== height ||
      !nonnegative(value.brightnessScale) || !record(value.metrics) || !nonnegative(value.metrics.missingFraction) || value.metrics.missingFraction > 1 ||
      !nonnegative(value.metrics.excessFraction) || !nonnegative(value.metrics.normalizedRmse) ||
      !Array.isArray(value.levels) || value.levels.length !== comparisonGains.length) throw new TypeError('Invalid shape-cloud structure comparison.');
  const levels = value.levels.map((level: unknown, index) => {
    if (!record(level) || typeof level.gain !== 'number' || level.gain !== comparisonGains[index]) throw new TypeError('Invalid shared comparison level.');
    return { gain: level.gain, source: readPin(level.source), model: readPin(level.model), sourceEdges: readPin(level.sourceEdges),
      modelEdges: readPin(level.modelEdges), difference: readPin(level.difference) };
  });
  return { schema: value.schema, width, height, brightnessScale: value.brightnessScale,
    metrics: { missingFraction: value.metrics.missingFraction, excessFraction: value.metrics.excessFraction, normalizedRmse: value.metrics.normalizedRmse }, levels };
}

export function mapComparisonPins(value: ShapeCloudComparison, map: (pin: ShapeCloudPin) => ShapeCloudPin): ShapeCloudComparison {
  return { ...value, levels: value.levels.map(level => ({ ...level, source: map(level.source), model: map(level.model),
    sourceEdges: map(level.sourceEdges), modelEdges: map(level.modelEdges), difference: map(level.difference) })) };
}
