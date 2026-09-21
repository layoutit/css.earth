import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { bakeMasterVolumeSlices, type MasterVolumeOptions } from './emission.ts';
import sharp from 'sharp';
import { recolorCloudSlices } from './material.ts';
import { compilerSlabMaterial } from '@cssearth/volume-core/materials/slab-material';
import { readVolumeLayerPlan, validateVolumeLayerSlices, type VolumeLayerPlan } from '@cssearth/volume-core/contracts/volume-slices';

function plan(): VolumeLayerPlan {
  return { schema: 'cssearth-volume-layer-plan@1', referenceSliceCounts: { x: 4, y: 4, z: 4 }, referenceSamplesPerSlab: 4,
    axes: { x: [{ startCell: 0, endCell: 1 }, { startCell: 1, endCell: 4 }],
      y: [{ startCell: 0, endCell: 2 }, { startCell: 2, endCell: 4 }],
      z: [{ startCell: 0, endCell: 3 }, { startCell: 3, endCell: 4 }] } };
}

async function fixture(t: { after(fn: () => Promise<void>): void }): Promise<MasterVolumeOptions> {
  const directory = await mkdtemp(join(tmpdir(), 'volume-layer-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { boundsKpc: { min: [-1, -2, -3], max: [2, 2, 3] }, sliceCounts: { x: 3, y: 4, z: 5 },
    samplesPerSlab: 4, exposureGain: .7, masterWidth: 4, masterDirectory: join(directory, 'master'),
    deliveryBanks: [], unitsPerSourceUnit: 7, provenance: { fixture: 'legacy reference before optional layer layouts' }, onProgress() {},
    sampleEmission(x, y, z, out) { out[0] = .1 + (x + 1) / 8; out[1] = .1 + (y + 2) / 9; out[2] = .1 + (z + 3) / 10; } };
}

test('omitted layer layout preserves the original uniform manifest and PNG bytes', async t => {
  const options = await fixture(t), { masters } = await bakeMasterVolumeSlices(options);
  const digest = createHash('sha256').update(await readFile(join(options.masterDirectory, 'volume-slices.json')));
  for (const q of masters.quads) digest.update(await readFile(join(options.masterDirectory, q.texturePath)));
  assert.equal(digest.digest('hex'), 'b41ebde649d79c33e72c79771610b82725b8d91688866727db5f800ea1801fb7');
  assert.equal(masters.quads.length, 12);
});

test('nonuniform intervals retain every reference midpoint and paint the actual integrated color', async t => {
  const options = await fixture(t), zSamples: number[] = [];
  Object.assign(options, { boundsKpc: { min: [0, 0, 0], max: [4, 4, 4] }, sliceCounts: { x: 2, y: 2, z: 2 },
    layerPlan: plan(), masterWidth: 2, unitsPerSourceUnit: 1, exposureGain: 1 });
  options.sampleEmission = (x, y, z, out) => { out.fill(.25); if (x === 1 && y === 3) zSamples.push(z); };
  const { masters } = await bakeMasterVolumeSlices(options);
  assert.deepEqual(zSamples, Array.from({ length: 16 }, (_, i) => (i + .5) / 4), 'No reference depth sample is dropped or shifted.');
  assert.deepEqual(masters.quads.find(q => q.id === 'z-0')!.slab, { start: 0, end: 3, samples: 12, startCell: 0, endCell: 3 });
  assert.equal(masters.quads.find(q => q.id === 'z-0')!.center[2], 1.5);
  assert.equal(masters.approximation.slabPitchUnits.z, 2, 'Mean pitch is descriptive, not the material integration width.');
  assert.deepEqual(validateVolumeLayerSlices(masters), plan());
  const sample = compilerSlabMaterial((_x, _y, _z, out) => out.fill(.25), (_x, _y, z, out) => {
    out[0] = z < 1 ? 255 : 0; out[1] = 0; out[2] = z < 1 ? 0 : 255; return true;
  });
  const outputDirectory = join(options.masterDirectory, '..', 'painted');
  const { slices } = await recolorCloudSlices({ slices: masters, loadResource: path => readFile(join(options.masterDirectory, path)),
    outputDirectory, sampleImageRgb: sample, preserveMaterialIntensity: true, encoding: { format: 'png' } });
  for (const [id, expected] of [['z-0', [85, 0, 170]], ['z-1', [0, 0, 255]]] as const) {
    const q = slices.quads.find(q => q.id === id)!, original = masters.quads.find(q => q.id === id)!;
    const pixels = await sharp(await readFile(join(outputDirectory, q.texturePath))).raw().toBuffer();
    const neutral = await sharp(await readFile(join(options.masterDirectory, original.texturePath))).raw().toBuffer();
    assert.deepEqual([...pixels.subarray(0, 3)], expected, 'Material follows the true interval, not the mean pitch.');
    assert.equal(pixels[3], neutral[3]);
    assert.deepEqual(q.slab, original.slab);
  }
  const broken = structuredClone(masters);
  delete broken.quads[0]!.slab;
  await assert.rejects(recolorCloudSlices({ slices: broken, loadResource: async () => { throw new Error('Must validate before reading bytes'); },
    outputDirectory, sampleImageRgb: sample }), /slab interval/);
  const changed = structuredClone(masters); changed.quads[0]!.slab!.end += .25;
  assert.throws(() => validateVolumeLayerSlices(changed), /differ from/);
  const unmarked = structuredClone(masters); delete unmarked.approximation.layerPlan;
  assert.throws(() => validateVolumeLayerSlices(unmarked), /require a retained/);
});

test('layer plans reject gaps, overlaps, nonfinite values, excess layers and excessive sample counts', async t => {
  for (const mutate of [
    (p: VolumeLayerPlan) => { p.axes.x = [{ startCell: 1, endCell: 4 }]; },
    (p: VolumeLayerPlan) => { p.axes.x = [{ startCell: 0, endCell: 2 }, { startCell: 1, endCell: 4 }]; },
    (p: VolumeLayerPlan) => { p.axes.x = [{ startCell: 0, endCell: 3 }]; },
    (p: VolumeLayerPlan) => { p.axes.x = [{ startCell: 0, endCell: Infinity }]; },
    (p: VolumeLayerPlan) => { p.referenceSamplesPerSlab = NaN; },
    (p: VolumeLayerPlan) => { p.referenceSliceCounts.x = 512; p.referenceSamplesPerSlab = 16; p.axes.x = [{ startCell: 0, endCell: 512 }]; },
    (p: VolumeLayerPlan) => { for (const axis of ['x', 'y', 'z'] as const) {
      p.referenceSliceCounts[axis] = 200; p.axes[axis] = Array.from({ length: 200 }, (_, i) => ({ startCell: i, endCell: i + 1 })); } },
  ]) { const p = plan(); mutate(p); assert.throws(() => readVolumeLayerPlan(p), TypeError); }
  const bounded = plan(); bounded.referenceSliceCounts.x = 512; bounded.referenceSamplesPerSlab = 8;
  bounded.axes.x = [{ startCell: 0, endCell: 512 }];
  assert.equal(readVolumeLayerPlan(bounded).axes.x.length, 1, '4096 samples remain a valid bounded full-axis merge.');
  const options = await fixture(t); options.layerPlan = plan();
  await assert.rejects(bakeMasterVolumeSlices(options), /must match/);
  options.sliceCounts = { x: 2, y: 2, z: 2 }; options.unitsPerSourceUnit = Number.MAX_VALUE;
  await assert.rejects(bakeMasterVolumeSlices(options), /physical intervals/);
});
