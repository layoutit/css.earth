import assert from 'node:assert/strict';
import test from 'node:test';
import type { FilledComponent, FilledComponentsResult } from './filled-components.js';
import { createFilledVolumeSampler, type FilledVolumeOptions } from './filled-volume.js';

type Vec3 = [number, number, number];
const bounds = { min: [0, 0, -5] as Vec3, max: [5, 5, 5] as Vec3 };

function component(id: string, pixels: number[], contributions: number[], width: number,
  scale = 0): FilledComponent {
  const xs = pixels.map(pixel => pixel % width), ys = pixels.map(pixel => Math.floor(pixel / width));
  const total = contributions.reduce((sum, value) => sum + value, 0);
  return { id, scale, radius: scale + 1, pixels: Uint32Array.from(pixels), contributions: Float32Array.from(contributions),
    bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
    centroid: [xs.reduce((sum, x, index) => sum + x * contributions[index]!, 0) / total,
      ys.reduce((sum, y, index) => sum + y * contributions[index]!, 0) / total],
    axisLengths: [Math.max(1, Math.max(...xs) - Math.min(...xs)), Math.max(1, Math.max(...ys) - Math.min(...ys))],
    orientationDeg: 0, peakIntensity: Math.max(...contributions), integratedIntensity: total };
}

function decomposition(width: number, height: number, compact: number[], diffuse: number[],
  components: FilledComponent[]): FilledComponentsResult {
  return { compact: Float32Array.from(compact), diffuse: Float32Array.from(diffuse), components,
    diagnostics: { inputSum: 0, compactSum: 0, extendedSum: 0, diffuseSum: 0, supportEntries: 0,
      maxReconstructionError: 0, estimatedWork: 0 } };
}

function makeOptions(width: number, height: number, result: FilledComponentsResult,
  overrides: Partial<FilledVolumeOptions> = {}): FilledVolumeOptions {
  const intensity = Float32Array.from(result.compact);
  for (let pixel = 0; pixel < intensity.length; pixel++) intensity[pixel] += result.diffuse[pixel]!;
  for (const item of result.components) for (let index = 0; index < item.pixels.length; index++) {
    intensity[item.pixels[index]!] += item.contributions[index]!;
  }
  return { target: { width, height, rgb: new Uint8Array(width * height * 3).fill(255), intensity },
    decomposition: result, boundsKpc: { min: [0, 0, -5], max: [width, height, 5] }, mode: 'coherent',
    depth: { broadHalfThicknessKpc: 4, diffuseHalfThicknessKpc: 2,
      extendedMinimumHalfThicknessKpc: .1, extendedDepthAspectRatio: .5,
      compactMinimumHalfThicknessKpc: .1, compactDepthAspectRatio: .5, maxHalfThicknessKpc: 2 }, ...overrides };
}

function integrate(options: FilledVolumeOptions, pixel: number, steps = 60_000): { actual: Vec3; expected: Vec3 } {
  const volume = createFilledVolumeSampler(options), actual: Vec3 = [0, 0, 0], value: Vec3 = [0, 0, 0], expected: Vec3 = [0, 0, 0];
  const x = pixel % options.target.width + .5;
  const y = options.target.height - (Math.floor(pixel / options.target.width) + .5);
  const dz = (options.boundsKpc.max[2] - options.boundsKpc.min[2]) / steps;
  for (let index = 0; index < steps; index++) {
    volume.sample(x, y, options.boundsKpc.min[2] + (index + .5) * dz, value);
    for (let channel = 0; channel < 3; channel++) actual[channel] += value[channel] * dz;
  }
  volume.integratedTargetAtPixel(pixel, expected);
  return { actual, expected };
}

