import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXPLORATION } from './exploration-catalog.mts';
test('prepared exploration exposes validated catalogue and dataset navigation', () => {
  assert.equal(EXPLORATION.catalog.schema, 'cssearth-facility-catalog@4');
  const mission = EXPLORATION.catalog.missions.find(mission => mission.id === 'messenger');
  assert.equal(mission?.name.value, 'MESSENGER');
  assert.equal(mission?.ended?.value, '2015');
  assert.ok(EXPLORATION.graph.datasets.some(dataset => dataset.objectId === 'mercury'));
  assert.ok(EXPLORATION.catalog.facilities.length > 0);
  assert.ok(EXPLORATION.graph.edges.length > 0);
});
