import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_WORLD_LAYERS_SHOWN, hiddenWorldLayers, worldLayerOfClassification, worldLayerVisibility, WORLD_LAYERS, worldLayerHidden } from './world-layers.ts';

test('world layers default to shown and hidden layers round-trip in canonical order', () => {
  assert.deepEqual(worldLayerVisibility([]), ALL_WORLD_LAYERS_SHOWN);
  assert.ok(WORLD_LAYERS.every(layer => ALL_WORLD_LAYERS_SHOWN[layer]));
  const hidden = worldLayerVisibility(['labels', 'stars']);
  assert.equal(hidden.subject, true);
  assert.deepEqual(hiddenWorldLayers(hidden), ['stars', 'labels']);
  assert.throws(() => worldLayerVisibility(['unknown' as never]), /Unknown world layer/);
  assert.equal(Object.isFrozen(hidden), true);
});

test('classifications use shared layers while an unclassified object stays visible', () => {
  for (const kind of ['star', 'black-hole', 'open-cluster', 'globular-cluster']) assert.equal(worldLayerOfClassification(kind), 'stars');
  for (const kind of ['planet', 'satellite', 'asteroid', 'exoplanet']) assert.equal(worldLayerOfClassification(kind), 'planets');
  assert.equal(worldLayerOfClassification('galaxy'), 'galaxies');
  assert.equal(worldLayerOfClassification('nebula'), 'nebulae');
  assert.equal(worldLayerOfClassification(undefined), null);
});

test('Nebulae off preserves the page nebula and its dataset bank through the production subject rule', () => {
  const hidden = worldLayerVisibility(['nebulae']);
  for (const own of ['page-nebula', 'page-volume']) assert.equal(worldLayerHidden(hidden, own, ['page-nebula', 'page-volume'], 'nebulae'), false);
  assert.equal(worldLayerHidden(hidden, 'other-nebula', ['page-nebula', 'page-volume'], 'nebulae'), true);
});

test('one subject rule exempts the page image bank and CMB mesh from their context layers', () => {
  for (const [id, layer] of [['galaxy-image', 'galaxies'], ['cmb-mesh', 'sky']] as const) {
    assert.equal(worldLayerHidden(worldLayerVisibility([layer]), id, [id, null], layer), false);
    assert.equal(worldLayerHidden(worldLayerVisibility([layer]), id, ['other', null], layer), true);
    assert.equal(worldLayerHidden(worldLayerVisibility(['subject']), id, [id, null], layer), true);
  }
});