test('selected channels map to optical space after selection and retain their exact projected colour', () => {
  const result = decomposition(1, 1, [.2], [.1], [component('extended', [0], [.5], 1)]);
  const options = makeOptions(1, 1, result, { channels: { compact: false, diffuse: false, extended: true },
    target: { width: 1, height: 1, rgb: Uint8Array.from([255, 128, 64]), intensity: Float32Array.from([.8]) } });
  const volume = createFilledVolumeSampler(options), optical: Vec3 = [0, 0, 0], display: Vec3 = [0, 0, 0];
  volume.integratedTargetAtPixel(0, optical); volume.displayTargetAtPixel(0, display);
  assert.ok(Math.abs(optical[0] + Math.log(1 - .5 / .8)) < 1e-6,
    'source RGB is scaled by the selected share before optical transfer');
  const expectedDisplay = [.5 / .8, .5 / .8 * 128 / 255, .5 / .8 * 64 / 255];
  display.forEach((value, channel) => assert.ok(Math.abs(value - expectedDisplay[channel]!) < 3e-8));
  const integrated = integrate(options, 0);
  integrated.actual.forEach((value, channel) => assert.ok(Math.abs(value - integrated.expected[channel]!) < 2e-5));
});

test('broad mode follows distinct normalized prior columns without filling their empty middle', () => {
  const result = decomposition(2, 1, [0, 0], [1, 1], []);
  const density = new Float32Array(2 * 1 * 5); density[0] = 5; density[(4 * 1) * 2 + 1] = 7;
  const options = makeOptions(2, 1, result, { mode: 'broad', densityPrior: { density, dimensions: [2, 1, 5],
    boundsKpc: { min: [0, 0, -5], max: [2, 1, 5] } } });
  const volume = createFilledVolumeSampler(options), left: Vec3 = [0, 0, 0], right: Vec3 = [0, 0, 0];
  volume.sample(.5, .5, -4, left); volume.sample(.5, .5, 0, right);
  assert.ok(left[0] > 0); assert.equal(right[0], 0);
  volume.sample(1.5, .5, 4, right); assert.ok(right[0] > 0);
  for (const pixel of [0, 1]) {
    const integrated = integrate(options, pixel);
    integrated.actual.forEach((value, channel) => assert.ok(Math.abs(value - integrated.expected[channel]!) < 2e-4));
  }
});

test('prior Y ascends in tangent space while photograph raster rows descend', () => {
  const result = decomposition(1, 2, [0, 0], [1, 1], []);
  const density = new Float32Array(1 * 2 * 5);
  density[0] = 8; // low tangent Y, low Z
  density[(4 * 2) + 1] = 8; // high tangent Y, high Z
  const volume = createFilledVolumeSampler(makeOptions(1, 2, result, { mode: 'broad',
    densityPrior: { density, dimensions: [1, 2, 5], boundsKpc: { min: [0, 0, -5], max: [1, 2, 5] } } }));
  const topHigh: Vec3 = [0, 0, 0], topLow: Vec3 = [0, 0, 0], bottomLow: Vec3 = [0, 0, 0];
  volume.sample(.5, 1.5, 4, topHigh); volume.sample(.5, 1.5, -4, topLow);
  volume.sample(.5, .5, -4, bottomLow);
  assert.ok(topHigh[0] > 0 && topLow[0] === 0 && bottomLow[0] > 0);
});

test('coherent families use separated prior modes through one bounded continuous depth field', () => {
  const result = decomposition(4, 1, [0, 0, 0, 0], [0, 0, 0, 0],
    [component('left', [0], [.7], 4), component('right', [3], [.7], 4)]);
  const density = new Float32Array(4 * 1 * 5); density[0] = 9; density[4 * 4 + 3] = 9;
  const options = makeOptions(4, 1, result, { densityPrior: { density, dimensions: [4, 1, 5],
    boundsKpc: { min: [0, 0, -5], max: [4, 1, 5] } }, depth: { broadHalfThicknessKpc: 4,
      diffuseHalfThicknessKpc: 2, extendedMinimumHalfThicknessKpc: .1, extendedDepthAspectRatio: .5,
      compactMinimumHalfThicknessKpc: .1, compactDepthAspectRatio: .5, maxHalfThicknessKpc: .5,
      maxLocalDepthOffsetKpc: 4 } });
  const volume = createFilledVolumeSampler(options), low: Vec3 = [0, 0, 0], high: Vec3 = [0, 0, 0];
  assert.equal(volume.diagnostics.prior.locatedFamilies, 2);
  volume.sample(.5, .5, -4, low); volume.sample(.5, .5, 4, high);
  assert.ok(low[0] > 0 && high[0] === 0);
  volume.sample(3.5, .5, -4, low); volume.sample(3.5, .5, 4, high);
  assert.ok(high[0] > 0 && low[0] === 0);
});

