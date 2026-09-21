import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { datasetContributors, datasetSourceDetail } from '../dataset-context.mts';
import { parsePreparedSources } from '../../src/platform/prepared-sources.mts';
import { parsePreparedExploration } from '../../src/platform/prepared-exploration.mts';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';

const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const prepared = parsePreparedSources(await read('../prepared-sources.json'));
const exploration = parsePreparedExploration(await read('../prepared-facilities.json'), prepared.sources);
const context = (objectId: string, lensId: string) => datasetContributors(objectId, lensId, exploration.graph, exploration.catalog);

test('Mars elevation and thermal infrared select their own missions', () => {
  assert.deepEqual(context('mars', 'elevation').missions.map(mission => mission.id), ['mars-global-surveyor']);
  assert.deepEqual(context('mars', 'thermal').missions.map(mission => mission.id), ['odyssey']);
});

test('multi-input imagery lists its mission once and a cutaway does not invent one', () => {
  assert.deepEqual(context('mercury', 'enhanced').missions.map(mission => mission.id), ['messenger']);
  assert.deepEqual(context('mercury', 'interior').missions, []);
});

test('unresolved capture attribution names the credited group without guessing a mission', () => {
  const visible = context('mars', 'normal');
  assert.deepEqual(visible.missions, []);
  assert.equal(visible.notes.length, 1);
  assert.equal(visible.notes[0].label, 'Viking orbiters');
  assert.match(visible.notes[0].reason, /does not identify which individual orbiter/);
});

test('an unknown dataset does not inherit another dataset’s contributors', () => {
  assert.deepEqual(context('earth', 'missing-dataset'), { missions: [], facilities: [], notes: [] });
});

test('volume dataset rows name their directly captured instrument instead of image dimensions', async () => {
  const provenance = validateObjectProvenance(await read('../../src/objects/m42/prepared/provenance.json'), 'm42');
  assert.equal(datasetSourceDetail('eso-optical', provenance, exploration.catalog), 'VLT Survey Telescope');
  assert.equal(datasetSourceDetail('eso-vista', provenance, exploration.catalog), 'VISTA');
  const direct = provenance.sources.filter(source => source.lensId === 'eso-vista').map(source => source.id);
  assert.deepEqual(datasetContributors('m42', 'eso-vista', exploration.graph, exploration.catalog, direct).facilities.map(facility => facility.id), ['vista']);
});
