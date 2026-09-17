import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateForwardModel, fitForwardModel, observableForwardPoint, projectForwardModel, transformForwardPoint, FORWARD_PARAMETER_KEYS,
  type ForwardConfig, type ForwardParameters, type ParameterBounds, type WeightedPoint } from './forward-density-fit.ts';
const identity: ForwardParameters = { rotationXDeg: 0, rotationYDeg: 0, rotationZDeg: 0, xyScale: 1, yScale: 1, zScale: 1, offsetX: 0, offsetY: 0, offsetZ: 0 };
const config: ForwardConfig = { distance: 10, referenceDistance: 10, x: { min: -4, max: 4, bins: 8 }, y: { min: -4, max: 4, bins: 8 }, magnitude: { min: -.8, max: .8, bins: 32 }, sigmaMag: .06, xyKernel: [1, 2, 1], contaminationFraction: .02 };
function bounds(): ParameterBounds { return { rotationXDeg: [0, 0], rotationYDeg: [0, 0], rotationZDeg: [0, 0], xyScale: [1, 1], yScale: [1, 1], zScale: [1, 1], offsetX: [-1, 1], offsetY: [0, 0], offsetZ: [0, 0] }; }
function variance(hist: Float64Array, c: ForwardConfig) {
  let sum = 0, first = 0, second = 0;
  for (let i = 0; i < hist.length; i++) { const m = c.magnitude.min + (i % c.magnitude.bins + .5) * (c.magnitude.max - c.magnitude.min) / c.magnitude.bins; sum += hist[i]!; first += hist[i]! * m; second += hist[i]! * m * m; }
  return second / sum - (first / sum) ** 2;
}
test('physical transform order, independent axis scales and perspective use consistent dimensions', () => {
  const p = { x: 1, y: 2, z: 3, weight: 4 };
  const q = transformForwardPoint(p, { ...identity, xyScale: 2, yScale: 3, zScale: 4, rotationZDeg: 90, offsetX: 5 });
  assert.ok(Math.abs(q.x + 7) < 1e-12); assert.ok(Math.abs(q.y - 2) < 1e-12); assert.equal(q.z, 12); assert.equal(q.weight, 4);
  const sky = observableForwardPoint({ x: 2, y: 4, z: 10, weight: 1 }, 10, 10)!;
  assert.equal(sky.x, 1); assert.equal(sky.y, 2); assert.ok(Math.abs(sky.magnitude - 5 * Math.log10(Math.sqrt(420) / 10)) < 1e-12);
  assert.equal(observableForwardPoint({ x: 0, y: 0, z: -10, weight: 1 }, 10, 10), null);
  assert.deepEqual(p, { x: 1, y: 2, z: 3, weight: 4 });
});
test('magnitude uncertainty broadens observable histogram without modifying latent particles', () => {
  const points = [{ x: 0, y: 0, z: 0, weight: 1 }];
  const saved = structuredClone(points);
  const narrow = projectForwardModel(points, identity, { ...config, sigmaMag: .03 });
  const broad = projectForwardModel(points, identity, { ...config, sigmaMag: .1 });
  assert.ok(variance(broad, config) > variance(narrow, config) * 3);
  assert.deepEqual(points, saved);
  assert.deepEqual(transformForwardPoint(points[0]!, identity), saved[0]);
  assert.ok(Math.abs(broad.reduce((a,b)=>a+b,0) - 1) < 1e-10);
});
test('uncertainty scatters sources just outside magnitude selection into observed bins', () => {
  const outside = [{ x: 0, y: 0, z: 10 * (10 ** (.83 / 5) - 1), weight: 1 }];
  const zero = projectForwardModel(outside, identity, { ...config, sigmaMag: 0 }).reduce((a,b)=>a+b,0);
  const broadened = projectForwardModel(outside, identity, { ...config, sigmaMag: .1 }).reduce((a,b)=>a+b,0);
  assert.equal(zero, 0); assert.ok(broadened > .2 && broadened < .5);
});
test('heldout counts never select parameters, amplitude or starts; empty observed cells contribute', () => {
  const points: WeightedPoint[] = Array.from({ length: 45 }, (_, i) => ({ x: (i % 5 - 2) * .45, y: (Math.floor(i / 5) % 3 - 1) * .55, z: (Math.floor(i / 15) - 1) * .3, weight: 1 }));
  const target = projectForwardModel(points, { ...identity, offsetX: .5 }, config);
  const counts = target.map(v => v * 50 + .001);
  const footprint = new Float64Array(64).fill(1), split = Uint8Array.from({ length: 64 }, (_, i) => Math.floor(i / 8) % 2 ? 2 : 1);
  const conflictingTarget = projectForwardModel(points, { ...identity, offsetX: -.75 }, config);
  const changed = counts.map((v, i) => split[Math.floor(i / 32)] === 2 ? conflictingTarget[i]! * 2500 + .001 : v);
  const options = { maxSweeps: 3, refinements: 3, initialStepFraction: .25 };
  const starts = [identity, { ...identity, offsetX: -.5 }];
  const a = fitForwardModel(points, { counts, footprint, split }, config, bounds(), starts, options);
  const b = fitForwardModel(points, { counts: changed, footprint, split }, config, bounds(), starts, options);
  assert.deepEqual(a.parameters, b.parameters); assert.equal(a.amplitude, b.amplitude); assert.equal(a.train.deviance, b.train.deviance);
  assert.equal(a.evaluations, b.evaluations); assert.notEqual(a.validation.deviance, b.validation.deviance);
  assert.equal(a.parameters.offsetX, .5); assert.ok(Math.abs(a.train.expectedCount - a.train.observedCount) < 1e-8);
  // A sky cell with no observed sources remains part of the likelihood if within the footprint.
  const sparse = new Float64Array(counts.length); sparse[0] = 10;
  const result = evaluateForwardModel(points, { counts: sparse, footprint, split: new Uint8Array(64).fill(1) }, config, identity);
  const expectedAtSource = result.expected[0]!;
  const sourceTerm = 2 * (expectedAtSource - 10 + 10 * Math.log(10 / expectedAtSource));
  assert.ok(result.train.deviance > sourceTerm + 1);
});
test('missing footprint cells are excluded, and invalid dimensions, scales or budgets fail', () => {
  const points = [{ x: 0, y: 0, z: 0, weight: 1 }], footprint = new Float64Array(64).fill(1), split = new Uint8Array(64).fill(1), counts = new Float64Array(2048).fill(1);
  footprint[0] = 0;
  const a = evaluateForwardModel(points, { counts, footprint, split }, config, identity);
  const altered = counts.slice(); altered.fill(1e6, 0, 32);
  const b = evaluateForwardModel(points, { counts: altered, footprint, split }, config, identity);
  assert.equal(a.train.deviance, b.train.deviance); assert.equal(a.amplitude, b.amplitude);
  assert.throws(() => projectForwardModel(points, { ...identity, zScale: 0 }, config));
  assert.throws(() => projectForwardModel(points, identity, { ...config, sigmaMag: -1 }));
  assert.throws(() => projectForwardModel([{ ...points[0]!, weight: NaN }], identity, config));
  assert.throws(() => evaluateForwardModel(points, { counts: new Float64Array(2), footprint, split }, config, identity));
  assert.throws(() => fitForwardModel(points, { counts, footprint, split }, config, bounds(), [identity], { maxSweeps: 0, refinements: 2, initialStepFraction: .25 }));
  assert.equal(FORWARD_PARAMETER_KEYS.length, 9);
});
