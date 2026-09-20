import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { sourcePds3Observations } from './source-observations.mts';

const ROOT = resolve(import.meta.dirname, '../../..');

test('source-pinned Wild 2 PDS3 images enter the PDS adapter without inventing a filter width', async () => {
  const observations = await sourcePds3Observations(ROOT, 'comet-81p');
  assert.deepEqual(observations.map(observation => observation.id), ['n2069we02_rr', 'n2073we02_rr', 'n2075we02_rr', 'n2077we02_rr', 'n2079we02_rr']);
  assert.equal(observations.every(observation => observation.sourceFiles.length === 2), true);
  assert.equal(observations.every(observation => observation.filter === 'OPNAV' && observation.centralWavelengthMicrometres === 0.6988), true);
  assert.deepEqual(observations.map(observation => observation.surfaceResolutionKm), [0.021253, 0.014167, 0.01533, 0.01939, 0.024964]);
});
