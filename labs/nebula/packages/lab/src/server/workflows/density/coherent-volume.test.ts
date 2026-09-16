import assert from 'node:assert/strict';
import test from 'node:test';
import { createCoherentVolumeSampler, type CoherentVolumeOptions } from '@cssearth/nebula-reconstruction/methods/density-prior/coherent-volume';
import type { StructureRegion } from '@cssearth/nebula-reconstruction/evidence/wavelets';

type Vec3 = [number, number, number];
const bounds = { min: [0, 0, -5] as Vec3, max: [4, 2, 5] as Vec3 };

function region(id: string, scale: number, support: number[], parentId?: string): StructureRegion {
  const xs = support.map(pixel => pixel % 4), ys = support.map(pixel => Math.floor(pixel / 4));
  return { id, scale, morphology: 'elongated', support: Uint32Array.from([...support].sort((a, b) => a - b)),
    bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
    centroid: [xs.reduce((sum, x) => sum + x, 0) / xs.length,
      ys.reduce((sum, y) => sum + y, 0) / ys.length],
    axisLengths: [Math.max(1, support.length), 1], orientationDeg: 0,
    peakCoefficient: 1, integratedCoefficient: support.length, ...(parentId ? { parentId } : {}) };
}

function rgba(width: number, height: number, value: [number, number, number, number]): Uint8Array {
  const output = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel++) output.set(value, 4 * pixel);
  return output;
}

function sampler(overrides: Partial<CoherentVolumeOptions> = {}) {
  return createCoherentVolumeSampler({ target: { width: 4, height: 2, rgba: rgba(4, 2, [128, 64, 32, 192]) },
    boundsKpc: bounds, catalog: [], baseHalfThicknessKpc: 3, structureHalfThicknessKpc: .45,
    ...overrides });
}

function integrate(sample: (x: number, y: number, z: number, out: Vec3) => void,
  x: number, y: number, steps = 40_000): Vec3 {
  const result: Vec3 = [0, 0, 0], value: Vec3 = [0, 0, 0];
  const dz = (bounds.max[2] - bounds.min[2]) / steps;
  for (let step = 0; step < steps; step++) {
    sample(x, y, bounds.min[2] + (step + .5) * dz, value);
    result[0] += value[0] * dz; result[1] += value[1] * dz; result[2] += value[2] * dz;
  }
  return result;
}

test('every reference pixel keeps the photo-master RGBA optical column inside finite Z bounds', () => {
  const volume = sampler({ catalog: [region('fine', 0, [1, 2]), region('broad', 1, [0, 1, 2, 3])],
    baseFraction: .25, maxDisplaySignal: .98, exposureGain: 1 });
  const peak = 128 / 255 * (192 / 255);
  const expectedPeak = -Math.log(1 - peak);
  const expected: Vec3 = [expectedPeak, expectedPeak / 2, expectedPeak / 4];
  for (let pixel = 0; pixel < 8; pixel++) {
    const x = pixel % 4 + .5, y = 2 - (Math.floor(pixel / 4) + .5);
    const integrated = integrate(volume.sample, x, y);
    integrated.forEach((value, channel) => assert.ok(Math.abs(value - expected[channel]!) < 2e-5));
  }
  const out: Vec3 = [1, 1, 1];
  volume.sample(1.5, 1.5, 5.001, out); assert.deepEqual(out, [0, 0, 0]);
  volume.sample(-.001, 1.5, 0, out); assert.deepEqual(out, [0, 0, 0]);
  assert.equal(volume.diagnostics.assignmentCoverage.catalogSupportedPositivePixels, 4);
});

test('overlapping scales form one coherent family with one bounded depth support', () => {
  const catalog = [region('fine', 0, [1, 2]), region('coarse', 2, [0, 1, 2, 3])];
  const volume = sampler({ catalog, baseFraction: 0, maxDepthVariationKpc: 0 });
  assert.equal(volume.diagnostics.depthSupports.length, 1);
  assert.deepEqual(volume.diagnostics.depthSupports[0]!.regionIds, ['coarse', 'fine']);
  assert.ok(volume.diagnostics.depthSupports[0]!.maxKpc - volume.diagnostics.depthSupports[0]!.minKpc < 1);
  const left: Vec3 = [0, 0, 0], right: Vec3 = [0, 0, 0];
  for (const z of [-1, 0, 1]) {
    volume.sample(.5, 1.5, z, left); volume.sample(3.5, 1.5, z, right);
    assert.deepEqual(left, right, 'connected support shares a profile rather than choosing pixel depths');
  }
  volume.sample(.5, 1.5, 2, left);
  assert.deepEqual(left, [0, 0, 0], 'localized structure is not smeared through the stellar Z range');
});

test('stellar placement chooses a mode and does not average separated peaks into their empty gap', () => {
  const density = new Float32Array(1 * 1 * 5);
  density[0] = 2; density[4] = 7;
  const volume = sampler({ catalog: [region('cloud', 0, [0, 1, 2, 3, 4, 5, 6, 7])], baseFraction: 0,
    densityPrior: { density, dimensions: [1, 1, 5], boundsKpc: bounds } });
  const support = volume.diagnostics.depthSupports[0]!;
  assert.equal(support.placement, 'family-mode');
  assert.deepEqual(support.priorModesKpc, [-4, 4]);
  assert.equal(support.priorModeKpc, 4);
  assert.equal(support.centerKpc, 4);
  const out: Vec3 = [0, 0, 0];
  volume.sample(.5, 1.5, 0, out);
  assert.deepEqual(out, [0, 0, 0], 'the empty interval between prior peaks receives no localized light');
  volume.sample(.5, 1.5, 4, out);
  assert.ok(out[0] > 0);
});

