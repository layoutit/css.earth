import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deriveObjectDiscovery } from './prepare-object-discovery.mts';

const color = { id: 'color', science: { kind: 'stellar-photometric-color' } };
const map = (id: string) => ({ id, science: { kind: 'terrestrial-scientific', consumer: 'espadons-zdi' } });
const controls = (ids: readonly string[], banks: readonly string[] = []) => ({ datasets: { defaultDataset: 'color', controls: [...ids.map(id => ({ id })), ...banks.map(bank => ({ id: `corona-${bank}`, volume: { objectId: bank } }))] } });
const star = (surfaces: readonly unknown[], shown: readonly string[], banks: readonly string[] = [], catalog: unknown = {}) => deriveObjectDiscovery(catalog, controls(shown, banks), [{ surfaces }]);

test('a star with maps of its surface, however many, is on the map without being a landmark', () => {
  const one = star([color, map('a')], ['color', 'a']);
  assert.deepEqual([one.imagery, one.featured], [true, false]);
  // Three maps and a corona are things to see, and none is a picture of the star.
  const many = star([color, map('a'), map('b'), map('c')], ['color', 'a', 'b', 'c'], ['corona']);
  assert.deepEqual([many.imagery, many.featured], [true, false]);
});

test('a picture of the star, or its package\'s mark, features it whatever else it shows', () => {
  assert.equal(star([color, { id: 'image', science: { kind: 'surface-observation' } }], ['color', 'image']).featured, true);
  assert.equal(star([color, map('a')], ['color', 'a'], [], { featured: true }).featured, true);
  assert.deepEqual((({ imagery, featured }) => [imagery, featured])(star([color], ['color'])), [false, false]);
});

test('a body that is not a star is featured by any observed dataset, as before', () => {
  const planet = deriveObjectDiscovery({}, controls(['map']), [{ surfaces: [{ id: 'map', science: { kind: 'terrestrial-scientific' } }] }]);
  assert.deepEqual([planet.imagery, planet.featured], [true, true]);
});
