import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { bakeMasterVolumeSlices } from '@cssearth/volume-bake/slices/emission';
import { compilerAlphaDigest } from '@cssearth/volume-bake/compiler/bake';
import { compilerFrame, compilerPreparedSlices } from '@cssearth/volume-core/coordinates/compiler-frame';
import { readCompilerBakeResult, type CompilerPin } from '@cssearth/volume-core/contracts/compiler-bake';
import { validateVolumeLayerSlices, type VolumeLayerPlan } from '@cssearth/volume-core/contracts/volume-slices';
import { sha256, sourceBytes } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { registerComponentBanks } from '@cssearth/volume-bake/compiler/component-layout';
import { compileCssVolume } from '../../../adapters/preparation/css-volume.ts';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const root = await mkdtemp(join(tmpdir(), 'registered-empty-layers-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const boundsArcsec = { min: [-2, -2, -2] as [number, number, number], max: [2, 2, 2] as [number, number, number] };
  const { frame, localBounds, origin } = compilerFrame(boundsArcsec, true);
  const groups = () => [{ startCell: 0, endCell: 1 }, { startCell: 1, endCell: 3 }, { startCell: 3, endCell: 4 }];
  const layerPlan: VolumeLayerPlan = { schema: 'cssearth-volume-layer-plan@1', referenceSliceCounts: { x: 4, y: 4, z: 4 },
    referenceSamplesPerSlab: 4, axes: { x: groups(), y: groups(), z: groups() } };
  const { banks } = await bakeMasterVolumeSlices({ boundsKpc: localBounds, sliceCounts: { x: 3, y: 3, z: 3 }, samplesPerSlab: 4, layerPlan,
    exposureGain: 1, masterWidth: 8, masterDirectory: join(root, 'masters'), unitsPerSourceUnit: 1, provenance: {}, cropTransparent: true,
    deliveryBanks: [{ width: 8, outputDirectory: join(root, 'neutral'), imageEncoding: { format: 'png' } }],
    sampleEmission(x, y, z, out) { out.fill(Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) < .6 ? .2 : 0); }, onProgress() {} });
  const slices = banks[0]!.slices, fieldIdentity = 'a'.repeat(64), alphaSha256 = await compilerAlphaDigest(join(root, 'neutral'), slices);
  slices.provenance = { fieldIdentity, alphaSha256 };
  await writeFile(join(root, 'neutral/volume-slices.json'), JSON.stringify(slices));
  const volume = compileCssVolume({ id: 'compiler-empty-layers', frame, slices: compilerPreparedSlices(slices), recipe: { anchors: [] } });
  const bytes = Buffer.from(JSON.stringify(volume));
  await writeFile(join(root, 'neutral/volume.json'), bytes);
  const neutral: CompilerPin = { path: 'neutral/volume.json' };
  const scene = readCompilerBakeResult({ schema: 'cssearth-compiler-bake@1', id: 'empty-layers', fieldIdentity, frame, boundsArcsec,
    skyBoundsArcsec: { min: [-2, -2], max: [2, 2] }, spanArcsec: 4, sourceImage: { width: 512, height: 512 },
    coordinates: { axes: ['west', 'north', 'away'], localOriginArcsec: origin, earthView: 'observer-at-negative-z-looking-away' }, neutral, alphaSha256,
    stars: [], lenses: [{ id: 'optical', label: 'Optical', volume: neutral, coverage: { positiveAlphaTexels: 12, recoloredTexels: 12, outsideImageTexels: 0 } }],
    sampling: { sliceCounts: { x: 3, y: 3, z: 3 }, imageWidth: 512, samplesPerSlab: 4, layerPlan } });
  const readPinned = (pin: CompilerPin) => sourceBytes(root, pin);
  return { root, scene, slices, readPinned };
}

test('registration preserves the full planned partition until compilation prunes truly empty slabs', async t => {
  const { root, scene, slices, readPinned } = await fixture(t), empty = slices.quads.filter(q => q.alphaCoverage === 0);
  assert.equal(empty.length, 6);
  let compiled = 0;
  const result = await registerComponentBanks(root, 'registered', scene, scene.lenses, new AbortController().signal, readPinned, {
    compileVolume(input) {
      compiled++;
      assert.equal(input.slices.quads.length, 9);
      assert.ok(validateVolumeLayerSlices(input.slices));
      assert.deepEqual(input.slices.quads.filter(q => q.alphaCoverage === 0).map(q => q.id).sort(), empty.map(q => q.id).sort());
      return compileCssVolume({ ...input, recipe: { anchors: [] } });
    }, validateVolume: validatePreparedCssVolume,
  });
  assert.equal(compiled, 1);
  for (const pin of [result.neutral, result.lenses[0]!.volume]) {
    const volume = validatePreparedCssVolume(JSON.parse((await readPinned(pin)).toString()));
    assert.equal(volume.resources.length, 3, 'Empty preparation-only quads must never create runtime resources.');
    assert.deepEqual(volume.stacks.flatMap(s => s.leaves.map(q => q.id)).sort(), ['x-1', 'y-1', 'z-1']);
    assert.ok(volume.resources.every(r => !empty.some(q => q.texturePath === r.path)));
  }
});

test('component registration rejects catalogue intervals that disagree with the actual retained plan', async t => {
  const { root, scene, slices, readPinned } = await fixture(t);
  slices.quads[0]!.slab!.end += .125;
  await writeFile(join(root, 'neutral/volume-slices.json'), JSON.stringify(slices));
  await assert.rejects(registerComponentBanks(root, 'registered', scene, scene.lenses, new AbortController().signal, readPinned, {
    compileVolume() { throw new Error('Invalid catalogue must fail before compile'); }, validateVolume: validatePreparedCssVolume,
  }), /Physical slab interval/);
});

test('an allegedly pruned slab with real opacity cannot be reintroduced as transparent metadata', async t => {
  const { root, scene, slices, readPinned } = await fixture(t), q = slices.quads.find(q => q.alphaCoverage === 0)!;
  const pixels = Buffer.alloc(q.widthPx * q.heightPx * 4); pixels[3] = 255;
  const bytes = await sharp(pixels, { raw: { width: q.widthPx, height: q.heightPx, channels: 4 } }).png().toBuffer();
  await writeFile(join(root, 'neutral', q.texturePath), bytes); q.sha256 = sha256(bytes); q.bytes = bytes.length;
  await writeFile(join(root, 'neutral/volume-slices.json'), JSON.stringify(slices));
  await assert.rejects(registerComponentBanks(root, 'registered', scene, scene.lenses, new AbortController().signal, readPinned, {
    compileVolume() { throw new Error('Nontransparent omitted slab must fail before compile'); }, validateVolume: validatePreparedCssVolume,
  }), /omitted.*opacity/i);
});
