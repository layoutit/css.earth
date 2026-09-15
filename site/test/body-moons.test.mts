import assert from 'node:assert/strict';
import test from 'node:test';
import catalogues from '../source/moon-catalogues.json' with { type: 'json' };
import { bodyMoonCatalogueSource, parseMoonCatalogue, prepareBodyMoons } from '../prepare-body-moons.mts';
const catalogue = catalogues.systems.find(system => system.id === 'saturn')!;

test('Saturn lists every source moon and only links registered scene objects', () => {
  const moons = prepareBodyMoons('saturn');
  assert.equal(moons.length, catalogue.count);
  assert.equal(moons.length, 293);
  assert.deepEqual(moons.map(moon => moon.id), catalogue.moons.map(moon => moon.id));
  assert.equal(moons.filter(moon => moon.object).length, 46);
  assert.equal(moons.filter(moon => !moon.object).length, 247);
  assert.equal(moons.find(moon => moon.id === 'titan')?.object?.route, '/titan/');
  assert.deepEqual(moons.find(moon => moon.id === 's-2009-s1'), { id: 's-2009-s1', name: 'S/2009 S1', object: undefined });
  assert.equal(bodyMoonCatalogueSource('saturn')?.href, catalogues.sources.discovery.url);
});

test('other planets retain their existing navigable moon entries', () => {
  const moons = prepareBodyMoons('mars');
  assert.deepEqual(moons.map(moon => moon.id), ['phobos', 'deimos']);
  assert.ok(moons.every(moon => moon.object?.route));
  assert.deepEqual(prepareBodyMoons('mercury'), []);
});

test('moon catalogues reject mismatched totals and duplicate identities', () => {
  const source = bodyMoonCatalogueSource('saturn')!;
  assert.throws(() => parseMoonCatalogue({ ...catalogue, count: 46 }, source), /count/);
  assert.throws(() => parseMoonCatalogue({ ...catalogue, moons: [catalogue.moons[0], catalogue.moons[0]], count: 2 }, source), /Duplicate/);
});

test('every planet uses the complete confirmed catalogue count', () => {
  for (const system of catalogues.systems) assert.equal(prepareBodyMoons(system.id).length, system.count, system.id);
});
