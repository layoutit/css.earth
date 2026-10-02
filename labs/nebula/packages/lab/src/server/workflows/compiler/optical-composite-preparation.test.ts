import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { compileCssVolume } from '../../../adapters/preparation/css-volume.ts';
import { validatePreparedCssVolume, readRetainedEmissionField } from '@cssearth/objects';
import { readObservationRecipe } from '../../../features/observations/recipe.ts';
import { readGeometryPin } from '../geometry/registered-source.ts';
import { bakeMasterVolumeSlices } from '@cssearth/bake/volume/node';
import { jointRecord } from '../../../features/joint-fit/model.ts';
import { compilerFrame } from './bake.ts';
import { assertCompilerDatasetGeometry } from './bank-validation.ts';
import { readCompilerRecipe, defaultCompilerControls } from '../../../features/compiler/model.ts';
import { readCompilerResult } from '../../../features/compiler/result.ts';
import { createEmissionField } from '@cssearth/bake/volume';
import { opticalCompositeSourcePins, restoreOpticalCompositeSources } from './optical-composite-inputs.ts';
import { prepareOpticalComposite, prepareOpticalCompositeForResult, readOpticalCompositeRecipe } from './optical-composite-preparation.ts';

async function fixture(t: TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'optical-composite-delivery-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const put = async (path: string, bytes: Uint8Array) => {
    await mkdir(dirname(join(root, path)), { recursive: true }); await writeFile(join(root, path), bytes);
    return { path };
  };
  const save = (path: string, value: unknown) => put(path, Buffer.from(JSON.stringify(value)));
  const recipePath = 'labs/nebula/models/m45/optical-composite.json';
  const recipe = readOpticalCompositeRecipe(JSON.parse(await readFile(recipePath, 'utf8')));
  const compilerBytes = await readFile(recipe.compilerRecipe), compiler = readCompilerRecipe(JSON.parse(compilerBytes.toString()));
  await put(recipe.compilerRecipe, compilerBytes);
  for (const path of [compiler.observationRecipe, compiler.observationCatalogue, compiler.structureRecipe, compiler.structureCatalogue, compiler.observedStars!.path])
    await save(path, {});
  for (const path of [compiler.depthRecipe!, 'labs/nebula/models/m45/physical-evidence.json']) await put(path, await readFile(path));
  const native = Buffer.alloc(32 * 32 * 3);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const at = (y * 32 + x) * 3; native[at] = 50 + x * 3; native[at + 1] = 60 + y * 3; native[at + 2] = 70 + x + y;
  }
  const png = await sharp(native, { raw: { width: 32, height: 32, channels: 3 } }).png().toBuffer();
  const zero = await sharp(Buffer.alloc(native.length), { raw: { width: 32, height: 32, channels: 3 } }).png().toBuffer();
  const originalRecipe = readObservationRecipe(JSON.parse(await readFile(recipe.observationRecipe, 'utf8')));
  const observationRecipe = { ...originalRecipe, nativeSeparationCache: undefined,
    frame: { ...originalRecipe.frame, width: 32, height: 32, fieldArcminutes: [1, 1] },
    images: originalRecipe.images.map(image => ({ ...image, width: 32, height: 32 })) };
  await save(recipe.observationRecipe, observationRecipe); const images = [];
  for (const image of observationRecipe.images) {
    const directory = `.local/nebula-lab/observations/${originalRecipe.id}/${image.id}/native-nox`;
    const source = await put(`${directory}/source.png`, png), diffuse = await put(`${directory}/diffuse.png`, png), stars = await put(`${directory}/stars.png`, zero);
    await save(`${directory}/result.json`, { schema: 'cssearth-nox-output@1', nativeDimensions: [32, 32],
      applied: { verification: { coverageComplete: true, maximumReconstructionErrorCodeValues: 0 } } });
    images.push({ id: image.id, label: image.label, source: { ...image, path: source.path },
      layers: { original: { ...source, width: 32, height: 32 }, diffuse: { ...diffuse, width: 32, height: 32 }, stars: { ...stars, width: 32, height: 32 } },
      imageToFrame: [1, 0, 0, 1, 0, 0], registration: { status: 'verified', matchedStars: 30, rmsPixels: .1, maxResidualPixels: .2 },
      removal: { settings: { ...observationRecipe.nativeRemoval, directory } } });
  }
  const catalogue = { schema: 'cssearth-nebula-observations@1', id: originalRecipe.id, frame: observationRecipe.frame, images,
    provenance: { recipe: structuredClone(observationRecipe) } };
  await save(recipe.observationCatalogue, catalogue);
  await save(recipePath, { ...recipe, featherArcsec: 3, lowFrequencyArcsec: 1 });
  const id = compiler.id, directory = `.local/nebula-lab/compiler/${id}`, fieldIdentity = compiler.id;
  const model = readRetainedEmissionField({ schema: 'cssearth-conditional-emission-field@1', identity: fieldIdentity,
    controls: defaultCompilerControls, bounds: { min: [-20, -20, -20], max: [20, 20, 20] }, components: [
      { id: 'finite-emitter', basisId: 'fixture', center: [0, 0, 0], sigma: [5, 5, 5], angleRadians: 0,
        projectedWeight: 10, depthAssignment: 'halo-diffuse', velocityCovered: false } ] });
  const field = createEmissionField(model), { frame, localBounds, origin } = compilerFrame(model.bounds);
  const neutralDirectory = `${directory}/scene/neutral`;
  const baked = await bakeMasterVolumeSlices({ boundsKpc: localBounds, sliceCounts: { x: 2, y: 2, z: 2 }, samplesPerSlab: 4,
    exposureGain: 1, masterWidth: 8, masterDirectory: join(root, directory, 'masters'), deliveryBanks: [
      { width: 8, outputDirectory: join(root, neutralDirectory), imageEncoding: { format: 'png' } } ], unitsPerSourceUnit: 1,
    provenance: {}, cropTransparent: true, sampleEmission: field.sampleEmission, onProgress() {} });
  const slices = baked.banks[0]!.slices;
  slices.provenance = { fieldIdentity };
  const neutral = await save(`${neutralDirectory}/volume.json`, compileCssVolume({ id: `compiler-${id}`, frame, slices, recipe: { anchors: [] } }));
  const neutralSlices = await save(`${neutralDirectory}/volume-slices.json`, slices), bounds = { min: [-30, -30], max: [30, 30] };
  const image = images[0]!, source = image.layers.original, starMaterial = { rgb: [90, 110, 140], diameterUnits: 1, alpha: .5 };
  const request = { action: 'apply', imageId: 'compiler', recipePath: recipe.compilerRecipe, cataloguePath: compiler.structureCatalogue,
    imageToFrame: {}, evidence: { sensitivity: 1, weights: [] }, controls: defaultCompilerControls };
  const result = readCompilerResult({ schema: 'cssearth-nebula-compiler-result@1', id, label: 'Fixture', defaultSourceId: image.id,
    controls: defaultCompilerControls, pipeline: [], metrics: { components: 1, unconstrainedComponents: 1, stars: 1,
      fitRmse: .1, baselineRmse: .2, missingSignalFraction: .1, excessSignalFraction: .1 }, interpretation: 'Test finite emitter',
    model: await save(`${directory}/field.json`, model),
    method: await save(`${directory}/method.json`, { request, recipe: compiler, recipePath: recipe.compilerRecipe,
      physicalDepth: { recipe: await put(`${directory}/depth-recipe.json`, await readFile(compiler.depthRecipe!)),
        evidence: await put(`${directory}/physical-evidence.json`, await readFile('labs/nebula/models/m45/physical-evidence.json')) } }),
    target: source, projection: source, residual: source,
    sources: [{ id: image.id, label: image.label, credit: image.source.credit, page: image.source.page,
      original: source, starless: image.layers.diffuse, width: 32, height: 32, boundsArcsec: bounds }],
    scene: { schema: 'cssearth-compiler-bake@2', id, fieldIdentity, frame, boundsArcsec: model.bounds, skyBoundsArcsec: bounds,
      spanArcsec: 60, sourceImage: { width: 512, height: 512 }, neutral,
      coordinates: { axes: ['west', 'north', 'away'], localOriginArcsec: origin, earthView: 'observer-at-negative-z-looking-away' },
      datasets: [{ id: image.id, label: image.label, volume: neutral, coverage: { positiveAlphaTexels: 0, recoloredTexels: 0, outsideImageTexels: 0 } }],
      stars: [{ id: 'retained-star', positionUnits: [1, 2, 3], ...starMaterial, materials: { [image.id]: starMaterial } }],
      sampling: { sliceCounts: { x: 2, y: 2, z: 2 }, imageWidth: 512, samplesPerSlab: 4 } } });
  return { root, recipePath, recipe, result, neutralSlices, slices, save, catalogue };
}

