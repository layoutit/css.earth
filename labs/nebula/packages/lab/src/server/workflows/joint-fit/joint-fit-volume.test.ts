import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';
import { readJointVolumeResult } from '@cssearth/bake/volume';
import { bakeJointVolume, type JointVolumeProgress } from './volume.ts';

test('joint volume samples caller arcseconds and prepares nonempty retained XYZ stacks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'joint-fit-volume-'));
  const seen = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  const progress: JointVolumeProgress[] = [];
  try {
    const result = await bakeJointVolume({ root, outputDirectory: '.local/joint-fit/fixture', id: 'fixture',
      boundsArcsec: { min: [10, -20, 30], max: [18, -16, 32] }, progress: value => progress.push(value),
      sampleEmission(x, y, z, out) {
        const point = [x, y, z];
        for (let axis = 0; axis < 3; axis++) {
          seen.min[axis] = Math.min(seen.min[axis]!, point[axis]!);
          seen.max[axis] = Math.max(seen.max[axis]!, point[axis]!);
        }
        const emission = .005 * Math.exp(-((x - 14) ** 2 + (y + 18) ** 2 + (z - 31) ** 2) / 5);
        out[0] = out[1] = out[2] = emission;
      } });
    assert.deepEqual(result.boundsArcsec, { min: [10, -20, 30], max: [18, -16, 32] });
    assert.deepEqual(result.coordinates, { axes: ['west', 'north', 'away'], localOriginArcsec: [14, -18, 31],
      earthView: 'observer-at-negative-z-looking-away' });
    assert.deepEqual(result.frame.boundsUnits, { min: [-4, -2, -1], max: [4, 2, 1] });
    assert.equal(readJointVolumeResult(result), result);
    assert.throws(() => readJointVolumeResult({ ...result, coordinates: { ...result.coordinates,
      earthView: 'observer-at-positive-z' } }), /Invalid joint-fit/);
    assert.throws(() => readJointVolumeResult({ ...result, coordinates: { ...result.coordinates,
      localOriginArcsec: [0, 0, 0] } }), /Invalid joint-fit/);
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(seen.min[axis]! > result.boundsArcsec.min[axis]!);
      assert.ok(seen.max[axis]! < result.boundsArcsec.max[axis]!);
    }
    const payload = validatePreparedCssVolume(JSON.parse(await readFile(join(root, result.volume.path), 'utf8')));
    assert.equal(payload.id, 'joint-fit-fixture');
    assert.deepEqual(payload.frame, result.frame);
    assert.ok(payload.resources.length > 0);
    for (const axis of ['x', 'y', 'z']) assert.ok(payload.stacks.find(stack => stack.axis === axis)?.leaves.length);
    assert.deepEqual(progress.at(-1), { phase: 'compile', completed: 1, total: 1, message: 'Prepared retained joint-fit scene' });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('joint volume rejects invalid bounds and an already-cancelled bake before sampling', async () => {
  const root = await mkdtemp(join(tmpdir(), 'joint-fit-volume-invalid-'));
  try {
    const common = { root, outputDirectory: 'result', id: 'fixture', sampleEmission() { throw new Error('must not sample'); } };
    await assert.rejects(bakeJointVolume({ ...common, boundsArcsec: { min: [0, 0, 0], max: [1, 0, 1] } }), /bounds/);
    await assert.rejects(bakeJointVolume({ ...common, boundsArcsec: { min: [0, 0, 0], max: [1, 1, 1] },
      signal: AbortSignal.abort() }), /cancelled/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