test('extended supports are finite, continuous at their C1 boundary, and thicker inside a footprint', () => {
  const pixels = Array.from({ length: 25 }, (_, pixel) => pixel);
  const cloud = component('filled', pixels, pixels.map(() => .2), 5);
  cloud.axisLengths = [4, 4]; cloud.centroid = [2, 2];
  const result = decomposition(5, 5, new Array(25).fill(0), new Array(25).fill(0), [cloud]);
  const options = makeOptions(5, 5, result, { depth: { broadHalfThicknessKpc: 4, diffuseHalfThicknessKpc: 2,
    extendedMinimumHalfThicknessKpc: .1, extendedDepthAspectRatio: .8,
    compactMinimumHalfThicknessKpc: .1, compactDepthAspectRatio: .5, maxHalfThicknessKpc: 2 } });
  const volume = createFilledVolumeSampler(options), center: Vec3 = [0, 0, 0], edge: Vec3 = [0, 0, 0];
  volume.sample(2.5, 2.5, 1, center); volume.sample(.5, 2.5, 1, edge);
  assert.ok(Number.isFinite(center[0]) && center[0] > 0); assert.equal(edge[0], 0);
  volume.sample(2.5, 2.5, 2.001, center); assert.equal(center[0], 0, 'support ends within declared maximum');
  volume.sample(2.5, 2.5, 2, center); assert.equal(center[0], 0, 'kernel reaches zero continuously at boundary');
});

test('invalid pointwise decomposition accounting is rejected', () => {
  const result = decomposition(1, 1, [0], [0], []);
  const options = makeOptions(1, 1, result, { target: { width: 1, height: 1, rgb: Uint8Array.from([255, 255, 255]),
    intensity: Float32Array.from([.5]) } });
  assert.throws(() => createFilledVolumeSampler(options), /does not reconstruct/);
});

test('coherent local profiles report conservative cropped support for an asymmetric depth plane', () => {
  const components = [component('low', [0], [.6], 2), component('middle', [1], [.6], 2),
    component('high', [3], [.6], 2)];
  const result = decomposition(2, 2, [0, 0, 0, 0], [0, 0, 0, 0], components);
  const density = new Float32Array(2 * 2 * 9);
  density[2 * 4] = 8; density[4 * 4 + 1] = 8; density[6 * 4 + 3] = 8;
  const options = makeOptions(2, 2, result, { channels: { compact: false, diffuse: false, extended: true },
    densityPrior: { density, dimensions: [2, 2, 9], boundsKpc: { min: [0, 0, -5], max: [2, 2, 5] } },
    depth: { broadHalfThicknessKpc: 4, diffuseHalfThicknessKpc: 1,
      extendedMinimumHalfThicknessKpc: .08, extendedDepthAspectRatio: .1,
      compactMinimumHalfThicknessKpc: .08, compactDepthAspectRatio: .1, maxHalfThicknessKpc: .25,
      maxLocalDepthOffsetKpc: 4 } });
  const volume = createFilledVolumeSampler(options), out: Vec3 = [0, 0, 0];
  assert.ok(volume.supportBoundsKpc.min[2] > options.boundsKpc.min[2]);
  assert.ok(volume.supportBoundsKpc.max[2] < options.boundsKpc.max[2]);
  for (const [x, y] of [[.5, 1.5], [1.5, 1.5], [1.5, .5]]) {
    volume.sample(x!, y!, volume.supportBoundsKpc.min[2] - 1e-4, out); assert.deepEqual(out, [0, 0, 0]);
    volume.sample(x!, y!, volume.supportBoundsKpc.max[2] + 1e-4, out); assert.deepEqual(out, [0, 0, 0]);
  }
});

