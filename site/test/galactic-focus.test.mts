import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogueObject } from '@cssearth/objects';
import { prepareSceneDistance } from '@cssearth/bake/navigation';
import { searchObjects } from '../search/object-search.mts';

test('a globular cluster package is an entry of the registry from its own descriptor, classified and searched like any other', () => {
  const PC_M = 3.085677581491367e16;
  const descriptor = { schema: 'cssearth-object@2', id: 'test-cluster', type: 'layered-body', properties: {
    catalog: { name: 'Test cluster', systemName: 'Milky Way', classification: 'globular-cluster', color: '#9a9a9a', distanceAu: 20626480.6,
      description: 'A source-backed test globular cluster.', aliases: ['Cluster alias'], order: 9, context: {} },
    worldFrame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [100 * PC_M, 0, 0], presentationToReference: [0, 1, 0, 1, 0, 0, 0, 0, 1],
      metersPerUnit: PC_M, bodyRadiusM: 10 * PC_M } } };
  const distance = prepareSceneDistance(descriptor);
  // A globular cluster's distance is its catalogued one: no epoch, read from the observer.
  assert.partialDeepStrictEqual(distance, { meters: 100 * PC_M, unit: 'pc', quantity: 'catalogue', referencePoint: 'observer', epochJdTt: null });
  assert.ok(Math.abs(distance.value - 100) < 1e-9);
  const focus = catalogueObject({ descriptor, distance, discovery: { featured: false, imagery: true, illustration: false } },
    () => async () => { throw new Error('unused'); });
  assert.equal(typeof focus.loadScene, 'function', 'a globular cluster is an object with a scene of its own, like any body');
  const names = (focus as { searchNames?: readonly string[] }).searchNames;
  assert.ok(names);
  assert.equal(focus.classification, 'globular-cluster');
  assert.equal(focus.systemName, 'Milky Way');
  assert.equal(focus.route, '/test-cluster/');
  const labels = [{ name: focus.name.toLowerCase(), names: names!, classification: focus.classification,
    classificationName: 'globular cluster', systemName: focus.systemName.toLowerCase() }];
  assert.equal(searchObjects(labels, 'globular clusters').matches.length, 1);
  assert.equal(searchObjects(labels, 'Cluster alias').matches.length, 1);
  assert.equal(searchObjects(labels, 'nebula').matches.length, 0);
});
