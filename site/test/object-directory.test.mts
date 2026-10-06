import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { OBJECTS, SCENE_OBJECTS as REGISTERED_SCENE_OBJECTS, ancestorsOf } from '../objects.mts';
import { readPreparedObjects } from '@cssearth/objects/node';
import { resolve } from 'node:path';
import { OBJECT_ENTRY_IDS, objectEntry } from '../server/object-entry.mts';
import { ancestorIds, knownObject, loadAncestors, loadHolder, loadObject, objectFromEntry, NAVIGABLE_OBJECTS, SCENE_OBJECTS } from '../object-directory.mts';

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

test('an entry whose ancestors are not a list of object ids is refused, naming the entry', async () => {
  await assert.rejects(loadAncestors('mars', async () => ({ ancestors: ['solar-system', 7] })), /\/objects\/mars\/entry\.json: ancestors must be a list of object ids; got \["solar-system",7\]/);
  await assert.rejects(loadAncestors('mars', async () => ({ ancestors: 'solar-system' })), /ancestors must be a list of object ids/);
});

test('a page reads the one object a body is inside that takes the view, and the ids of the rest from the body\'s own entry', async () => {
  const reads: string[] = [];
  // As the entry endpoint serves it: the object's facts with the ids of the objects it is inside, nearest first.
  const read = async (id: string) => { reads.push(id); const entry = objectEntry(id); return entry && { ...(entry as object), ancestors: ancestorsOf(id).map(object => object.id) }; };
  // A star of the Large Magellanic Cloud: its own entry names the Cloud and everything the Cloud is inside.
  assert.deepEqual((await ancestorIds('hv-1005', read)).slice(0, 2), ['lmc', 'milky-way']);
  assert.deepEqual(reads, ['hv-1005']);
  assert.equal((await loadHolder('hv-1005', read))?.id, 'lmc');
  assert.equal(knownObject('lmc')?.id, 'lmc');
  // A body inside a system: the first object that is no system. Europa is inside the Jupiter system, inside the Solar
  // System, inside the Milky Way, and neither system's entry is read for it.
  reads.length = 0;
  assert.equal((await loadHolder('europa', read))?.id, 'milky-way');
  assert.ok(reads.includes('europa') && !reads.includes('jupiter-system') && !reads.includes('solar-system'), reads.join(', '));
  // The root is inside nothing.
  assert.equal(await loadHolder('observable-universe', read), null);
});


test('reading what a star is inside loads the star too, so the chain out of it is known on a page that has not mounted it', async () => {
  const read = async (id: string) => { const entry = objectEntry(id); return entry && { ...(entry as object), ancestors: ancestorsOf(id).map(object => object.id) }; };
  // A planet's page reads its own entry; the zoom out of it is centred on its star, which the page has not mounted.
  assert.equal(knownObject('trappist-1'), undefined);
  const chain = await loadAncestors('trappist-1', read);
  assert.equal(knownObject('trappist-1')?.id, 'trappist-1');
  assert.deepEqual(chain.map(object => object.id), ancestorsOf('trappist-1').map(object => object.id));
  assert.deepEqual(chain.map(object => object.id).slice(0, 2), ['trappist-1-system', 'milky-way']);
});
