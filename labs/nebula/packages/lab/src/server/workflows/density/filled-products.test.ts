import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import { rectifyObservation, validateObservationProjection } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-products';
import type { ObservationMapping } from '../../../adapters/preparation/observation-prior.ts';

type Vec3 = [number, number, number];
const mapping: ObservationMapping = {
  distanceUnits: 10, boundsUnits: { min: [-1, -1], max: [1, 1] },
  tangentAtUv: (u, v) => [2 * u - 1, 1 - 2 * v],
  uvAtTangent: (x, y) => Math.abs(x) <= 1 && Math.abs(y) <= 1 ? [(x + 1) / 2, (1 - y) / 2] : null,
  pointAtDepth: (x, y, z) => [x * (1 + z / 10), y * (1 + z / 10), z],
  tangentAtPoint: (x, y, z) => [x / (1 + z / 10), y / (1 + z / 10)],
  rayPathPerDepth: (x, y) => Math.hypot(1, x / 10, y / 10),
};

test('native observation resampling retains color, orientation and uncovered sky', async () => {
  const rgb = Buffer.alloc(16 * 16 * 3);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    rgb[3 * (y * 16 + x)] = x * 15; rgb[3 * (y * 16 + x) + 1] = y * 15; rgb[3 * (y * 16 + x) + 2] = 40;
  }
  const png = await sharp(rgb, { raw: { width: 16, height: 16, channels: 3 } }).png().toBuffer();
  const result = await rectifyObservation(png, mapping, 16);
  assert.deepEqual(result.rgb, new Uint8Array(rgb));
  assert.equal(result.coveredPixels, 256);
  const uncovered = await rectifyObservation(png, { ...mapping, uvAtTangent: (x, y) => x > 0 ? null : mapping.uvAtTangent(x, y) }, 16);
  assert.equal(uncovered.coveredPixels, 128);
  assert.deepEqual([...uncovered.rgb.subarray(3 * 8, 3 * 9)], [0, 0, 0]);
});

test('projection gate detects a missing physical ray-length correction', () => {
  const photo = { width: 16, height: 16, rgb: new Uint8Array(16 * 16 * 3).fill(128),
    intensity: new Float32Array(16 * 16).fill(.5), coveredPixels: 256 };
  const bounds = { min: [-1, -1, -1] as Vec3, max: [1, 1, 1] as Vec3 };
  const expected = 1 - Math.exp(-1);
  const sampler = { sample: (_x: number, _y: number, _z: number, out: Vec3) => { out[0] = out[1] = out[2] = .5; },
    displayTargetAtPixel: (_pixel: number, out: Vec3) => { out[0] = out[1] = out[2] = expected; } };
  const physical = (x: number, y: number, z: number, out: Vec3) => {
    const [tx, ty] = mapping.tangentAtPoint(x, y, z);
    out[0] = out[1] = out[2] = .5 / mapping.rayPathPerDepth(tx, ty);
  };
  const options = { sampler, physicalSample: physical, mapping, photo, bounds, samples: 64, exposure: 1 };
  assert.ok(validateObservationProjection(options).maximumDisplayChannelError.every(value => value < 1e-12));
  assert.throws(() => validateObservationProjection({ ...options, physicalSample: sampler.sample }), /not converged/);
});
