import { parsePreparedObjectRuntime } from '@cssearth/objects';

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadObjectTestDefinition } from '@cssearth/objects/node/contract';
import { loadPreparedSurfaceFeatureCatalog } from '@cssearth/renderer';

import { fixtureFeaturePlan, fixtureFeatureTransport } from './fixtures/object-runtime-package.mts';

test('the local feature transport supplies a catalogue compatible with its fixture plan', async () => {
  const definition = parsePreparedObjectRuntime(await loadObjectTestDefinition('mercury', new URL('../../../..', import.meta.url).pathname));
  assert.ok(definition.features);
  const plan = fixtureFeaturePlan(definition.features);
  const catalogue = await loadPreparedSurfaceFeatureCatalog(plan, 'mercury', new AbortController().signal, fixtureFeatureTransport);
  assert.equal(catalogue.features.length, 1);
  assert.equal(catalogue.features[0]?.name, 'Serp Facula');
  await assert.rejects(fixtureFeatureTransport('/scenes/../mercury/mercury-features.json'), /Invalid fixture/);
});
