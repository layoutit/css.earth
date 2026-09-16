import assert from 'node:assert/strict';
import test from 'node:test';
import type { FilledComponent, FilledComponentsResult } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-components';
import { createFilledPartsSampler } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-parts';

type Vec3 = [number, number, number];

function component(id: string, scale: number, pixels: number[], values: number[], width: number): FilledComponent {
  const total = values.reduce((sum, value) => sum + value, 0), xs = pixels.map(pixel => pixel % width);
  const ys = pixels.map(pixel => Math.floor(pixel / width));
  return { id, scale, radius: scale + 1, pixels: Uint32Array.from(pixels), contributions: Float32Array.from(values),
    bounds: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
    centroid: [xs.reduce((sum, x, i) => sum + x * values[i]!, 0) / total,
      ys.reduce((sum, y, i) => sum + y * values[i]!, 0) / total], axisLengths: [2, 1], orientationDeg: 0,
    peakIntensity: Math.max(...values), integratedIntensity: total };
}

function fixture() {
  const width = 3, height = 2;
  const components = [component('fine', 0, [0, 1, 4], [.2, .3, .1], width),
    component('broad', 1, [1, 2, 4, 5], [.25, .15, .2, .1], width)];
  const compact = Float32Array.from([.1, 0, 0, 0, 0, 0]);
  const diffuse = Float32Array.from([.05, .1, .05, 0, .1, .05]);
  const intensity = Float32Array.from(compact, (value, pixel) => value + diffuse[pixel]!);
  for (const item of components) for (let i = 0; i < item.pixels.length; i++) intensity[item.pixels[i]!] += item.contributions[i]!;
  const decomposition: FilledComponentsResult = { compact, diffuse, components, diagnostics: { inputSum: 0,
    compactSum: 0, extendedSum: 0, diffuseSum: 0, supportEntries: 0, maxReconstructionError: 0, estimatedWork: 0 } };
  const rgb = Uint8Array.from({ length: width * height * 3 }, (_, index) => [220, 130, 70][index % 3]!);
  const density = new Float32Array(3 * 2 * 5);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) density[((x + y) * 2 * 3) + y * 3 + x] = 1;
  return createFilledPartsSampler({ target: { width, height, rgb, intensity }, decomposition,
    boundsKpc: { min: [0, 0, -5], max: [3, 2, 5] }, densityPrior: { density, dimensions: [3, 2, 5],
      boundsKpc: { min: [0, 0, -5], max: [3, 2, 5] } }, mode: 'coherent',
    channels: { compact: false, diffuse: false, extended: true }, depth: { broadHalfThicknessKpc: 4,
      diffuseHalfThicknessKpc: 1, extendedMinimumHalfThicknessKpc: .1, extendedDepthAspectRatio: .4,
      compactMinimumHalfThicknessKpc: .1, compactDepthAspectRatio: .3, maxHalfThicknessKpc: 1 } });
}

test('extended contribution parts sum pointwise to the unchanged reference sampler', () => {
  const sampler = fixture(), extended = sampler.parts.filter(part => part.kind === 'extended');
  assert.deepEqual(extended.map(part => part.componentId), ['fine', 'broad']);
  let positive = 0;
  for (const x of [.35, .5, 1.15, 1.5, 2.5]) for (const y of [.5, 1.15, 1.5])
    for (let z = -4.5; z <= 4.5; z += .1) {
    const expected: Vec3 = [0, 0, 0], actual: Vec3 = [0, 0, 0], value: Vec3 = [0, 0, 0];
    sampler.reference.sample(x, y, z, expected); if (expected[0] > 0) positive++;
    for (const part of extended) { part.sample(x, y, z, value); for (let c = 0; c < 3; c++) actual[c] += value[c]; }
    actual.forEach((channel, c) => assert.ok(Math.abs(channel - expected[c]!) < 1e-7));
  }
  assert.ok(positive > 20, 'the equality sweep must cross many nonzero reference samples');
});

test('extended contribution optical columns sum exactly to the reference target', () => {
  const sampler = fixture(), extended = sampler.parts.filter(part => part.kind === 'extended');
  for (let pixel = 0; pixel < 6; pixel++) {
    const expected: Vec3 = [0, 0, 0], actual: Vec3 = [0, 0, 0], value: Vec3 = [0, 0, 0];
    sampler.reference.integratedTargetAtPixel(pixel, expected);
    for (const part of extended) { part.integratedTargetAtPixel(pixel, value); for (let c = 0; c < 3; c++) actual[c] += value[c]; }
    actual.forEach((channel, c) => assert.ok(Math.abs(channel - expected[c]!) < 1e-7));
  }
});

test('compact and diffuse remain separately calibrated frozen-plane inspection channels', () => {
  const sampler = fixture(), compact = sampler.parts.find(part => part.kind === 'compact')!;
  const diffuse = sampler.parts.find(part => part.kind === 'diffuse')!;
  assert.match(compact.interpretation, /no stellar membership/);
  assert.match(diffuse.interpretation, /not measured gas depth/);
  const compactColumn: Vec3 = [0, 0, 0], diffuseColumn: Vec3 = [0, 0, 0];
  compact.integratedTargetAtPixel(0, compactColumn); diffuse.integratedTargetAtPixel(0, diffuseColumn);
  assert.ok(compactColumn[0] > 0 && diffuseColumn[0] > 0);
  for (const [part, expected] of [[compact, compactColumn], [diffuse, diffuseColumn]] as const) {
    const actual: Vec3 = [0, 0, 0], value: Vec3 = [0, 0, 0], steps = 40_000;
    const dz = (part.supportBoundsKpc.max[2] - part.supportBoundsKpc.min[2]) / steps;
    for (let step = 0; step < steps; step++) {
      part.sample(.5, 1.5, part.supportBoundsKpc.min[2] + (step + .5) * dz, value);
      for (let channel = 0; channel < 3; channel++) actual[channel] += value[channel] * dz;
    }
    actual.forEach((channel, index) => assert.ok(Math.abs(channel - expected[index]!) < 2e-5));
  }
  const out: Vec3 = [1, 1, 1];
  compact.sample(.5, 1.5, compact.supportBoundsKpc.min[2] - 1e-4, out);
  assert.deepEqual(out, [0, 0, 0]);
});

test('part preparation refuses a basis that would refit or renormalize the reference', () => {
  assert.throws(() => createFilledPartsSampler({} as never), /extended-only reference basis/);
});
