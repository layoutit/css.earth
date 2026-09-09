import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createDensityColorVolumeSampler, type SampleImageRgb } from './density-color-volume.js';
import type { ObservationMapping } from '../density/observation-prior.js';
import type { VolumeSource } from '../../../../src/preparation/volume/source.js';

type Vec3 = [number, number, number];
const recipe = JSON.parse(await readFile('labs/nebula/models/lmc/full-density/source/volume.json', 'utf8')) as VolumeSource['recipe'];
function volume(): VolumeSource {
  const grid = new Uint8Array(4 * 4 * 4 * 4);
  // Bright RGB in every voxel is deliberately irrelevant. Alpha alone encodes density.
  for (let voxel = 0; voxel < grid.length / 4; voxel++) { grid[4 * voxel] = 255; grid[4 * voxel + 1] = 255; grid[4 * voxel + 2] = 255; }
  grid[4 * ((1 * 4 + 1) * 4 + 1) + 3] = 255;
  grid[4 * ((2 * 4 + 1) * 4 + 1) + 3] = 128;
  return { width: 4, height: 4, depth: 4, encodedRgba: grid, provenance: {}, recipe: { ...recipe,
    grid: { ...recipe.grid, dimensions: [4, 4, 4], bounds: { min: [-2, -2, -2], max: [2, 2, 2] } } } };
}
const mapping: ObservationMapping = {
  distanceUnits: 10, boundsUnits: { min: [-4, -4], max: [4, 4] },
  tangentAtUv: (u, v) => [8 * u - 4, 4 - 8 * v],
  uvAtTangent: (x, y) => Math.abs(x) <= 4 && Math.abs(y) <= 4 ? [(x + 4) / 8, (4 - y) / 8] : null,
  pointAtDepth: (x, y, z) => [x * (1 + z / 10), y * (1 + z / 10), z],
  tangentAtPoint: (x, y, z) => [x / (1 + z / 10), y / (1 + z / 10)],
  rayPathPerDepth: (x, y) => Math.hypot(1, x / 10, y / 10),
};
const solid = (rgb: Vec3): SampleImageRgb => (_u, _v, out) => { out[0] = rgb[0]; out[1] = rgb[1]; out[2] = rgb[2]; };
const at = (sampler: ReturnType<typeof createDensityColorVolumeSampler>, point: Vec3): Vec3 => {
  const out: Vec3 = [999, 999, 999]; sampler.sample(...point, out); return out;
};
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test('different image colors preserve exactly the same density support and faint/bright depth ratio', () => {
  const source = volume(), before = structuredClone(source);
  const red = createDensityColorVolumeSampler({ source, mapping, sampleImageRgb: solid([255, 0, 0]) });
  const blue = createDensityColorVolumeSampler({ source, mapping, sampleImageRgb: solid([0, 0, 255]) });
  assert.deepEqual(red.supportBoundsKpc, source.recipe.grid.bounds);
  assert.deepEqual(blue.supportBoundsKpc, red.supportBoundsKpc);
  assert.notEqual(red.supportBoundsKpc.min, source.recipe.grid.bounds.min);
  for (let z = -2; z <= 2; z += .25) for (let y = -2; y <= 2; y += .25) for (let x = -2; x <= 2; x += .25) {
    const r = at(red, [x, y, z]), b = at(blue, [x, y, z]);
    close(r[0], b[2]); assert.equal(r[1] + r[2] + b[0] + b[1], 0);
  }
  close(at(red, [-.5, -.5, -.5])[0], 1);
  close(at(red, [-.5, -.5, .5])[0], (128 / 255) ** 2);
  assert.deepEqual(source, before);
});

