import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeDensityKtx2 } from '@cssearth/bake/volume/node';
import { rotateWorldPosition, worldRotationFromQuaternion } from '@cssearth/engine';
import { alignDiscGrid } from './disc-aligned-grid.mts';
import { discDensity, type DiscModel } from './disc-envelope.mts';
import { embedNebulaFrame, reflectNebulaPoint } from '@cssearth/bake/nebula';

test('direct observation columns keep a tilted thin ring in its physical plane', () => {
  const model: DiscModel = { radiusUnits: 8, gaussianWidthUnits: 2, gaussianHeightUnits: 1,
    inclinationDeg: 45, positionAngleDeg: 0, nearSidePositionAngleDeg: 90, centreUnits: [0, 0] };
  const size = 32, half = 16, density = discDensity(model), image = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
    for (let z = 0; z < size; z++) image[y * size + x]! += density(x + .5 - half, y + .5 - half, z + .5 - half);
  const aligned = alignDiscGrid({ size, halfUnits: half, step: 1 }, [image], density, model, 6);
  const decoded = decodeDensityKtx2(Buffer.from(aligned.ktx2));
  assert.deepEqual(aligned.dimensions, [64, 64, 24]);
  const at = (z: number) => decoded.encodedRgba[4 * ((z * 64 + 32) * 64 + 48)]!;
  assert.ok(at(11) > 180, 'the ring remains bright in its own plane');
  assert.ok(at(0) < 2 && at(23) < 2, 'the retained six-height boundary is empty');
  assert.deepEqual(aligned.droppedShare, [0]);
  const embedded = embedNebulaFrame(aligned.frame, { centerIcrsDegrees: [0, 0], distancePc: 1, imageRotationDegrees: 0, arcsecPerUnit: 1 }, [0, 0, 0], true);
  const normal = rotateWorldPosition(worldRotationFromQuaternion(embedded.localToReferenceXyzw), reflectNebulaPoint([0, 0, 1], aligned.frame));
  const expected = [-Math.SQRT1_2, -Math.SQRT1_2, 0];
  normal.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]!) < 1e-12));
  assert.throws(() => alignDiscGrid({ size, halfUnits: half, step: 1 }, [image], density, model, 2), /six vertical scale heights/);
});

test('native-pixel contrast is preserved without interpolation through an encoded cubic field', () => {
  const size = 32, model: DiscModel = { radiusUnits: 8, gaussianWidthUnits: 2, gaussianHeightUnits: 1,
    inclinationDeg: 0, positionAngleDeg: 90, nearSidePositionAngleDeg: 180, centreUnits: [0, 0] };
  const image = Float32Array.from({ length: size * size }, (_, p) => p % size % 2 === 0 ? 1 : .1);
  const aligned = alignDiscGrid({ size, halfUnits: 16, step: 1 }, [image], (_x, _y, z) => Math.exp(-z * z / 2), model, 6);
  const decoded = decodeDensityKtx2(Buffer.from(aligned.ktx2));
  // This orientation reverses the image's x axis. Compare two adjacent half-pixel samples in the central plane.
  const value = (x: number) => (decoded.encodedRgba[4 * ((11 * 64 + 32) * 64 + x)]! / 255) ** 2 * aligned.peak;
  const contrast = Math.abs(value(31) - value(32)) / Math.max(value(31), value(32));
  assert.ok(contrast > .5, `native pixel contrast was blurred: ${contrast}`);
});
