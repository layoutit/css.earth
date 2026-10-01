import type { Axis } from './coordinates.js';
import type { VolumeLayerPlan } from './volume-layer-plan.js';

export const DEFAULT_VOLUME_LAYER_BUDGET = 500;
export interface LayerOptimizationReport {
  schema: 'cssearth-layer-optimization@1';
  method: 'gradient-weighted-depth-displacement@1';
  maximumLayers: number;
  referenceLayers: number;
  plannedLayers: number;
  probeWidth: number;
  probeSubpixels: 2;
  targetNormalizedL1: number;
  estimatedNormalizedL1: Record<Axis, number>;
  status: 'target-met' | 'budget-limited';
}
const AXES: readonly Axis[] = ['x', 'y', 'z'];
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const sum = (v: Record<Axis, number>) => v.x + v.y + v.z;

/** The report describes a coarse planning proxy. It never certifies a material or browser rendering. */
export function readLayerOptimizationReport(value: unknown, plan: VolumeLayerPlan): LayerOptimizationReport {
  if (!object(value) || value.schema !== 'cssearth-layer-optimization@1' || value.method !== 'gradient-weighted-depth-displacement@1' ||
      !integer(value.maximumLayers, 3, DEFAULT_VOLUME_LAYER_BUDGET) || !integer(value.referenceLayers, 3, 1536) ||
      !integer(value.plannedLayers, 3, value.maximumLayers) || !integer(value.probeWidth, 8, 256) || value.probeSubpixels !== 2 ||
      !finite(value.targetNormalizedL1) || value.targetNormalizedL1 <= 0 || value.targetNormalizedL1 > .04 ||
      !object(value.estimatedNormalizedL1))
    throw new TypeError('Invalid layer optimization report.');
  const errors = value.estimatedNormalizedL1;
  if (AXES.some(axis => !finite(errors[axis]) || Number(errors[axis]) < 0)) throw new TypeError('Invalid layer optimization error estimate.');
  const met = AXES.every(axis => Number(errors[axis]) <= Number(value.targetNormalizedL1));
  if (value.referenceLayers !== sum(plan.referenceSliceCounts) ||
      value.plannedLayers !== AXES.reduce((n, axis) => n + plan.axes[axis].length, 0) ||
      value.status !== (met ? 'target-met' : 'budget-limited')) throw new TypeError('Layer optimization report differs from its plan.');
  return { schema: value.schema, method: value.method, maximumLayers: value.maximumLayers,
    referenceLayers: value.referenceLayers, plannedLayers: value.plannedLayers, probeWidth: value.probeWidth, probeSubpixels: 2,
    targetNormalizedL1: value.targetNormalizedL1, estimatedNormalizedL1: { x: Number(errors.x), y: Number(errors.y), z: Number(errors.z) },
    status: met ? 'target-met' : 'budget-limited' };
}
