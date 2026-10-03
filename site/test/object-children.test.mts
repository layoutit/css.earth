import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { childrenOf } from '../object-children.mts';
import { OBJECTS } from '../objects.mts';
const test = sourceTest();

const ids = (id: string) => childrenOf(id).rows.map(row => row.object.id);

test('every card lists what is inside its object by one rule', () => {
  // A system: its host leads, then its bodies nearest the host first.
  assert.deepEqual(ids('trappist-1-system'), ['trappist-1', ...[...'bcdefgh'].map(letter => `trappist-1${letter}`)]);
  assert.deepEqual(ids('earth-system'), ['earth', 'moon']);
  assert.deepEqual(ids('alpha-centauri-a-system'), ['alpha-centauri-a', 'alpha-centauri-b', 'proxima-centauri']);
  // A child that is a system shows as its host, and planets lead: the Solar System lists Jupiter, not the Jupiter system.
  const solar = ids('solar-system');
  assert.deepEqual(solar.slice(0, 9), ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  assert.ok(!solar.includes('jupiter-system') && !solar.includes('moon'), 'a moon is listed in its planet\'s system');
  // A plain-dot star is listed in the system it is inside, where the map names it, and not in its galaxy's list.
  assert.deepEqual(ids('gj-338-a-system'), ['gj-338-a', 'gj-338-b']);
  assert.ok(!ids('milky-way').includes('gj-338-a'));
  assert.ok(ids('milky-way').includes('sun') && ids('milky-way').includes('alpha-centauri-a') && !ids('milky-way').includes('proxima-centauri'));
});

test('a galaxy and a cluster list what is inside them, as an object seen from inside does', () => {
  assert.ok(ids('m31').includes('m33'));
  assert.deepEqual(ids('virgo-cluster').sort(), OBJECTS.filter(object => object.parent === 'virgo-cluster').map(object => object.id).sort());
  // The view from home: the Local Group's rows are measured from the Milky Way's centre, which leads at no distance.
  const group = childrenOf('local-group');
  assert.equal(group.homeGalaxy?.id, 'milky-way');
  assert.deepEqual([group.rows[0]!.object.id, group.rows[0]!.distancePc], ['milky-way', 0]);
  assert.equal(childrenOf('betelgeuse').rows.length, 0);
});

test('a moon its host\'s catalogue names and nobody has packaged is a row that opens nothing, after the moons with pages', () => {
  const saturn = childrenOf('saturn-system');
  assert.equal(saturn.rows[0]!.object.id, 'saturn');
  assert.ok(saturn.rows.every(row => row.object.id === 'saturn' || row.object.classification === 'satellite'));
  assert.ok(saturn.drafts.length > 200 && saturn.drafts.every(moon => !saturn.rows.some(row => row.object.id === moon.id)));
  assert.equal(childrenOf('trappist-1-system').drafts.length, 0);
});