test('broad mode and coherent raw-prior diffuse light retain the full model support bounds', () => {
  const result = decomposition(1, 1, [0], [.5], []), density = Float32Array.from([1, 0, 1]);
  const prior = { density, dimensions: [1, 1, 3] as Vec3,
    boundsKpc: { min: [0, 0, -5] as Vec3, max: [1, 1, 5] as Vec3 } };
  for (const mode of ['broad', 'coherent'] as const) {
    const volume = createFilledVolumeSampler(makeOptions(1, 1, result, { mode, densityPrior: prior,
      diffusePriorWeight: .1 }));
    assert.deepEqual(volume.supportBoundsKpc, { min: [0, 0, -5], max: [1, 1, 5] });
  }
});

test('one connected component inherits a continuous inclination fitted from supported prior columns', () => {
  const cloud = component('one-cloud', [0, 1, 2], [.5, .5, .5], 3);
  const result = decomposition(3, 1, [0, 0, 0], [0, 0, 0], [cloud]);
  const density = new Float32Array(3 * 1 * 5);
  density[0] = 9; density[2 * 3 + 1] = 9; density[4 * 3 + 2] = 9;
  const volume = createFilledVolumeSampler(makeOptions(3, 1, result, {
    channels: { compact: false, diffuse: false, extended: true },
    densityPrior: { density, dimensions: [3, 1, 5], boundsKpc: { min: [0, 0, -5], max: [3, 1, 5] } },
    depth: { broadHalfThicknessKpc: 4, diffuseHalfThicknessKpc: 1,
      extendedMinimumHalfThicknessKpc: .1, extendedDepthAspectRatio: .1,
      compactMinimumHalfThicknessKpc: .1, compactDepthAspectRatio: .1, maxHalfThicknessKpc: .2,
      maxLocalDepthOffsetKpc: 0 } }));
  assert.ok(volume.diagnostics.depthPlane.xSlope > 2,
    'inclination comes from prior columns even though decomposition has only one family');
  const low: Vec3 = [0, 0, 0], high: Vec3 = [0, 0, 0];
  volume.sample(.5, .5, -4, low); volume.sample(.5, .5, 4, high);
  assert.ok(low[0] > 0 && high[0] === 0);
  volume.sample(2.5, .5, -4, low); volume.sample(2.5, .5, 4, high);
  assert.ok(high[0] > 0 && low[0] === 0);
});

test('raw prior interpolation is continuous between cell centres and keeps a unit depth integral', () => {
  const result = decomposition(1, 1, [0], [.5], []);
  const options = makeOptions(1, 1, result, { mode: 'broad',
    boundsKpc: { min: [0, 0, -3], max: [1, 1, 3] },
    densityPrior: { density: Float32Array.from([0, 1, 0]), dimensions: [1, 1, 3],
      boundsKpc: { min: [0, 0, -3], max: [1, 1, 3] } },
    depth: { broadHalfThicknessKpc: 2, diffuseHalfThicknessKpc: 1,
      extendedMinimumHalfThicknessKpc: .1, extendedDepthAspectRatio: .1,
      compactMinimumHalfThicknessKpc: .1, compactDepthAspectRatio: .1, maxHalfThicknessKpc: 1 } });
  const volume = createFilledVolumeSampler(options), left: Vec3 = [0, 0, 0], right: Vec3 = [0, 0, 0];
  volume.sample(.5, .5, -1 - 1e-5, left); volume.sample(.5, .5, -1 + 1e-5, right);
  assert.ok(Math.abs(left[0] - right[0]) < 1e-4, 'linear centre interpolation has no nearest-cell step');
  const integrated = integrate(options, 0);
  integrated.actual.forEach((value, channel) => assert.ok(Math.abs(value - integrated.expected[channel]!) < 2e-5));
});
