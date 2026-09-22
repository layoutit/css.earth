import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import sharp from 'sharp';
import { sha256, sourceBytes } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { compileCssVolume } from '../../../adapters/preparation/css-volume.ts';
import { validatePreparedCssVolume } from '../../../adapters/renderer/volume-validation.ts';
import { bakeMasterVolumeSlices } from '@cssearth/volume-bake/slices/emission';
import { compilerAlphaDigest, compilerFrame } from './bake.ts';
import { readCompilerBakeResult } from '@cssearth/volume-core/contracts/compiler-bake';
import { assertCompilerLensGeometry } from './bank-validation.ts';
import { prepareRetainedMaterialBank, type RetainedMaterialBankOptions } from './retained-material-bank.ts';

async function fixture(t: TestContext, variable = false) {
  const root = await mkdtemp(join(tmpdir(), 'retained-material-')); t.after(() => rm(root, { recursive: true, force: true }));
  const boundsArcsec = { min: [10, 20, 30] as [number, number, number], max: [12, 22, 32] as [number, number, number] };
  const { frame, localBounds, origin } = compilerFrame(boundsArcsec), fieldIdentity = 'a'.repeat(64);
  const layerPlan = variable ? { schema: 'cssearth-volume-layer-plan@1' as const,
    referenceSliceCounts: { x: 4, y: 4, z: 4 }, referenceSamplesPerSlab: 4,
    axes: { x: [{ startCell: 0, endCell: 1 }, { startCell: 1, endCell: 4 }],
      y: [{ startCell: 0, endCell: 2 }, { startCell: 2, endCell: 4 }],
      z: [{ startCell: 0, endCell: 3 }, { startCell: 3, endCell: 4 }] } } : undefined;
  const baked = await bakeMasterVolumeSlices({ boundsKpc: localBounds, sliceCounts: { x: 2, y: 2, z: 2 }, samplesPerSlab: 4,
    ...(layerPlan ? { layerPlan } : {}),
    exposureGain: 1, masterWidth: 8, masterDirectory: join(root, 'masters'), deliveryBanks: [
      { width: 8, outputDirectory: join(root, 'neutral'), imageEncoding: { format: 'png' } }], unitsPerSourceUnit: 1,
    provenance: {}, cropTransparent: true, sampleEmission(x, y, z, out) { out[0] = out[1] = out[2] = Math.hypot(x, y, z) < .9 ? .2 : 0; },
    onProgress() {} });
  const slices = baked.banks[0]!.slices, alphaSha256 = await compilerAlphaDigest(join(root, 'neutral'), slices);
  slices.provenance = { fieldIdentity, alphaSha256 };
  async function pin(path: string, value: unknown) {
    const bytes = Buffer.from(JSON.stringify(value) + '\n'); await writeFile(join(root, path), bytes); return { path, sha256: sha256(bytes) };
  }
  const neutral = await pin('neutral/volume.json', compileCssVolume({ id: 'compiler-fixture', frame, slices, recipe: { anchors: [] } }));
  const scene = readCompilerBakeResult({ schema: 'cssearth-compiler-bake@1', id: 'fixture', fieldIdentity, frame, boundsArcsec,
    skyBoundsArcsec: { min: [10, 20], max: [12, 22] }, spanArcsec: 2, sourceImage: { width: 512, height: 512 },
    coordinates: { axes: ['west', 'north', 'away'], localOriginArcsec: origin, earthView: 'observer-at-negative-z-looking-away' },
    neutral, alphaSha256, lenses: [{ id: 'original', label: 'Original', volume: neutral,
      coverage: { positiveAlphaTexels: 0, recoloredTexels: 0, outsideImageTexels: 0 } }], stars: [],
    sampling: { sliceCounts: { x: 2, y: 2, z: 2 }, imageWidth: 512, samplesPerSlab: 4, ...(layerPlan ? { layerPlan } : {}) } });
  const options: RetainedMaterialBankOptions = { root, outputDirectory: 'painted', scene,
    neutralSlicesPin: await pin('neutral/volume-slices.json', slices),
    sampleEmission(x, y, z, out) { out[0] = out[1] = out[2] = Math.hypot(x - origin[0], y - origin[1], z - origin[2]) < .9 ? .2 : 0; },
    lens: { id: 'new-material', label: 'New material', sampleMaterial(x, y, z, out) {
      assert.ok(x >= 10 && x <= 12 && y >= 20 && y <= 22 && z >= 30 && z <= 32, 'Sampler receives absolute XYZ.');
      out[0] = z < 31 ? 255 : 30; out[1] = 40; out[2] = z < 31 ? 20 : 255; return true;
    } } };
  return { options, slices, pin };
}

