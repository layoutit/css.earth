import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { OBJECTS, SCENE_OBJECTS as REGISTERED_SCENE_OBJECTS } from '../objects.mts';
import { readPreparedObjects } from '@cssearth/objects/node';
import { resolve } from 'node:path';
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

test('preparation reads the registry the application holds, without its scene loader', async () => {
  const prepared = readPreparedObjects(resolve(import.meta.dirname, '../..'));
  assert.deepEqual(facts(prepared.objects), facts(OBJECTS));
  // Preparation reads the same scene objects, galaxies, nebulae and the objects seen from inside among them.
  assert.deepEqual(prepared.sceneObjects.map(object => object.id), REGISTERED_SCENE_OBJECTS.map(object => object.id));
  assert.equal(prepared.requireSceneObject('m31').id, 'm31');
  assert.deepEqual(prepared.objects.filter(object => object.zoom).map(object => object.id).sort(), ['local-group', 'milky-way', 'nearby-universe', 'observable-universe']);
  assert.equal(prepared.objects.find(object => object.id === 'milky-way')?.parent, 'local-group');
  assert.equal(prepared.requireSceneObject('mars').name, REGISTERED_SCENE_OBJECTS.find(object => object.id === 'mars')?.name);
  await assert.rejects(prepared.requireSceneObject('mars').loadScene(), /cannot mount a scene/);
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
