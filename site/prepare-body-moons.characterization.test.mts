import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogueMoons, hasProperMoonName, parseMoonCatalogue, prepareBodyMoons } from './prepare-body-moons.mts';

test('proper moon names are distinguished solely from the provisional designation', () => {
  assert.equal(hasProperMoonName({ name: 'Titan', provisionalDesignation: null }), true);
  assert.equal(hasProperMoonName({ name: 'S/2024 S1', provisionalDesignation: 'S/2024 S1' }), false);
  assert.equal(hasProperMoonName({ name: 'S/2024 S1', provisionalDesignation: null }), true);
});

test('catalogue parsing keeps order and strips unrelated fields while enforcing totals', () => {
  const moons = [{ id: 'deimos', name: 'Deimos', extra: true }, { id: 'phobos', name: 'Phobos' }];
  assert.deepEqual(parseMoonCatalogue({ count: 2, moons, other: true }), { moons: [{ id: 'deimos', name: 'Deimos' }, { id: 'phobos', name: 'Phobos' }] });
  for (const count of [1, 3, 2.5, '2', undefined]) assert.throws(() => parseMoonCatalogue({ count, moons }), /count does not match/);
  assert.throws(() => parseMoonCatalogue({ count: 2, moons: [moons[0], moons[0]] }), /Duplicate/);
});

test('catalogue hosts retain source order, and unknown hosts have no moons', () => {
  assert.deepEqual(catalogueMoons('mars').map(moon => moon.id), ['phobos', 'deimos']);
  assert.deepEqual(prepareBodyMoons('mars').map(moon => [moon.id, moon.object?.route]), [['phobos', '/phobos/'], ['deimos', '/deimos/']]);
  assert.deepEqual(catalogueMoons('not-a-host'), []);
  assert.deepEqual(prepareBodyMoons('not-a-host'), []);
});
