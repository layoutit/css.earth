import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogueObject, defineObjects } from '@cssearth/objects';
import { objectFromEntry, registerDirectoryRuntimeLoader, loadObject, knownObject, seedObjectDirectory } from './object-directory.mts';
import type { SceneFactory } from '../browser/browser-types.mts';

const entry = (id: string, host?: string) => ({ descriptor: { schema: 'cssearth-object@2', id, type: host ? 'system' : 'layered-body',
  properties: { worldFrame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [1, 0, 0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1 }, catalog: { name: id, systemName: 'Solar System', color: '#aabbcc', distanceAu: 1, description: 'A body.', classification: host ? 'satellite-system' : 'planet' }, ...(host ? { system: { host } } : {}) } },
  distance: { meters: 3.085677581491367e16, value: 1, unit: 'pc', quantity: 'catalogue', referencePoint: 'observer', epochJdTt: null }, discovery: { featured: false, imagery: false, illustration: false } });
const mount: SceneFactory = () => { throw new Error('Only scene loading is exercised.'); };

test('metadata and the registry construct without registration; missing registration rejects at scene invocation', async () => {
  const value = entry('unregistered');
  const object = objectFromEntry(value);
  assert.deepEqual(JSON.parse(JSON.stringify(object)), JSON.parse(JSON.stringify(catalogueObject(value, () => async () => mount))));
  assert.equal(defineObjects([value].map(objectFromEntry))[0]?.id, 'unregistered', 'registry construction needs no runtime loader');
  const loaded = await loadObject('unregistered', async () => value);
  assert.ok(loaded);
  assert.equal(knownObject('unregistered'), loaded);
  await assert.rejects(loaded.loadScene(), /Object directory runtime loader is not registered\./u);
});

test('entries constructed before registration read the current loader, retry failures and forward abort signals', async () => {
  const value = entry('registered');
  const object = objectFromEntry(value);
  seedObjectDirectory([object]);
  let attempts = 0;
  const signal = new AbortController().signal;
  registerDirectoryRuntimeLoader(async () => {
    if (++attempts === 1) throw new Error('runtime failed');
    return { async loadPackagedObject(descriptor, received) {
      assert.equal(descriptor, value.descriptor);
      assert.equal(received, signal);
      return mount;
    } };
  });
  await assert.rejects(object.loadScene(signal), /runtime failed/u);
  assert.equal(await object.loadScene(signal), mount);
  assert.equal(await loadObject('registered', async () => { assert.fail('entry identity must remain cached'); }), object);
  assert.equal(attempts, 2);
  const controller = new AbortController(); controller.abort();
  registerDirectoryRuntimeLoader(async () => ({ async loadPackagedObject(descriptor, received) {
    assert.equal(descriptor, value.descriptor); assert.equal(received, controller.signal);
    throw new DOMException('aborted', 'AbortError');
  } }));
  await assert.rejects(object.loadScene(controller.signal), { name: 'AbortError' });
  registerDirectoryRuntimeLoader(async () => ({ async loadPackagedObject() { return mount; } }));
  assert.equal(await object.loadScene(), mount, 're-registration is read at invocation, including after abort');
});


test('systems retain host entry identity, recursion and the abort signal', async () => {
  const host = objectFromEntry(entry('loader-host'));
  seedObjectDirectory([host]);
  const system = objectFromEntry(entry('loader-host-system', 'loader-host'));
  const signal = new AbortController().signal;
  let received: unknown[] = [];
  registerDirectoryRuntimeLoader(async () => ({ async loadPackagedObject(descriptor, forwarded) { received = [descriptor, forwarded]; return mount; } }));
  assert.equal(await system.loadScene(signal), mount);
  assert.equal(knownObject('loader-host'), host);
  assert.equal(received[1], signal);
  assert.equal(Reflect.get(received[0]!, 'id'), 'loader-host');
});
