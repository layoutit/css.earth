import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { readObservationRecipe } from '../../../features/observations/recipe.js';
import { loadNativeSeparationCache, nativeSeparationCacheSource, nativeSeparationCacheDirectory } from './native-separation-cache.js';

const intake = async () => readObservationRecipe(JSON.parse(await readFile('labs/nebula/models/m45/observations.json', 'utf8')));

test('the mixed M45 intake explicitly reuses exactly its four completed native sources', async () => {
  const recipe = await intake();
  assert.ok(recipe.nativeSeparationCache, 'Without a reproducible cache reference the four prepared layer controls regress.');
  const cached = await loadNativeSeparationCache(recipe); assert.ok(cached);
  const reusable = recipe.images.filter(source => nativeSeparationCacheSource(recipe, cached, source));
  assert.deepEqual(reusable.map(image => image.id), ['noirlab-optical', 'spitzer-irac', 'spitzer-irac-mips', 'wise-four-band']);
  for (const source of reusable) assert.equal(nativeSeparationCacheDirectory(recipe, cached, source),
    resolve('.local/nebula-lab/observations/m45-processing', source.id, 'native-nox'));
  assert.equal(nativeSeparationCacheSource(recipe, cached, recipe.images.find(image => image.id === 'iau-usama-widefield')!), undefined);
});

test('reuse rejects changed source bytes, grids, treatment and model/script signatures', async () => {
  const recipe = await intake(), cached = await loadNativeSeparationCache(recipe); assert.ok(cached);
  const source = recipe.images[0]!;
  for (const changed of [{ ...source, width: source.width + 1 }, { ...source, stellarTreatment: 'preserve' as const }])
    assert.throws(() => nativeSeparationCacheSource(recipe, cached, changed), /original, native grid or stellar treatment differs/);
  const badModel = structuredClone(cached); badModel.nativeRemoval.model.path = '.local/open-star-removal/other.pth';
  assert.throws(() => nativeSeparationCacheSource(recipe, badModel, source), /model\/script signature differs/);
});

test('cache recipes require immutable pins and bounded repository paths', async () => {
  const recipe = await intake(); assert.ok(recipe.nativeSeparationCache);
  const raw = JSON.parse(await readFile('labs/nebula/models/m45/observations.json', 'utf8'));
  raw.nativeSeparationCache.recipe.path = '../outside.json';
  assert.throws(() => readObservationRecipe(raw), /repository-relative recipe/);
});
