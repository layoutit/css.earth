import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { parseVolumeRecipe } from '@cssearth/volume-core/contracts/volume-recipe';
import { prepareVolumeSlices, type VolumeSlices } from '@cssearth/volume-bake/slices/density';
import { acquire, hash, json, pinned } from './io.ts';
import { writeAtomic } from '@cssearth/volume-bake/compact-inputs/io';

/** Replay the pinned geometry, without changing its scientific descriptor or catalogue reference. */
export async function bakeDensity(root: string, directory: string) {
  const object = await json(resolve(root, directory, 'object.json'));
  const recipePath = `${directory}/${object.properties.preparation.source}`;
  const recipe = parseVolumeRecipe(JSON.parse((await pinned(root, { path: recipePath })).toString()));
  const prepared = resolve(root, directory, 'prepared'), expected = await json(join(prepared, 'volume-slices.json')) as VolumeSlices;
  await pinned(dirname(resolve(root, recipePath)), recipe.grid);
  await pinned(dirname(resolve(root, recipePath)), recipe.provenance);
  let complete = true;
  for (const quad of expected.quads) {
    try { await pinned(prepared, { path: quad.texturePath }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; complete = false; }
  }
  if (complete) { console.log(`DENSITY_CACHED ${directory}: ${expected.quads.length} verified slices`); return; }
  const temporary = await mkdtemp(join(tmpdir(), 'nebula-density-'));
  try {
    const baked = await prepareVolumeSlices({ sourceDirectory: dirname(resolve(root, recipePath)), outputDirectory: temporary, recipe });
    assert.deepEqual(baked.quads, expected.quads, 'Density bake changed accepted geometry or pixels; review the recipe before replacing it.');
    assert.deepEqual(baked.boundsUnits, expected.boundsUnits);
    for (const quad of baked.quads) await writeAtomic(join(prepared, quad.texturePath), await pinned(temporary, { path: quad.texturePath }));
    console.log(`DENSITY_READY ${directory}: ${baked.quads.length} verified slices`);
  } finally { await rm(temporary, { recursive: true, force: true }); }
}
/** Preview pixels are rebuilt from native originals. Existing accepted registration stays immutable. */
export async function bakePreviews(root: string, catalogue: any, ids: string[]) {
  for (const target of catalogue.targets) {
    const overlays = await json(resolve(root, target.directory, 'overlays.json'));
    for (const input of target.images.filter((image: any) => ids.includes(image.id))) {
      await acquire(root, input);
      const original = await pinned(root, input), overlay = overlays.overlays.find((image: any) => image.id === input.id);
      assert.ok(overlay, `Missing accepted image registration: ${input.id}`);
      try {
        await pinned(root, { path: `${target.directory}/${overlay.texturePath}` });
        console.log(`IMAGE_CACHED ${input.id}`); continue;
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      console.log(`IMAGE_BAKE ${input.id}: preparing native-image preview`);
      const maximum = input.maxPixels ?? catalogue.maxPixels;
      const pixels = await sharp(original, { unlimited: input.allowLargeTiff === true }).toColourspace('srgb')
        .resize({ width: maximum, height: maximum, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 92, alphaQuality: 100, effort: 5 }).toBuffer();
      assert.equal(hash(pixels), overlay.sha256, `Preview replay differs: ${input.id}`);
      await writeAtomic(resolve(root, target.directory, overlay.texturePath), pixels);
      console.log(`IMAGE_READY ${input.id}`);
    }
  }
}

export async function bakeSeparationPreviews(root: string, planPath: string, imageId: string) {
  const plan = await json(resolve(root, planPath)), selection = plan.selections.find((item: any) => item.id === imageId);
  const recipe = JSON.parse((await pinned(root, { path: selection.recipe })).toString());
  const receipt = await json(resolve(root, recipe.outputDirectory, 'receipt.json'));
  const variants = await json(resolve(root, 'labs/nebula/models/lmc/star-separation/variants.json'));
  const variant = variants.variants.find((item: any) => item.imageId === imageId);
  assert.ok(variant, `Missing accepted separation preview: ${imageId}`);
  for (const layer of variant.layers) {
    try {
      await pinned(root, { path: layer.texturePath });
      continue;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const file = layer.id === 'diffuse' ? 'diffuse.png' : 'stars.png';
    const original = await pinned(root, { path: `${recipe.outputDirectory}/${file}` });
    const maximum = Math.max(layer.widthPx, layer.heightPx);
    const pixels = await sharp(original, { unlimited: true }).toColourspace('srgb')
      .resize({ width: maximum, height: maximum, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 92, alphaQuality: 100, effort: 5 }).toBuffer();
    assert.equal(hash(pixels), layer.sha256, `Separation preview replay differs: ${imageId}/${layer.id}`);
    await writeAtomic(resolve(root, layer.texturePath), pixels);
  }
}
