import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bankSpec, planeLayout, writeGalaxyModelBank, IDENTITY_BANK_FIT } from '../../milky-way-dust/galaxy-fitted-bank.mts';
import { compileGalaxySliceVolume } from '../../milky-way-dust/galaxy-slice-compile.mts';
import { deliveryPhysicalFrame } from './delivery-frame.mts';
import { attachModelFarPictures } from './far-bank.mts';

test('model pictures preserve 33 spatial X/Y/Z layers and cannot force a resolved Earth view to a billboard', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lmc-layer-handoff-'));
  try {
    const spec = bankSpec({ box: { min: [-10, -10, -2.1], max: [10, 10, 2.1] }, counts: [10, 9, 7],
      size: 16, record: 'source/preparation/l36/fit.json', texturePrefix: 'l36-near', hybrid: { densePerAxis: [2, 2, 3] } });
    const planes = ([0, 1, 2] as const).flatMap(axis => Array.from({ length: spec.counts[axis] }, (_, index) => {
      const p = planeLayout(spec, axis, index);
      return { ...p, rgb: new Float64Array(p.width * p.height * 3).fill(.01), tau: new Float64Array(p.width * p.height).fill(.1) };
    }));
    await writeGalaxyModelBank(directory + '/', spec, planes, [IDENTITY_BANK_FIT, IDENTITY_BANK_FIT, IDENTITY_BANK_FIT],
      new Set(['0:4', '0:5', '1:4', '1:5', '2:2', '2:3', '2:4']));
    const prototype: unknown = JSON.parse(await readFile(directory + '/prototype.json', 'utf8'));
    const volume = compileGalaxySliceVolume(prototype, deliveryPhysicalFrame(), directory, 'lmc-volume', {
      record: spec.record, texturePrefix: spec.texturePrefix,
    });
    const written = new Map<string, Uint8Array>();
    const result = await attachModelFarPictures(volume, async () => ({ rgba: new Uint8Array(16 * 16 * 4).fill(80), size: 16 }),
      async (path, bytes) => { written.set(path, bytes); });
    assert.deepEqual(result.stacks, volume.stacks, 'Attaching distant pictures must preserve the actual slab geometry');
    assert.deepEqual(result.stacks.map(s => s.leaves.length), [12, 11, 10]);
    assert.deepEqual(result.stacks.map((s, axis) => new Set(s.leaves.map(l => l.centerUnits[axis])).size), [10, 9, 7]);
    assert.equal(result.impostors?.distanceFade, undefined, 'Physical distance must not override resolved X/Y/Z layers');
    assert.equal(result.impostors?.fullBelowDiameterPixels, 128);
    assert.equal(result.impostors?.volumeAboveDiameterPixels, 256);
    assert.equal(written.size, 8);
    assert.ok([...written.values()].every(bytes => bytes.length > 0));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
