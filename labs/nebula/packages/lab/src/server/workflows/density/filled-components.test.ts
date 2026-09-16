import assert from 'node:assert/strict';
import test from 'node:test';
import { decomposeFilledComponents, type FilledComponentsResult } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-components';

const options = { compactRadius: 1, extendedRadii: [3, 6], connectivity: 8 as const };

function reconstruction(result: FilledComponentsResult) {
  const output = Float64Array.from(result.compact, value => value);
  for (const component of result.components) for (let index = 0; index < component.pixels.length; index++) {
    output[component.pixels[index]!] += component.contributions[index]!;
  }
  for (let pixel = 0; pixel < output.length; pixel++) output[pixel] += result.diffuse[pixel]!;
  return output;
}

test('every source pixel is retained by compact, extended, or diffuse output', () => {
  const width = 29, height = 23, input = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    input[y * width + x] = .03 + .008 * x + .004 * y + .4 * Math.exp(-((x - 9) ** 2 + (y - 12) ** 2) / 30);
  }
  input[4 * width + 23]! += 2.5;
  input[17 * width + 18]! += 1.7;
  const result = decomposeFilledComponents(input, width, height, options), restored = reconstruction(result);
  for (let pixel = 0; pixel < input.length; pixel++) assert.ok(Math.abs(restored[pixel]! - input[pixel]!) < 2e-6);
  assert.ok(result.diagnostics.maxReconstructionError < 2e-6);
  assert.ok(result.diagnostics.compactSum > 3.5, 'isolated high-frequency light is retained');
  assert.ok(result.diagnostics.extendedSum > 0, 'broader positive structure is retained as components');
  assert.ok(result.diagnostics.diffuseSum > 0, 'the broad baseline remains explicit');
  for (const component of result.components) {
    assert.ok(component.contributions.every(value => value > 0));
    for (let index = 1; index < component.pixels.length; index++) {
      assert.ok(component.pixels[index - 1]! < component.pixels[index]!);
    }
  }
});

test('separated extended sources receive filled connected ownership instead of sparse peaks', () => {
  const width = 35, height = 21, input = new Float32Array(width * height).fill(.1);
  const disks: Array<[number, number, number, number]> = [[9, 10, 4, .7], [25, 10, 3, .5]];
  for (const [cx, cy, radius, value] of disks) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2) input[y * width + x]! += value;
  }
  const result = decomposeFilledComponents(input, width, height,
    { compactRadius: 1, extendedRadii: [2, 5], connectivity: 8 });
  const broad = result.components.filter(component => component.radius === 5 && component.pixels.length >= 20);
  assert.equal(broad.length, 2, 'the two disconnected extended footprints remain separate');
  for (const [cx, cy] of disks) {
    const owner = broad.find(component => component.pixels.includes(cy * width + cx));
    assert.ok(owner, `the full footprint owns its centre at ${cx},${cy}`);
    assert.ok(owner.pixels.length >= 25, 'ownership covers an area rather than a sparse crest');
    assert.ok(Math.abs(owner.centroid[0] - cx) < .3 && Math.abs(owner.centroid[1] - cy) < .3);
  }
});

test('reconstruction preserves an asymmetric source contour and its attached thin appendage', () => {
  const width = 27, height = 23, input = new Float32Array(width * height).fill(.1), shape = new Set<number>();
  for (let y = 7; y <= 15; y++) for (let x = 6; x <= 14; x++) shape.add(y * width + x);
  for (let x = 15; x <= 21; x++) shape.add(11 * width + x);
  for (const pixel of shape) input[pixel] = .8;
  const result = decomposeFilledComponents(input, width, height,
    { compactRadius: 1, extendedRadii: [6], connectivity: 8 });
  const owner = result.components.find(component => component.pixels.includes(11 * width + 21));
  assert.ok(owner, 'the thin appendage must remain owned with its connected broad source');
  assert.deepEqual([...owner.pixels], [...shape].sort((a, b) => a - b),
    'scale removal must preserve the complete source contour');
  assert.ok(owner.contributions.every(value => Math.abs(value - .7) < 1e-6));
});

test('point sources remain explicit compact candidates beside extended emission', () => {
  const width = 25, height = 25, input = new Float32Array(width * height).fill(.05);
  for (let y = 7; y <= 17; y++) for (let x = 7; x <= 17; x++) {
    if ((x - 12) ** 2 / 25 + (y - 12) ** 2 / 9 <= 1) input[y * width + x]! += .6;
  }
  const star = 3 * width + 20;
  input[star]! += 4;
  const result = decomposeFilledComponents(input, width, height, options);
  assert.ok(result.compact[star]! > 3.9, 'isolated source is retained in the compact candidate map');
  assert.ok(result.components.some(component => component.pixels.includes(12 * width + 12)),
    'the extended body has component ownership at its interior');
  assert.ok(!result.components.some(component => component.pixels.includes(star)),
    'compact candidate light is not relabelled as an extended component');
});

test('reconstruction revisits an earlier thin contour after the initial raster queue drains', () => {
  const width = 41, height = 41, input = new Float32Array(width * height).fill(.1);
  const shape = new Set<number>();
  for (let y = 26; y <= 34; y++) for (let x = 26; x <= 34; x++) shape.add(y * width + x);
  for (let y = 4; y < 26; y++) shape.add(y * width + 30);
  for (let x = 4; x < 30; x++) shape.add(4 * width + x);
  for (const pixel of shape) input[pixel] = .8;
  const result = decomposeFilledComponents(input, width, height,
    { compactRadius: 1, extendedRadii: [6], connectivity: 4 });
  const owner = result.components.find(component => component.pixels.includes(4 * width + 4));
  assert.ok(owner, 'backwards propagation must reach the end of the attached contour');
  assert.deepEqual([...owner.pixels], [...shape].sort((a, b) => a - b));
  assert.ok(owner.contributions.every(value => Math.abs(value - .7) < 1e-6));
});

test('explicit analysis budgets stop oversized work without partial output', () => {
  assert.throws(() => decomposeFilledComponents(new Float32Array(64 * 64), 64, 64,
    { compactRadius: 2, extendedRadii: [6, 18], connectivity: 4, maxWork: 10_000 }),
  /workload exceeds/);
  assert.throws(() => decomposeFilledComponents(new Float32Array(16 * 16), 16, 16,
    { compactRadius: 1, extendedRadii: [2], connectivity: 4, maxWork: 4_800_000_001 }),
  /budgets must be positive integers within hard limits/);
});
