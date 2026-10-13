import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseVolumeRecipe } from './volume-recipe.ts';

test('a recipe may give an axis no slabs, but not every axis', () => {
  // A thin disc drawn as sheets: slabs across its thickness only.
  const recipe = JSON.parse(readFileSync('src/objects/hl-tauri-disc/source/volume-dust.json', 'utf8')) as { bake: Record<string, unknown> };
  const counts = (sliceCounts: unknown) => parseVolumeRecipe({ ...recipe, bake: { ...recipe.bake, sliceCounts } }).bake.sliceCounts;
  assert.deepEqual(parseVolumeRecipe(recipe).bake.sliceCounts, { x: 0, y: 0, z: 9 });
  assert.deepEqual(counts({ x: 2, y: 0, z: 3 }), { x: 2, y: 0, z: 3 });
  assert.throws(() => counts({ x: 0, y: 0, z: 0 }), /sliceCounts must give one axis slabs/u);
  assert.throws(() => counts({ x: 0, y: -1, z: 9 }), /y count must be positive integer/u);
  assert.throws(() => counts({ x: 0, y: 1.5, z: 9 }), /y count must be positive integer/u);
});
