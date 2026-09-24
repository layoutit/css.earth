import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { OBJECTS } from '../objects.mts';
import { OBJECT_ENTRY_IDS, objectEntry } from '../object-entry.mts';
import { knownObject, loadObject, objectFromEntry, NAVIGABLE_OBJECTS, SCENE_OBJECTS } from '../object-directory.mts';

// Loaders are functions; compare everything else an object carries.
const facts = (value: unknown) => JSON.parse(JSON.stringify(value));

test('every prepared entry rebuilds the object the registry holds', () => {
  assert.deepEqual(OBJECT_ENTRY_IDS, OBJECTS.map(object => object.id));
  for (const object of OBJECTS) {
    const rebuilt = objectFromEntry(JSON.parse(JSON.stringify(objectEntry(object.id))));
    assert.deepEqual(facts(rebuilt), facts(object), object.id);
    assert.equal(typeof (rebuilt as { loadScene?: unknown }).loadScene, typeof (object as { loadScene?: unknown }).loadScene, object.id);
  }
  assert.equal(objectEntry('not-an-object'), null);
});

test('the directory loads each object once, and only objects', async () => {
  const reads: string[] = [];
  const read = async (id: string) => { reads.push(id); return objectEntry(id); };
  const [first, again] = await Promise.all([loadObject('mars', read), loadObject('mars', read)]);
  assert.equal(first, again);
  assert.equal(knownObject('mars'), first);
  assert.ok(SCENE_OBJECTS.includes(first as never) && NAVIGABLE_OBJECTS.includes(first!));
  assert.equal(await loadObject('mars', read), first);
  assert.equal(await loadObject('not-an-object', read), null);
  assert.equal(await loadObject('../mars', read), null);
  assert.deepEqual(reads, ['mars', 'not-an-object']);
  await assert.rejects(loadObject('venus', async () => objectEntry('mars')), /The entry for venus names mars/);
  // A failed read is forgotten, so the next asks again.
  assert.equal(await loadObject('venus', async id => objectEntry(id)), knownObject('venus'));
});
