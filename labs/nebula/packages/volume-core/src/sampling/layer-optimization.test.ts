import assert from 'node:assert/strict';
import test from 'node:test';
import { optimizeVolumeLayers, readLayerOptimizationReport, type LayerOptimizationOptions } from './layer-optimization.ts';
import type { VolumeLayerPlan } from '../contracts/volume-slices.ts';

const axes = ['x', 'y', 'z'] as const;
const uniform = (): LayerOptimizationOptions => ({ bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  referenceSliceCounts: { x: 512, y: 512, z: 512 }, referenceSamplesPerSlab: 1, probeWidth: 8,
  targetNormalizedL1: 1e-12, sampleEmission(_x, _y, _z, out) { out.fill(1); } });
function complete(plan: VolumeLayerPlan) {
  for (const axis of axes) assert.deepEqual(plan.axes[axis].flatMap(group =>
    Array.from({ length: group.endCell - group.startCell }, (_, i) => group.startCell + i)),
  Array.from({ length: plan.referenceSliceCounts[axis] }, (_, i) => i), 'Every full-depth reference cell occurs exactly once.');
}

test('default planner deterministically caps the combined XYZ layers at 500 without dropping cells', () => {
  const options = uniform(), first = optimizeVolumeLayers(options), again = optimizeVolumeLayers(options);
  assert.deepEqual(first, again);
  assert.equal(axes.reduce((n, axis) => n + first.plan.axes[axis].length, 0), 500);
  assert.equal(first.report.maximumLayers, 500);
  assert.equal(first.report.referenceLayers, 1536);
  assert.equal(first.report.plannedLayers, 500);
  assert.equal(first.report.status, 'budget-limited', 'A layer budget does not certify the unmet error target.');
  complete(first.plan);
  assert.deepEqual(readLayerOptimizationReport(first.report, first.plan), first.report);
  assert.throws(() => readLayerOptimizationReport({ ...first.report, status: 'target-met' }, first.plan), /differs from/);
});

test('an off-center concentrated feature receives finer groups than faint outer support', () => {
  const result = optimizeVolumeLayers({ ...uniform(), referenceSliceCounts: { x: 64, y: 64, z: 64 }, maximumLayers: 24,
    referenceSamplesPerSlab: 4, probeWidth: 16, sampleEmission(x, y, z, out) {
      out.fill(.001 + 20 * Math.exp(-.5 * (((x - .625) / .07) ** 2 + ((y + .375) / .18) ** 2 + ((z - .3125) / .09) ** 2)));
    } });
  complete(result.plan);
  assert.equal(result.report.plannedLayers, 24);
  for (const [axis, center] of [['x', .625], ['z', .3125]] as const) {
    const cell = Math.floor((center + 1) * 32);
    const core = result.plan.axes[axis].find(g => g.startCell <= cell && g.endCell > cell)!;
    const edge = result.plan.axes[axis][0]!;
    const uniformWidthAtSameBudget = 64 / (24 / 3);
    assert.ok(core.endCell - core.startCell < uniformWidthAtSameBudget,
      `${axis} core must receive finer depth placement than equal XYZ allocation at the same budget: ${JSON.stringify(result.plan.axes[axis])}`);
    assert.ok(edge.endCell - edge.startCell > core.endCell - core.startCell, `${axis} allocation must follow the off-center feature.`);
  }
});

test('small complete partitions and the combined budget match an independent exhaustive displacement oracle', () => {
  // Constant unit emission in a side-2 cube has mass 8 and boundary variation
  // 8 * cellPitch per reference cell. Integrate physical displacement directly,
  // without the planner's prefix sums or dynamic-programming recurrence.
  function alternatives(cells: number) {
    return Array.from({ length: 2 ** (cells - 1) }, (_, mask) => {
      const edges = [0, ...Array.from({ length: cells - 1 }, (_, i) => i + 1).filter(i => mask & (1 << (i - 1))), cells];
      let error = 0;
      for (let g = 1; g < edges.length; g++) {
        const first = edges[g - 1]!, end = edges[g]!, midpoint = -1 + (first + end) / cells;
        for (let cell = first; cell < end; cell++) error +=
          Math.abs((-1 + 2 * (cell + .5) / cells) - midpoint) * (8 * 2 / cells) * Math.SQRT2 / (2 * 8);
      }
      return { layers: edges.length - 1, error };
    });
  }
  const candidates = { x: alternatives(5), y: alternatives(6), z: alternatives(4) };
  let bestWorst = Infinity, bestSum = Infinity;
  for (const x of candidates.x) for (const y of candidates.y) for (const z of candidates.z) {
    if (x.layers + y.layers + z.layers > 9) continue;
    const worst = Math.max(x.error, y.error, z.error), sum = x.error + y.error + z.error;
    if (worst < bestWorst - 1e-12 || Math.abs(worst - bestWorst) < 1e-12 && sum < bestSum) { bestWorst = worst; bestSum = sum; }
  }
  const result = optimizeVolumeLayers({ ...uniform(), referenceSliceCounts: { x: 5, y: 6, z: 4 }, maximumLayers: 9 });
  complete(result.plan);
  const errors = Object.values(result.report.estimatedNormalizedL1);
  assert.ok(Math.abs(Math.max(...errors) - bestWorst) < 1e-12);
  assert.ok(Math.abs(errors.reduce((sum, n) => sum + n, 0) - bestSum) < 1e-12);
});

test('planner rejects invalid or empty emission and responds to cancellation before and during probes', () => {
  for (const value of [NaN, Infinity, -1]) assert.throws(() => optimizeVolumeLayers({ ...uniform(),
    sampleEmission(_x, _y, _z, out) { out.fill(value); } }), /finite nonnegative/);
  assert.throws(() => optimizeVolumeLayers({ ...uniform(), sampleEmission(_x, _y, _z, out) { out.fill(0); } }), /empty probe/);
  assert.throws(() => optimizeVolumeLayers({ ...uniform(), maximumLayers: 501 }), /Invalid layer optimization input/);
  const stopped = new Error('cancelled probe');
  let calls = 0;
  assert.throws(() => optimizeVolumeLayers({ ...uniform(), signal: { throwIfAborted() { throw stopped; } },
    sampleEmission(_x, _y, _z, out) { calls++; out.fill(1); } }), error => error === stopped);
  assert.equal(calls, 0);
  assert.throws(() => optimizeVolumeLayers({ ...uniform(), signal: { throwIfAborted() { if (calls) throw stopped; } },
    sampleEmission(_x, _y, _z, out) { calls++; out.fill(1); } }), error => error === stopped);
  assert.ok(calls > 0 && calls <= 8 * 8 * 4, 'Cancellation is checked again at the next reference cell.');
});