test('retained material prepares RGB through the existing slab/compiler path with exact geometry and alpha', async t => {
  const { options, slices } = await fixture(t), sourceHash = sha256(await readFile(join(options.root, options.scene.neutral.path)));
  const lens = await prepareRetainedMaterialBank(options);
  const neutral = validatePreparedCssVolume(JSON.parse((await sourceBytes(options.root, options.scene.neutral)).toString()));
  const painted = validatePreparedCssVolume(JSON.parse((await sourceBytes(options.root, lens.volume)).toString()));
  assertCompilerLensGeometry(neutral, painted, options.scene, {});
  assert.equal(sha256(await readFile(join(options.root, options.scene.neutral.path))), sourceHash);
  assert.ok(lens.coverage.recoloredTexels > 0);
  assert.deepEqual(painted.provenance && Object.getOwnPropertyDescriptor(painted.provenance, 'materialLensId')?.value, lens.id);
  for (const q of slices.quads) {
    const original = await sharp(join(options.root, 'neutral', q.texturePath)).ensureAlpha().raw().toBuffer();
    const colored = await sharp(join(options.root, 'painted', q.texturePath)).ensureAlpha().raw().toBuffer();
    assert.deepEqual(colored.filter((_b, i) => i % 4 === 3), original.filter((_b, i) => i % 4 === 3));
  }
  assert.notEqual(painted.resources[0]!.sha256, neutral.resources[0]!.sha256);
});

test('retained nonuniform material preserves intervals and rejects missing replay metadata', async t => {
  const { options, slices, pin } = await fixture(t, true);
  const lens = await prepareRetainedMaterialBank(options);
  assert.ok(lens.coverage.recoloredTexels > 0);
  const painted = JSON.parse(await readFile(join(options.root, 'painted/volume-slices.json'), 'utf8'));
  assert.deepEqual(painted.approximation.layerPlan, options.scene.sampling.layerPlan);
  assert.deepEqual(painted.quads.map((q: { slab: unknown }) => q.slab), slices.quads.map(q => q.slab));
  for (const mutate of [
    () => { delete slices.quads[0]!.slab; },
    () => { delete slices.approximation.layerPlan; },
    () => { slices.quads[0]!.slab!.samples--; },
  ]) {
    const before = structuredClone(slices); mutate();
    await assert.rejects(prepareRetainedMaterialBank({ ...options, neutralSlicesPin: await pin('neutral/volume-slices.json', slices) }), /slab interval|layer plan|samples differ/);
    Object.assign(slices, before);
  }
});

test('retained material rejects changed pinned alpha, positions and slab metadata', async t => {
  const { options, slices, pin } = await fixture(t);
  await assert.rejects(prepareRetainedMaterialBank({ ...options, scene: { ...options.scene, alphaSha256: 'f'.repeat(64) } }), /alpha support/);
  for (const mutation of [
    () => { slices.quads[0]!.center[0] += .01; },
    () => { slices.quads[0]!.vertices[0][0] = NaN; },
    () => { slices.approximation.slabPitchUnits.z = 0; },
  ]) {
    const original = structuredClone(slices); mutation();
    await assert.rejects(prepareRetainedMaterialBank({ ...options, neutralSlicesPin: await pin('neutral/volume-slices.json', slices) }), /geometry|Invalid retained/);
    Object.assign(slices, original);
  }
  const q = slices.quads[0]!, image = await sharp(join(options.root, 'neutral', q.texturePath)).ensureAlpha().raw().toBuffer();
  image[3] = image[3] === 0 ? 1 : image[3]! - 1;
  const bytes = await sharp(image, { raw: { width: q.widthPx, height: q.heightPx, channels: 4 } }).png().toBuffer();
  await writeFile(join(options.root, 'neutral', q.texturePath), bytes); q.bytes = bytes.length; q.sha256 = sha256(bytes);
  await assert.rejects(prepareRetainedMaterialBank({ ...options, neutralSlicesPin: await pin('neutral/volume-slices.json', slices) }), /changed the shared alpha/);
});

test('retained material rejects missing XYZ and nonfinite sampler results', async t => {
  const { options } = await fixture(t);
  // @ts-expect-error The historical projected-image API must fail at the actual default boundary.
  await assert.rejects(prepareRetainedMaterialBank({ ...options, lens: { id: 'xy', label: 'XY', sampleRgb() { return true; } } }), /3D material sampler/);
  await assert.rejects(prepareRetainedMaterialBank({ ...options, sampleEmission(_x, _y, _z, out) { out.fill(NaN); } }), /finite nonnegative/);
  await assert.rejects(prepareRetainedMaterialBank({ ...options, lens: { ...options.lens, sampleMaterial(_x, _y, _z, out) { out.fill(Infinity); return true; } } }), /finite RGB/);
});
