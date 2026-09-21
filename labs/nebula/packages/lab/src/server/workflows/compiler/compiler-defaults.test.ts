import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compilerControlsForRecipe, compilerSourceWeights, defaultCompilerControls, readCompilerRecipe } from '../../../features/compiler/model.ts';

const source = { schema: 'cssearth-nebula-compiler@1', id: 'example', label: 'Example',
  observationRecipe: 'labs/nebula/models/example/observations.json', observationCatalogue: '.local/nebula-lab/observations/example/observations.json',
  structureRecipe: 'labs/nebula/models/example/structures.json', structureCatalogue: '.local/nebula-lab/observations/example/structures/catalogue.json',
  defaultSourceId: 'optical', maximumStars: 20, interpretation: 'Authored visualization.' };

test('recipe defaults reach unsaved controls while explicit user choices win', () => {
  const recipe = readCompilerRecipe({ ...source, defaultControls: { detail: .9, faint: .15, depth: 1.2 } });
  assert.deepEqual(compilerControlsForRecipe(recipe), { detail: .9, faint: .15, depth: 1.2 });
  assert.deepEqual(compilerControlsForRecipe(recipe, defaultCompilerControls), defaultCompilerControls,
    'An explicit choice equal to the old global default still overrides the recipe.');
  assert.deepEqual(compilerControlsForRecipe(readCompilerRecipe(source)), defaultCompilerControls);
});

test('photometric recipes cannot configure the hidden depth control away from their pinned prior', () => {
  const photometricPriorRecipe = 'labs/nebula/models/example/photometric-mge.json';
  assert.equal(compilerControlsForRecipe(readCompilerRecipe({ ...source, photometricPriorRecipe })).depth, 1);
  assert.throws(() => readCompilerRecipe({ ...source, photometricPriorRecipe,
    defaultControls: { detail: .9, faint: .15, depth: 1.2 } }), /require depth=1/);
});

test('named source weights follow source IDs and explicit diagnostic weights override', () => {
  const recipe = readCompilerRecipe({ ...source, sourceWeights: { optical: 1, infrared: .15 } });
  assert.deepEqual(compilerSourceWeights(recipe, ['infrared', 'optical', 'third']), [.15, 1, 1]);
  assert.deepEqual(compilerSourceWeights(recipe, ['infrared', 'optical'], [1, .6]), [1, .6]);
  assert.deepEqual(compilerSourceWeights(readCompilerRecipe(source), ['infrared', 'optical']), [1, 1]);
  assert.throws(() => compilerSourceWeights(recipe, ['optical']), /unavailable image/);
  assert.throws(() => compilerSourceWeights(recipe, ['optical', 'infrared'], [0, 0]), /Enable at least/);
});

test('invalid authored controls, weights and source IDs are rejected', () => {
  for (const defaultControls of [{ detail: 2, faint: .1, depth: 1 }, { detail: .9, faint: NaN, depth: 1 }, null])
    assert.throws(() => readCompilerRecipe({ ...source, defaultControls }), /controls/);
  for (const sourceWeights of [{}, [], { optical: -1 }, { optical: Infinity }, { optical: '1' }, { '../other': 1 }])
    assert.throws(() => readCompilerRecipe({ ...source, sourceWeights }), /source weights/);
  assert.throws(() => compilerSourceWeights(readCompilerRecipe(source), ['optical'], [3]), /valid compiler weights/);
});

test('the saved emission window is explicit, validated and unavailable for sampled volumes', () => {
  const emissionWindow = { sourceId: 'optical', featherArcsec: 90 };
  assert.deepEqual(readCompilerRecipe({ ...source, emissionWindow }).emissionWindow, emissionWindow);
  assert.equal(readCompilerRecipe(source).emissionWindow, undefined);
  for (const invalid of [null, { sourceId: '../optical', featherArcsec: 90 }, { sourceId: 'optical', featherArcsec: -1 },
    { sourceId: 'optical', featherArcsec: NaN }, { ...emissionWindow, invented: true }])
    assert.throws(() => readCompilerRecipe({ ...source, emissionWindow: invalid }), /emission window/);
  assert.throws(() => readCompilerRecipe({ ...source, emissionWindow, sampledRecipe: 'labs/nebula/models/example/sampled.json' }), /emission-field route/);
});
