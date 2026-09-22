/** Read-only validation of a complete bake, including its native and delivered artifacts. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readRecipe } from './config.ts';
import { deliveryReady } from './delivery.ts';
import { hash, json, localPath, pinned } from './io.ts';
import { readPreparedReconstruction } from '../../services/density-reconstruction.ts';

export async function verifyArtifacts(root: string, directory: string, artifacts: Record<string, {sha256: string; bytes?: number}>) {
  assert.ok(Object.keys(artifacts).length, 'The artifact manifest is empty.');
  for (const [path, pin] of Object.entries(artifacts)) {
    const bytes = await pinned(root, { path: `${directory}/${path}` });
    if (pin.bytes !== undefined) assert.equal(bytes.length, pin.bytes, `Artifact size differs: ${path}`);
  }
}

export async function verifyNebulaBake(root: string, recipePath = 'labs/nebula/models/lmc/bake.json') {
  const recipe = await readRecipe(root, localPath(root, recipePath));
  const receipt = await json(resolve(root, `.local/nebula-lab/bakes/${recipe.id}-all.json`));
  assert.equal(receipt.schema, 'cssearth-nebula-bake-receipt@1');
  assert.equal(receipt.stage, 'all');
  assert.equal(receipt.recipe.sha256, hash(await readFile(localPath(root, recipePath))), 'Bake receipt belongs to a different recipe; run the full bake.');
  assert.deepEqual(receipt.images.map((image: any) => image.imageId), recipe.images.map(image => image.imageId));
  let densitySlices = 0;
  for (const directory of recipe.densityObjects) {
    const slices = await json(resolve(root, directory, 'prepared/volume-slices.json'));
    for (const quad of slices.quads) {
      await pinned(root, { path: `${directory}/prepared/${quad.texturePath}` });
      densitySlices++;
    }
  }
  const catalogue = await json(resolve(root, recipe.catalogue.path));
  let previews = 0;
  for (const target of catalogue.targets) {
    const overlays = await json(resolve(root, target.directory, 'overlays.json'));
    for (const input of target.images.filter((image: any) => recipe.images.some(selected => selected.imageId === image.id))) {
      await pinned(root, input);
      const overlay = overlays.overlays.find((image: any) => image.id === input.id);
      assert.ok(overlay, `Missing image registration: ${input.id}`);
      await pinned(root, { path: `${target.directory}/${overlay.texturePath}` });
      previews++;
    }
  }
  if (recipe.starCalibration) {
    const calibration = await json(resolve(root, recipe.starCalibration.path));
    if (calibration.depthModel?.target) await pinned(root, calibration.depthModel.target);
  }
  const separation = await json(resolve(root, dirname(recipe.separationPlan.path), 'variants.json'));
  let separationPreviews = 0;
  for (const image of recipe.images) {
    const variant = separation.variants.find((entry: any) => entry.imageId === image.imageId);
    assert.ok(variant, `Missing extraction previews: ${image.imageId}`);
    for (const layer of variant.layers) {
      await pinned(root, { path: layer.texturePath });
      separationPreviews++;
    }
  }
  const sourceStars = await json(resolve(root, recipe.stars.path));
  let sharedStars: unknown, cloudSlices = 0;
  for (const [index, row] of receipt.images.entries()) {
    const accepted = recipe.images[index]!;
    assert.match(row.removalResultId, /^[a-f0-9]{64}\.[a-f0-9]{64}$/);
    const [removalKey, removalHash] = row.removalResultId.split('.');
    const removalDirectory = `.local/nebula-lab/star-removal-nox-applied/${removalKey}`;
    const removal = JSON.parse((await pinned(root, { path: `${removalDirectory}/result.json` })).toString());
    assert.equal(removal.operation, 'apply');
    const check = removal.applied.verification;
    assert.equal(check.maximumReconstructionErrorCodeValues, 0);
    assert.equal(check.changedPixelsOutsideMask, 0);
    assert.equal(check.encodedRoundTripExact, true);
    assert.equal(check.coverageComplete, true);
    await verifyArtifacts(root, removalDirectory, Object.fromEntries(Object.entries(removal.artifactSha256)
      .map(([path, sha256]) => [path, { sha256: sha256 as string }])));
    const result = await readPreparedReconstruction(root, row.resultId);
    assert.equal(result.imageId, accepted.imageId);
    assert.equal(result.removalResultId, row.removalResultId);
    assert.deepEqual(result.placement, accepted.placement);
    assert.deepEqual(result.appearance, accepted.appearance);
    const manifest = await json(resolve(root, result.subject.directory, 'manifest.json'));
    await verifyArtifacts(root, result.subject.directory, manifest.artifacts);
    const reference = await json(resolve(root, result.subject.density!.directory, 'prepared/volume-slices.json'));
    const painted = await json(resolve(root, result.subject.directory, 'prepared/volume-slices.json'));
    const geometry = (quad: any) => { const {sha256: _hash, bytes: _bytes, ...shape} = quad; return shape; };
    assert.deepEqual(painted.quads.map(geometry), reference.quads.map(geometry), 'Painted cloud geometry differs from the density reference.');
    cloudSlices += painted.quads.length;
    assert.ok(result.subject.stars, 'Reconstruction is missing its catalogue.');
    const stars = await json(localPath(root, result.subject.stars));
    assert.equal(stars.stars.length, sourceStars.stars.length);
    if (sharedStars) assert.deepEqual(stars.stars, sharedStars, 'Image variants moved the shared stars.');
    else sharedStars = stars.stars;
    console.log(`VERIFIED ${accepted.imageId}: native removal, ${painted.quads.length} slices, ${stars.stars.length} shared stars`);
  }
  assert.ok(receipt.output, 'The bake did not assemble a lens bank.');
  const bank = await json(localPath(root, `${receipt.output}/source/lens-manifest.json`));
  await verifyArtifacts(root, receipt.output, bank.outputs);
  if (recipe.delivery) assert.ok(await deliveryReady(root, recipe.delivery), 'Application textures are missing; run the bake.');
  const result = { schema: 'cssearth-nebula-verification@1', recipe: receipt.recipe,
    images: receipt.images.length, densitySlices, previews, separationPreviews, cloudSlices, sharedStars: sourceStars.stars.length };
  console.log(`NEBULA_VERIFIED ${JSON.stringify(result)}`);
  return result;
}
