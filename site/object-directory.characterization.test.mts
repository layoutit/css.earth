import assert from 'node:assert/strict';
import test from 'node:test';
import { ancestorIds, knownAncestors, knownObject, loadHolder, loadObject, NAVIGABLE_OBJECTS, objectFromEntry, seedObjectDirectory } from './object-directory.mts';
import { objectEntry } from './object-entry.mts';

test('absent ancestor metadata is empty, but explicit non-list metadata is refused', async () => {
  for (const value of [null, undefined, 3, {}, { unrelated: true }]) {
    assert.deepEqual(await ancestorIds('body', async () => value), []);
    assert.equal(await loadHolder('body', async () => value), null);
  }
  await assert.rejects(ancestorIds('body', async () => ({ ancestors: null })), /ancestors must be a list of object ids; got null/);
  assert.deepEqual(await ancestorIds('body', async () => ({ ancestors: ['solar-system'] })), ['solar-system']);
});

test('a missing object remains cached even when a later reader would supply it', async () => {
  const id = 'characterization-absent';
  assert.equal(await loadObject(id, async () => null), null);
  assert.equal(await loadObject(id, async () => { assert.fail('must not reread a cached null'); }), null);
  assert.equal(knownObject(id), undefined);
  assert.deepEqual(knownAncestors(id), []);
  assert.equal(await loadObject('Bad/Id', async () => { throw new Error('invalid ids must not be read'); }), null);
});

test('failed reads are retried, and seeding retains the first object of an identity', async () => {
  const entry = objectEntry('mars');
  assert.ok(entry);
  await assert.rejects(loadObject('mars', async () => { throw new Error('read failed'); }), /read failed/);
  const mars = await loadObject('mars', async () => entry);
  assert.ok(mars);
  const replacement = objectFromEntry(entry);
  seedObjectDirectory([replacement]);
  assert.equal(knownObject('mars') === mars, true);
  assert.equal(NAVIGABLE_OBJECTS.filter(object => object.id === 'mars').length, 1);
  assert.deepEqual(knownAncestors('mars'), [], 'unloaded parent ends the known chain');
});

test('a system delegates scene loading and the abort signal to its seeded host', async () => {
  const entry = objectEntry('sun');
  const system = objectEntry('solar-system');
  assert.ok(entry && system);
  const signal = new AbortController().signal;
  seedObjectDirectory([{ ...objectFromEntry(entry), loadScene: async received => {
    assert.equal(received, signal);
    throw new Error('host scene requested');
  } }]);
  await assert.rejects(objectFromEntry(system).loadScene(signal), /host scene requested/);
});

test('a directory entry cannot publish an identity different from the requested one', async () => {
  const entry = objectEntry('venus'); assert.ok(entry);
  await assert.rejects(loadObject('characterization-wrong-identity', async () => entry), { name: 'TypeError', message: 'The entry for characterization-wrong-identity names venus.' });
  assert.equal(knownObject('venus'), undefined);
});
