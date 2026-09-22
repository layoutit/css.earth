import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import catalogues from '../source/moon-catalogues.json' with { type: 'json' };
import { parseMoonCatalogue, prepareBodyMoons, prepareBodyRelations } from '../prepare-body-moons.mts';
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
});

test('other planets retain their existing navigable moon entries', () => {
  const moons = prepareBodyMoons('mars');
  assert.deepEqual(moons.map(moon => moon.id), ['phobos', 'deimos']);
  assert.ok(moons.every(moon => moon.object?.route));
  assert.deepEqual(prepareBodyMoons('mercury'), []);
});

test('moon catalogues reject mismatched totals and duplicate identities', () => {
  assert.throws(() => parseMoonCatalogue({ ...catalogue, count: 46 }), /count/);
  assert.throws(() => parseMoonCatalogue({ ...catalogue, moons: [catalogue.moons[0], catalogue.moons[0]], count: 2 }), /Duplicate/);
});

test('every planet uses the complete confirmed catalogue count', () => {
  for (const system of catalogues.systems) assert.equal(prepareBodyMoons(system.id).length, system.count, system.id);
});

test('childless moons offer their parent and other available moons', () => {
  const titan = prepareBodyRelations('titan');
  assert.ok(titan?.parent);
  assert.equal(titan.label, 'Saturn system');
  assert.equal(titan.parent.route, '/saturn/');
  assert.ok(titan.moons.some(moon => moon.object?.route === '/enceladus/'));
  assert.ok(titan.moons.every(moon => moon.id !== 'titan' && moon.object && !moon.object.discovery.illustration));
  const deimos = prepareBodyRelations('deimos');
  assert.equal(deimos?.parent?.id, 'mars');
  assert.deepEqual(deimos?.moons.map(moon => moon.id), ['phobos']);
  assert.equal(prepareBodyRelations('moon')?.parent?.id, 'earth');
  assert.deepEqual(prepareBodyRelations('moon')?.moons, []);
});

test('parents keep their complete moon catalogue and childless primary bodies omit the empty tab', () => {
  assert.deepEqual(prepareBodyRelations('saturn'), { label: 'Moons', parent: undefined, moons: prepareBodyMoons('saturn') });
  assert.equal(prepareBodyRelations('mercury'), null);
  assert.equal(prepareBodyRelations('arrokoth'), null);
});