test('delivery composites a supplied result with no historical caches and retains geometry, alpha and stars', async t => {
  const f = await fixture(t), publicationPath = '.local/nebula-lab/compiler-published/m45.json';
  const publication = await f.save(publicationPath, { retained: 'live user publication' });
  const before = JSON.stringify(f.result), output = await prepareOpticalCompositeForResult(f.root, f.recipePath, f.result);
  assert.equal(JSON.stringify(f.result), before);
  assert.equal(output.scene.neutral.path, f.result.scene.neutral.path);
  assert.equal(output.scene.volumeId, f.result.id); assert.equal(output.scene.datasets.length, 2);
  assert.deepEqual(output.scene.stars[0], { ...f.result.scene.stars[0], materials: { ...f.result.scene.stars[0]!.materials,
    [f.recipe.id]: f.result.scene.stars[0]!.materials![f.recipe.detailSourceId] } });
  const dataset = output.scene.datasets[1]!;
  assertCompilerDatasetGeometry(validatePreparedCssVolume(JSON.parse((await readGeometryPin(f.root, output.scene.neutral)).toString())),
    validatePreparedCssVolume(JSON.parse((await readGeometryPin(f.root, dataset.volume)).toString())), output.scene);
  for (const slice of f.slices.quads) {
    const alpha = async (path: string) => (await sharp(join(f.root, path, slice.texturePath)).ensureAlpha().raw().toBuffer()).filter((_v, i) => i % 4 === 3);
    assert.deepEqual(await alpha(dirname(dataset.volume.path)), await alpha(dirname(output.scene.neutral.path)));
  }
  const method: unknown = JSON.parse((await readGeometryPin(f.root, output.method)).toString());
  assert.ok(jointRecord(method) && jointRecord(method.opticalComposite));
  assert.ok(jointRecord(method.opticalComposite.neutralSlices)); assert.equal(method.opticalComposite.neutralSlices.path, f.neutralSlices.path);
  assert.ok(Array.isArray(method.opticalComposite.inputs) && method.opticalComposite.inputs.some(pin => jointRecord(pin) &&
    typeof pin.path === 'string' && pin.path.endsWith('/native-nox/result.json')));
  await readGeometryPin(f.root, publication);
  assert.deepEqual(await prepareOpticalCompositeForResult(f.root, f.recipePath, f.result), output);
  await assert.rejects(prepareOpticalComposite(f.root, f.recipePath, true), /ENOENT/, 'Standalone recipe still requires its historical cloud.');
});

