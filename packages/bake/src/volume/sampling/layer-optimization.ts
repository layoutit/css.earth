/** Offline allocation of a global slab budget. Geometry is sampled again at full resolution afterwards. */
import type { Axis, Bounds3, Vector3 } from '../contracts/volume-recipe.ts';
import { readVolumeLayerPlan, type VolumeLayerPlan } from '../contracts/volume-slices.ts';
import type { Cancellation } from '../contracts/cancellation.ts';

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
export interface LayerOptimizationOptions {
  bounds: Bounds3;
  referenceSliceCounts: Record<Axis, number>;
  referenceSamplesPerSlab: number;
  sampleEmission(x: number, y: number, z: number, out: Vector3): void;
  maximumLayers?: number;
  /** Additional depth-collapse error estimate, not the browser handoff acceptance threshold. */
  targetNormalizedL1?: number;
  probeWidth?: number;
  signal?: Cancellation;
  onProgress?(progress: { completed: number; total: number }): void;
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

interface Profile { sensitivity: Float64Array; mass: number; pitch: number }
interface Partitions { costs: Float64Array; backtrack: Int16Array; stride: number }
function cancelled(signal?: Cancellation) { signal?.throwIfAborted(); }

/** Depth is only regrouped; every reference midpoint is still integrated by the subsequent full bake. */
export function optimizeVolumeLayers(options: LayerOptimizationOptions): { plan: VolumeLayerPlan; report: LayerOptimizationReport } {
  const { bounds, referenceSliceCounts: counts, referenceSamplesPerSlab: samples } = options;
  const budget = options.maximumLayers ?? DEFAULT_VOLUME_LAYER_BUDGET;
  const target = options.targetNormalizedL1 ?? .01, width = options.probeWidth ?? 64;
  if (!bounds || !Array.isArray(bounds.min) || !Array.isArray(bounds.max) || bounds.min.length !== 3 || bounds.max.length !== 3 ||
      bounds.min.some((n, i) => !finite(n) || !finite(bounds.max[i]) || n >= bounds.max[i]!) ||
      !counts || AXES.some(axis => !integer(counts[axis], 1, 512)) || !integer(samples, 1, 8) ||
      !integer(budget, 3, DEFAULT_VOLUME_LAYER_BUDGET) || !integer(width, 8, 256) || !finite(target) || target <= 0 || target > .04 ||
      typeof options.sampleEmission !== 'function') throw new TypeError('Invalid layer optimization input.');
  cancelled(options.signal);
  const profiles = {} as Record<Axis, Profile>;
  let completed = 0;
  for (const axis of AXES) {
    const axial = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const horizontal = axis === 'x' ? 1 : 0, vertical = axis === 'z' ? 1 : 2;
    const uSpan = bounds.max[horizontal] - bounds.min[horizontal], vSpan = bounds.max[vertical] - bounds.min[vertical];
    const height = Math.max(8, Math.min(256, Math.round(width * vSpan / uSpan)));
    const du = uSpan / width, dv = vSpan / height, area = du * dv;
    const pitch = (bounds.max[axial] - bounds.min[axial]) / counts[axis];
    const ds = pitch / samples, rgb: Vector3 = [0, 0, 0], map = new Float64Array(width * height);
    const sensitivity = new Float64Array(counts[axis]);
    let mass = 0;
    for (let index = 0; index < counts[axis]; index++) {
      cancelled(options.signal);
      const center = bounds.min[axial] + (index + .5) * pitch;
      map.fill(0);
      for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
        let light = 0;
        // Two phases in both image directions reduce accidental alignment with narrow features.
        for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
          const u = bounds.min[horizontal] + (col + (sx + .5) / 2) * du;
          const v = bounds.max[vertical] - (row + (sy + .5) / 2) * dv;
          for (let sample = 0; sample < samples; sample++) {
            const d = center + pitch * ((sample + .5) / samples - .5);
            if (axis === 'x') options.sampleEmission(d, u, v, rgb);
            else if (axis === 'y') options.sampleEmission(u, d, v, rgb);
            else options.sampleEmission(u, v, d, rgb);
            if (rgb.some(n => !finite(n) || n < 0)) throw new TypeError('Layer planning requires finite nonnegative emission.');
            light += Math.max(...rgb) * ds / 4;
          }
        }
        if (!finite(light)) throw new TypeError('Layer planning emission overflowed.');
        map[row * width + col] = light; mass += light * area;
      }
      // Total variation includes both external edges. Constant interior light still has a silhouette.
      let gradient = 0;
      for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
        const value = map[row * width + col]!;
        gradient += Math.abs(value - (col ? map[row * width + col - 1]! : 0)) / du;
        gradient += Math.abs(value - (row ? map[(row - 1) * width + col]! : 0)) / dv;
        if (col === width - 1) gradient += value / du;
        if (row === height - 1) gradient += value / dv;
      }
      sensitivity[index] = gradient * area;
      if (!finite(sensitivity[index]) || !finite(mass)) throw new TypeError('Layer planning profile overflowed.');
      completed++;
      if (completed % 8 === 0 || completed === sum(counts)) options.onProgress?.({ completed, total: sum(counts) });
    }
    if (!(mass > 0)) throw new TypeError(`Layer planning found no emission in the ${axis} probe; an empty probe cannot certify omission.`);
    profiles[axis] = { sensitivity, mass, pitch };
  }
  const partitions = {} as Record<Axis, Partitions>;
  for (const axis of AXES) {
    const { sensitivity, mass, pitch } = profiles[axis];
    const weights = new Float64Array(sensitivity.length + 1), moments = new Float64Array(sensitivity.length + 1);
    for (let i = 0; i < sensitivity.length; i++) {
      weights[i + 1] = weights[i]! + sensitivity[i]!;
      moments[i + 1] = moments[i]! + sensitivity[i]! * (i + .5);
    }
    // At the corner between XYZ banks, tan(view angle) <= sqrt(2). The probe's spatial
    // gradient times projected displacement estimates EXTRA L1 from collapsing fine planes.
    // It excludes RGBA8/browser error and is deliberately not a visual acceptance result.
    const cost = (start: number, end: number) => {
      if (end - start === 1) return 0;
      const center = (start + end) / 2, middle = Math.floor(center);
      const before = center * (weights[middle]! - weights[start]!) - (moments[middle]! - moments[start]!);
      const after = moments[end]! - moments[middle]! - center * (weights[end]! - weights[middle]!);
      return Math.max(0, before + after) * pitch * Math.SQRT2 / (2 * mass);
    };
    // A midpoint split can first INCREASE error around a concentrated feature. Greedy
    // splitting gets trapped there; solve each complete partition before allocating XYZ.
    const size = counts[axis], maximum = Math.min(size, budget - 2), stride = size + 1;
    const intervalCosts = new Float64Array(stride * stride);
    for (let start = 0; start < size; start++) for (let end = start + 1; end <= size; end++) intervalCosts[start * stride + end] = cost(start, end);
    const backtrack = new Int16Array((maximum + 1) * stride), costs = new Float64Array(maximum + 1).fill(Infinity);
    let previous = new Float64Array(stride).fill(Infinity); previous[0] = 0;
    for (let layers = 1; layers <= maximum; layers++) {
      cancelled(options.signal);
      const next = new Float64Array(stride).fill(Infinity);
      for (let end = layers; end <= size; end++) {
        let best = Infinity, split = -1;
        for (let start = layers - 1; start < end; start++) {
          const value = previous[start]! + intervalCosts[start * stride + end]!;
          if (value < best) { best = value; split = start; }
        }
        next[end] = best; backtrack[layers * stride + end] = split;
      }
      costs[layers] = next[size]!; previous = next;
    }
    partitions[axis] = { costs, backtrack, stride };
  }
  const needed = (axis: Axis) => partitions[axis].costs.findIndex(value => value <= target);
  let selected: Record<Axis, number> = { x: needed('x'), y: needed('y'), z: needed('z') };
  if (AXES.some(axis => selected[axis] < 1) || sum(selected) > budget) {
    // Enumerate XY counts; for each remaining budget retain the best complete Z partition.
    // Minimize the worst bank, then total error and count. Stable loop order resolves ties.
    const bestZ = new Int16Array(budget + 1);
    for (let remaining = 1; remaining <= budget; remaining++) {
      const prior = bestZ[remaining - 1]!;
      bestZ[remaining] = remaining < partitions.z.costs.length && (!prior || partitions.z.costs[remaining]! < partitions.z.costs[prior]!) ? remaining : prior;
    }
    let bestWorst = Infinity, bestSum = Infinity, bestCount = Infinity;
    for (let x = 1; x < partitions.x.costs.length; x++) for (let y = 1; y < partitions.y.costs.length && x + y < budget; y++) {
      const z = bestZ[budget - x - y]!;
      if (!z) continue;
      const errors = [partitions.x.costs[x]!, partitions.y.costs[y]!, partitions.z.costs[z]!];
      const worst = Math.max(...errors), total = errors.reduce((a, b) => a + b, 0), count = x + y + z;
      if (worst < bestWorst || worst === bestWorst && (total < bestSum || total === bestSum && count < bestCount)) {
        selected = { x, y, z }; bestWorst = worst; bestSum = total; bestCount = count;
      }
    }
  }
  const groups = (axis: Axis) => {
    const result: { startCell: number; endCell: number }[] = [], { backtrack, stride } = partitions[axis];
    let endCell = counts[axis];
    for (let layers = selected[axis]; layers > 0; layers--) {
      const startCell = backtrack[layers * stride + endCell]!;
      result.push({ startCell, endCell }); endCell = startCell;
    }
    return result.reverse();
  };
  const error = { x: partitions.x.costs[selected.x]!, y: partitions.y.costs[selected.y]!, z: partitions.z.costs[selected.z]! }, count = sum(selected);
  const plan = readVolumeLayerPlan({ schema: 'cssearth-volume-layer-plan@1', referenceSliceCounts: { ...counts },
    referenceSamplesPerSlab: samples, axes: { x: groups('x'), y: groups('y'), z: groups('z') } });
  const report = readLayerOptimizationReport({ schema: 'cssearth-layer-optimization@1', method: 'gradient-weighted-depth-displacement@1',
    maximumLayers: budget, referenceLayers: sum(counts), plannedLayers: count, probeWidth: width, probeSubpixels: 2,
    targetNormalizedL1: target, estimatedNormalizedL1: error, status: AXES.every(axis => error[axis] <= target) ? 'target-met' : 'budget-limited' }, plan);
  return { plan, report };
}
