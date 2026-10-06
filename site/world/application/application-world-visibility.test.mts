import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSceneLifetime } from '@cssearth/engine';
import { createApplicationWorldVisibility } from './application-world-visibility.mts';
import { allSatelliteSystems } from '../systems/satellite-systems.mts';

function fixture() {
  const lifetime = createSceneLifetime();
  type Layer = Parameters<typeof createApplicationWorldVisibility>[0];
  const publications: Parameters<Layer['setBodyVisibility']>[0][] = [];
  const visibility = createApplicationWorldVisibility({ setBodyVisibility(value) { publications.push(value); } }, lifetime);
  return { visibility, publications, latest: () => publications.at(-1)! };
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
  assert.ok(!latest().orbitHidden?.includes('ida'), 'the selected asteroid draws its orbit');
  visibility.selectObject('dactyl');
  assert.ok(!latest().bodyHidden?.includes('dactyl'), 'the family stays open');
  assert.ok(latest().orbitHidden?.includes('ida'), 'and its host is no longer the selected body');
  const count = publications.length;
  visibility.selectObject('dactyl');
  assert.equal(publications.length, count, 'the same selection does not republish visibility');
  visibility.selectObject('earth');
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


test('only an explicitly selected comet or asteroid gains its default-hidden orbit and marker', () => {
  const { visibility, latest } = fixture();
  assert.ok(latest().orbitHidden?.includes('comet-2p'));
  assert.ok(latest().orbitHidden?.includes('comet-67p'), 'a featured comet draws no orbit either');
  visibility.selectObject('comet-2p');
  assert.ok(!latest().orbitHidden?.includes('comet-2p'));
  assert.ok(latest().orbitHidden?.includes('comet-209p'));
  visibility.selectObject('earth');
  assert.ok(latest().orbitHidden?.includes('comet-2p'));
  assert.ok(latest().bodyHidden?.includes('pallas') && latest().orbitHidden?.includes('pallas'));
  visibility.selectObject('pallas');
  assert.ok(!latest().bodyHidden?.includes('pallas') && !latest().orbitHidden?.includes('pallas'), 'an asteroid without a marker draws while it is selected');
});

test('a pill category highlights its bodies, the galaxies among them', () => {
  const { visibility, latest } = fixture();
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
  // A galaxy with a package is a body of the world: the pill marks it as it marks a planet.
  for (const id of ['m31', 'lmc', 'm87']) assert.ok(latest().highlighted?.includes(id), id);
  assert.ok(!latest().highlighted?.includes('jupiter'));
  visibility.setHighlightedClassification(null);
  assert.deepEqual(latest().highlighted, []);
});

test('an object whose walls stand around the selected body is not marked', () => {
  const { visibility, publications, latest } = fixture();
  assert.ok(!latest().bodyHidden?.includes('m57'));
  visibility.setSurrounding(['m57']);
  assert.ok(latest().bodyHidden?.includes('m57'));
  const count = publications.length;
  visibility.setSurrounding(['m57']);
  assert.equal(publications.length, count, 'the same holders publish nothing');
  visibility.setSurrounding([]);
  assert.ok(!latest().bodyHidden?.includes('m57'));
});