test('an edge mode that cannot contain the declared support is not shifted and claimed as prior placement', () => {
  const density = new Float32Array(5);
  density[0] = 9; density[2] = 3;
  const volume = sampler({ catalog: [region('cloud', 0, [0, 1, 2, 3])], baseFraction: 0,
    structureHalfThicknessKpc: 1.5,
    densityPrior: { density, dimensions: [1, 1, 5], boundsKpc: bounds } });
  const support = volume.diagnostics.depthSupports[0]!;
  assert.deepEqual(support.priorModesKpc, [-4, 0]);
  assert.equal(support.priorModeKpc, 0);
  assert.equal(support.centerKpc, 0);

  density[2] = 0;
  const unsupported = sampler({ catalog: [region('cloud', 0, [0, 1, 2, 3])], baseFraction: 0,
    structureHalfThicknessKpc: 1.5,
    densityPrior: { density, dimensions: [1, 1, 5], boundsKpc: bounds } });
  assert.equal(unsupported.diagnostics.depthSupports[0]!.priorModeKpc, undefined);
  assert.equal(unsupported.diagnostics.depthSupports[0]!.placement, 'bounds-midpoint');
});

test('declared parents must overlap in raster support', () => {
  assert.throws(() => sampler({ catalog: [region('parent', 1, [0]), region('child', 0, [3], 'parent')] }),
    /does not overlap/);
});

test('a full 512-square connected support reports its span without argument-spread overflow', () => {
  const width = 512, height = 512;
  const support = Uint32Array.from({ length: width * height }, (_, pixel) => pixel);
  const target = { width, height, rgba: rgba(width, height, [1, 1, 1, 1]) };
  const cloud: StructureRegion = { id: 'diffuse', scale: 0, morphology: 'diffuse', support,
    bounds: { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 },
    centroid: [(width - 1) / 2, (height - 1) / 2], axisLengths: [width, height],
    orientationDeg: 0, peakCoefficient: 1, integratedCoefficient: support.length };
  const volume = createCoherentVolumeSampler({ target,
    boundsKpc: { min: [0, 0, -1], max: [2, 2, 1] }, catalog: [cloud],
    baseHalfThicknessKpc: 1, structureHalfThicknessKpc: .25 });
  assert.deepEqual(volume.diagnostics.depthSupports[0]!.spanPixels, [512, 512]);
  assert.equal(volume.diagnostics.familyCount, 1);
  assert.equal(volume.diagnostics.assignmentCoverage.hasLocalizedAssignment, true);
});

test('an empty prior falls back to one deterministic common mode without per-pixel randomness', () => {
  const catalog = [region('cloud', 0, [0, 1, 2, 3])];
  const options = { catalog, baseFraction: 0,
    densityPrior: { density: new Float32Array(5), dimensions: [1, 1, 5] as Vec3, boundsKpc: bounds } };
  const first = sampler(options), second = sampler(options);
  assert.deepEqual(first.diagnostics.depthSupports, second.diagnostics.depthSupports);
  assert.equal(first.diagnostics.depthSupports[0]!.placement, 'bounds-midpoint');
  const values: Vec3[] = [];
  for (const x of [.5, 1.5, 2.5, 3.5]) {
    const out: Vec3 = [0, 0, 0]; first.sample(x, 1.5, 0, out); values.push([...out]);
  }
  assert.deepEqual(values, [values[0], values[0], values[0], values[0]]);
  const away: Vec3 = [0, 0, 0]; first.sample(.5, 1.5, 2, away);
  assert.deepEqual(away, [0, 0, 0]);
  assert.equal(first.diagnostics.priors.positiveVoxels, 0);
});

test('physical sample axes map left-to-right and max-Y-to-first-raster-row', () => {
  const pixels = new Uint8Array([
    255, 0, 0, 255, 0, 255, 0, 255,
    0, 0, 255, 255, 255, 255, 255, 255,
  ]);
  const volume = createCoherentVolumeSampler({ target: { width: 2, height: 2, rgba: pixels },
    boundsKpc: { min: [10, 20, -1], max: [14, 24, 1] }, catalog: [],
    baseHalfThicknessKpc: 1, structureHalfThicknessKpc: .25 });
  const topLeft: Vec3 = [0, 0, 0], topRight: Vec3 = [0, 0, 0], bottomLeft: Vec3 = [0, 0, 0];
  volume.sample(11, 23, 0, topLeft); volume.sample(13, 23, 0, topRight); volume.sample(11, 21, 0, bottomLeft);
  assert.ok(topLeft[0] > 0 && topLeft[1] === 0 && topLeft[2] === 0);
  assert.ok(topRight[1] > 0 && topRight[0] === 0 && topRight[2] === 0);
  assert.ok(bottomLeft[2] > 0 && bottomLeft[0] === 0 && bottomLeft[1] === 0);
});

test('RGB plus luminance follows the same shared-opacity column contract', () => {
  const volume = createCoherentVolumeSampler({ target: { width: 1, height: 1,
    rgb: Uint8Array.from([255, 128, 0]), luminance: Float32Array.from([.5]) },
    boundsKpc: { min: [0, 0, -5], max: [1, 1, 5] }, catalog: [],
    baseHalfThicknessKpc: 2, structureHalfThicknessKpc: .5 });
  const integrated = integrate(volume.sample, .5, .5);
  const peak = -Math.log(.5);
  assert.ok(Math.abs(integrated[0] - peak) < 2e-5);
  assert.ok(Math.abs(integrated[1] - peak * 128 / 255) < 2e-5);
  assert.ok(Math.abs(integrated[2]) < 1e-12);
});