test('a bright full-frame image cannot fill empty voxels or extend the density bounds', () => {
  const source = volume(), sampler = createDensityColorVolumeSampler({ source, mapping, sampleImageRgb: solid([255, 255, 255]) });
  const assertEmptyVoxels = (candidate: typeof sampler) => {
    for (const point of [[1.5, 1.5, 1.5], [-1.5, -1.5, -1.5], [2.01, 0, 0], [0, 0, -2.01]] as Vec3[])
      assert.deepEqual(at(candidate, point), [0, 0, 0]);
  };
  assertEmptyVoxels(sampler);
  assert.deepEqual(at(sampler, [-.5, -.5, -.5]), [1, 1, 1]);
  // Deleting density multiplication creates light in known empty space and must fail this property.
  assert.throws(() => assertEmptyVoxels({ ...sampler, sample: (_x, _y, _z, out) => { out.fill(1); } }));
});

test('uncovered sky and callback no-data have no emission, without stretching the photo to support', () => {
  const source = volume();
  const uncovered = createDensityColorVolumeSampler({ source, mapping: { ...mapping, uvAtTangent: () => null }, sampleImageRgb: solid([255, 255, 255]) });
  const missing = createDensityColorVolumeSampler({ source, mapping, sampleImageRgb: (_u, _v, out) => { out.fill(255); return false; } });
  for (const sampler of [uncovered, missing]) {
    assert.deepEqual(at(sampler, [-.5, -.5, -.5]), [0, 0, 0]);
    assert.deepEqual(sampler.supportBoundsKpc, source.recipe.grid.bounds);
  }
});

test('UV color follows observer rays while density remains in physical coordinates', () => {
  const source = volume(), calls: number[][] = [];
  const sampler = createDensityColorVolumeSampler({ source, mapping, densityScale: 2,
    sampleImageRgb: (u, v, out) => { calls.push([u, v]); out[0] = 255 * u; out[1] = 255 * v; out[2] = 128; } });
  const result = at(sampler, [-.5, -.5, -.5]), factor = .95;
  close(calls[0][0], (-.5 / factor + 4) / 8);
  close(calls[0][1], (4 + .5 / factor) / 8);
  close(result[0], calls[0][0] * 2); close(result[1], calls[0][1] * 2); close(result[2], 256 / 255);
});

test('rectified color preserves north-up orientation, full pixel-center convention and input bytes', () => {
  const source = volume(), rgb = Uint8Array.from([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 255]);
  source.encodedRgba.fill(255);
  const photo = { width: 2, height: 2, rgb }, before = rgb.slice();
  const rectifiedMapping = { ...mapping, boundsUnits: { min: [-1, -1] as [number, number], max: [1, 1] as [number, number] } };
  const sampler = createDensityColorVolumeSampler({ source, mapping: rectifiedMapping, photo });
  assert.deepEqual(at(sampler, [-.5, .5, 0]), [1, 0, 0]);
  assert.deepEqual(at(sampler, [.5, .5, 0]), [0, 1, 0]);
  assert.deepEqual(at(sampler, [-.5, -.5, 0]), [0, 0, 1]);
  assert.deepEqual(at(sampler, [0, 0, 0]), [.5, .5, .5]);
  assert.deepEqual(at(sampler, [1.5, 0, 0]), [0, 0, 0]);
  assert.deepEqual(rgb, before);
});

test('invalid image or scaling inputs fail before baking', () => {
  const source = volume(), options = { source, mapping, sampleImageRgb: solid([255, 255, 255]) };
  for (const densityScale of [0, -1, NaN, Infinity]) assert.throws(() => createDensityColorVolumeSampler({ ...options, densityScale }), /Density scale/);
  assert.throws(() => createDensityColorVolumeSampler({ source, mapping }), /exactly one/);
  assert.throws(() => createDensityColorVolumeSampler({ ...options, photo: { width: 1, height: 1, rgb: new Uint8Array(3) } }), /exactly one/);
  assert.throws(() => createDensityColorVolumeSampler({ source, mapping, photo: { width: 2, height: 1, rgb: new Uint8Array(3) } }), /complete RGB/);
});