test('composite source readiness distinguishes missing native input from changed evidence and restores through the source owner', async t => {
  const f = await fixture(t);
  assert.ok(await opticalCompositeSourcePins(f.root, f.recipe));
  const source = f.catalogue.images[0]!.layers.diffuse;
  const original = await readFile(join(f.root, source.path));
  await rm(join(f.root, source.path)); assert.equal(await opticalCompositeSourcePins(f.root, f.recipe), undefined);
  await writeFile(join(f.root, source.path), original);
  const originalCatalogue = structuredClone(f.catalogue);
  f.catalogue.images[0]!.removal.settings.model.path = '.local/open-star-removal/other-model.pth';
  await f.save(f.recipe.observationCatalogue, f.catalogue);
  await assert.rejects(opticalCompositeSourcePins(f.root, f.recipe), /configured NOX model or code/);
  Object.assign(f.catalogue, originalCatalogue);
  await f.save('saved-catalogue.json', f.catalogue); await rm(join(f.root, f.recipe.observationCatalogue));
  await mkdir(join(f.root, 'labs/nebula/src'), { recursive: true });
  await writeFile(join(f.root, 'labs/nebula/run.mts'), `import { copyFile } from 'node:fs/promises';
    await copyFile('saved-catalogue.json', ${JSON.stringify(f.recipe.observationCatalogue)});
    console.log('NEBULA_OBSERVATIONS_COMPLETE');`);
  const messages: string[] = [];
  assert.ok((await restoreOpticalCompositeSources(f.root, f.recipe, new AbortController().signal, message => messages.push(message))).length >= 10);
  assert.ok(messages.some(message => message.includes('NEBULA_OBSERVATIONS_COMPLETE')));
  await rm(join(f.root, f.recipe.observationCatalogue));
  await writeFile(join(f.root, 'labs/nebula/run.mts'), 'process.exitCode = 0;');
  await assert.rejects(restoreOpticalCompositeSources(f.root, f.recipe, new AbortController().signal, () => {}), /completion receipt/);
});
