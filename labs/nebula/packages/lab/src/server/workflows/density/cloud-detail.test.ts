import assert from 'node:assert/strict';
import test from 'node:test';
import type { ObservationMapping } from '../../../adapters/preparation/observation-prior.ts';
import { parseCloudAppearance, prepareCloudDetail } from '@cssearth/bake/volume';
import { registeredScalarSampler } from './registered-image.ts';

function fixture(partial = false) {
  const width = 64, height = 64, rgb = new Uint8Array(width * height * 3).fill(100);
  const mapping: ObservationMapping = {
    boundsUnits: { min: [0, 0], max: [64, 64] }, distanceUnits: 10,
    tangentAtUv: (u, v) => [u * 64, (1 - v) * 64],
    uvAtTangent: (x, y) => x >= (partial ? 16 : 0) && x < 64 && y >= 0 && y < 64 ? [x / 64, 1 - y / 64] : null,
    pointAtDepth: (x, y, z) => [x * (1 + z / 10), y * (1 + z / 10), z],
    tangentAtPoint: (x, y, z) => [x / (1 + z / 10), y / (1 + z / 10)], rayPathPerDepth: () => 1,
  };
  return { mapping, photo: { width, height, rgb, intensity: new Float32Array(width * height), coveredPixels: width * height } };
}

test('neutral appearance is exact and a partial constant image gains no false photographic edge', () => {
  const { photo, mapping } = fixture(true);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 16; x++) photo.rgb.fill(0, (y * 64 + x) * 3, (y * 64 + x + 1) * 3);
  assert.ok(prepareCloudDetail(photo, mapping).every(value => value === 1));
  const gains = prepareCloudDetail(photo, mapping, { brightness: 1, gamma: 1, saturation: 1, detailStrength: 2, detailScale: 128 });
  assert.ok(gains.every(value => Math.abs(value - 1) < 1e-6), 'No-data must not enter the local brightness estimate.');
  assert.deepEqual(parseCloudAppearance(), { brightness: 1, gamma: 1, saturation: 1, detailStrength: 0, detailScale: 24 });
  assert.deepEqual(parseCloudAppearance({ saturation: 1, detailStrength: 0, detailScale: 24 }), parseCloudAppearance());
  for (const input of [{ saturation: NaN }, { detailScale: 0 }, { detailStrength: 3 }, { gamma: 0 }, { brightness: -1 }, { extra: 1 }])
    assert.throws(() => parseCloudAppearance({ ...parseCloudAppearance(), ...input }));
});

test('strength deepens a real dark feature, scale selects its surroundings, and no point is brightened', () => {
  const { photo, mapping } = fixture();
  for (let y = 20; y < 44; y++) for (let x = 20; x < 44; x++) photo.rgb.fill(25, (y * 64 + x) * 3, (y * 64 + x + 1) * 3);
  const before = Buffer.from(photo.rgb), appearance = { brightness: 1, gamma: 1, saturation: 1, detailStrength: 1, detailScale: 128 };
  const soft = prepareCloudDetail(photo, mapping, appearance), strong = prepareCloudDetail(photo, mapping, { ...appearance, detailStrength: 2 });
  const fine = prepareCloudDetail(photo, mapping, { ...appearance, detailScale: 2 });
  const center = 32 * 64 + 32;
  assert.ok(soft[center] < .9 && strong[center] < soft[center]);
  assert.equal(fine[center], 1, 'Fine contrast leaves the interior of a broad uniform feature alone.');
  assert.ok(strong.every(value => value >= .2 - 1e-7 && value <= 1));
  assert.equal(strong[0], 1); assert.deepEqual(Buffer.from(photo.rgb), before);
  // The same Earth ray samples the same detail at different modeled depths.
  const sample = registeredScalarSampler(photo, strong, mapping);
  for (const depth of [-2, 0, 4]) assert.equal(sample(...mapping.pointAtDepth(32.5, 31.5, depth)), strong[center]);
  assert.equal(sample(-5, 4, 0), 1, 'Outside the photo is neutral material, never a new cutoff.');
});
