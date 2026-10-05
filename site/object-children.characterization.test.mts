import assert from 'node:assert/strict';
import test from 'node:test';
import { childrenOf } from './object-children.mts';

test('unknown parents are refused and leaf lists are frozen empty results', () => {
  assert.throws(() => childrenOf('not-an-object'), /not-an-object is no object of the registry/);
  const leaf = childrenOf('betelgeuse');
  assert.deepEqual(leaf.rows, []);
  assert.deepEqual(leaf.drafts, []);
  assert.equal(leaf.host, undefined);
  assert.equal(leaf.homeGalaxy, undefined);
  assert.ok(Object.isFrozen(leaf) && Object.isFrozen(leaf.rows) && Object.isFrozen(leaf.drafts));
});

test('system distances start at their host and planet order precedes moons', () => {
  const earth = childrenOf('earth-system');
  assert.equal(earth.host?.id, 'earth');
  assert.equal(earth.homeGalaxy, undefined);
  assert.deepEqual(earth.rows.map(row => row.object.id), ['earth', 'moon']);
  assert.equal(earth.rows[0]?.distancePc, 0);
  assert.ok(earth.rows[1]!.distancePc > 0);
  const solar = childrenOf('solar-system');
  assert.deepEqual(solar.rows.slice(0, 9).map(row => row.object.id), ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  assert.deepEqual(childrenOf('hd-226868-system').drafts.map(row => row.name), ['Cygnus X-1']);
});
