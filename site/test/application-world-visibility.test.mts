import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSceneLifetime } from '@cssearth/engine';
import { createApplicationWorldVisibility } from '../application-world-visibility.mts';
import { allSatelliteSystems } from '../satellite-systems.mts';

function fixture() {
  const lifetime = createSceneLifetime();
  type Layer = Parameters<typeof createApplicationWorldVisibility>[0];
  const publications: Parameters<Layer['setBodyVisibility']>[0][] = [], categories: (string | null)[] = [];
  const visibility = createApplicationWorldVisibility({ setBodyVisibility(value) { publications.push(value); },
    setHighlightedClassification(value) { categories.push(value); } }, lifetime);
  return { visibility, publications, categories, latest: () => publications.at(-1)! };
}

test('every satellite family is visible when its host or any member is selected', () => {
  const { visibility, latest } = fixture();
  for (const family of allSatelliteSystems()) {
    for (const selected of [family.hostId, ...family.memberIds]) {
      visibility.selectObject(selected);
      for (const id of [family.hostId, ...family.memberIds]) {
        assert.ok(!latest().bodyHidden?.includes(id), `${selected}: body ${id}`);
        assert.ok(!latest().labelHidden?.includes(id), `${selected}: label ${id}`);
      }
    }
  }
});

test('leaving Ida restores discovery filters without enabling unrelated illustrations', () => {
  const { visibility, publications, latest } = fixture();
  const initial = latest();
  assert.ok(initial.bodyHidden?.includes('dactyl'));
  visibility.selectObject('ida');
  assert.ok(!latest().bodyHidden?.includes('dactyl'));
  assert.ok(latest().bodyHidden?.includes('selam'));
  const count = publications.length;
  visibility.selectObject('dactyl');
  assert.equal(publications.length, count, 'same family does not republish visibility');
  visibility.selectObject('gaspra');
  assert.deepEqual(latest(), initial);
});

test('placed stellar systems still reveal their illustrated planets', () => {
  const { visibility, latest } = fixture();
  visibility.selectObject('trappist-1');
  for (const id of ['trappist-1b', 'trappist-1e', 'trappist-1h']) {
    assert.ok(!latest().bodyHidden?.includes(id), id);
    assert.ok(!latest().labelHidden?.includes(id), id);
  }
});


test('only an explicitly selected non-featured comet gains its default-hidden orbit', () => {
  const { visibility, latest } = fixture();
  assert.ok(latest().orbitHidden?.includes('comet-2p'));
  assert.ok(!latest().orbitHidden?.includes('comet-67p'));
  visibility.selectObject('comet-2p');
  assert.ok(!latest().orbitHidden?.includes('comet-2p'));
  assert.ok(latest().orbitHidden?.includes('comet-209p'));
  visibility.selectObject('earth');
  assert.ok(latest().orbitHidden?.includes('comet-2p'));
});

test('a pill category highlights its bodies and reaches the galaxy, cluster and nebula catalogue too', () => {
  const { visibility, categories, latest } = fixture();
  visibility.setHighlightedClassification('planet');
  assert.ok(latest().highlighted?.includes('jupiter'));
  assert.ok(latest().highlighted?.includes('pluto'), 'the Planets pill marks the dwarf planets too');
  visibility.setHighlightedClassification('exoplanet');
  assert.ok(latest().highlighted?.includes('hr-8799-b'));
  assert.ok(!latest().highlighted?.includes('kepler-1651b'), 'only notable exoplanets are marked');
  assert.ok(latest().labelHidden?.includes('kepler-1651b'), 'and the rest keep their hidden labels');
  assert.ok(latest().highlighted?.includes('hr-8799'), 'from afar a planet is its star\'s dot, so the star carries the mark');
  assert.ok(!latest().highlighted?.includes('sun'));
  visibility.setHighlightedClassification('galaxy');
  assert.deepEqual(latest().highlighted, []);
  visibility.setHighlightedClassification(null);
  assert.deepEqual(categories, ['planet', 'exoplanet', 'galaxy', null]);
});
