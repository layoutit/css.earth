import { parsePreparedSurfaceFeatureCatalog, type PreparedSurfaceFeaturePlan } from '@cssearth/objects';
import { readFile } from 'node:fs/promises';

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPreparedSurfaceFeatureCatalog } from '@cssearth/renderer';

import { fixtureFeatureTransport } from '../../test/object-runtime-package.mts';

test('the local feature transport supplies a catalogue compatible with its fixture plan', async () => {
  const plan: PreparedSurfaceFeaturePlan = {
    catalog: { url: '/scenes/mercury/mercury-features.json', bytes: 1662, count: 1 },
    target: 3, datasetIds: ['normal'], meshRadiusUnits: 11500,
    policy: { minimumZoomShare: 0, minimumDiameterPixels: 40, alwaysVisibleCount: 0, maximumVisible: 40, limbCosine: .12 },
    outline: { pieces: 256 },
  };
  const fixture: unknown = JSON.parse(await readFile(new URL('../../test/fixtures/scenes/mercury/mercury-features.json', import.meta.url), 'utf8'));
  const expected = parsePreparedSurfaceFeatureCatalog(fixture, plan, 'mercury');
  const catalogue = await loadPreparedSurfaceFeatureCatalog(plan, 'mercury', new AbortController().signal, fixtureFeatureTransport);
  assert.deepEqual(catalogue, expected);
  assert.equal(catalogue.features.length, 1);
  assert.equal(catalogue.features[0]?.name, 'Serp Facula');
  await assert.rejects(fixtureFeatureTransport('/scenes/../mercury/mercury-features.json'), /Invalid fixture/);
});
