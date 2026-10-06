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

// Whole-catalogue parity uses the actual production registry and search order.
test('preparation preserves the old serialized results, ordering and named-label eligibility', async () => {
  const { default: input } = await import('../../../source/moon-catalogues.json', { with: { type: 'json' } });
  const { SEARCH_OBJECTS } = await import('../../../search/search-objects.mts');
  const { systemObjectId } = await import('../../../model/system-address.mts');
  const { readMoonCatalogue } = await import('../../../content/moon-catalogue.mts');
  for (const hostId of [...input.systems.map(system => system.id), ...new Set(SEARCH_OBJECTS.map(object => object.id)), 'not-a-host']) {
    const available = SEARCH_OBJECTS.filter(object => object.classification === 'satellite' && object.parent === systemObjectId(hostId));
    const source = input.systems.find(system => system.id === hostId);
    const byId = new Map(available.map(object => [object.id, object]));
    const old = source ? source.moons.map(moon => ({ id: moon.id, name: moon.name, object: byId.get(moon.id) }))
      : available.map(object => ({ id: object.id, name: object.name, object }));
    assert.equal(JSON.stringify(prepareBodyMoons(hostId)), JSON.stringify(old), hostId);
    if (source) assert.deepEqual(source.moons.filter(moon => hasProperMoonName(moon)),
      source.moons.filter(moon => moon.name !== moon.provisionalDesignation));
  }
  // The default production call must observe the shared cache, not another parse.
  const cached = readMoonCatalogue('mars')!;
  const original = cached.moons;
  try {
    cached.moons = [...original].reverse();
    assert.deepEqual(prepareBodyMoons('mars').map(moon => moon.id), cached.moons.map(moon => moon.id));
  } finally { cached.moons = original; }
});
