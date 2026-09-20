import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { datasetContributors } from '../dataset-context.mts';
import { parsePreparedSources } from '../../src/platform/prepared-sources.mts';
import { parsePreparedExploration } from '../../src/platform/prepared-exploration.mts';

const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const prepared = parsePreparedSources(await read('../prepared-sources.json'));
const exploration = parsePreparedExploration(await read('../prepared-facilities.json'), prepared.sources);
const context = (objectId: string, lensId: string) => datasetContributors(objectId, lensId, exploration.graph, exploration.catalog, prepared.usage, prepared.sources);

test('Mars elevation and thermal infrared select their own missions', () => {
  assert.deepEqual(context('mars', 'elevation').missions.map(mission => mission.id), ['mars-global-surveyor']);
  assert.deepEqual(context('mars', 'thermal').missions.map(mission => mission.id), ['odyssey']);
});

test('multi-input imagery lists its mission once and a cutaway does not invent one', () => {
  const enhanced = context('mercury', 'enhanced');
  assert.deepEqual(enhanced.missions.map(mission => mission.id), ['messenger']);
  assert.deepEqual(enhanced.sources.map(source => source.id), [
    'source-mercury-usgs-messenger-enhanced-global-z3',
    'source-mercury-usgs-messenger-bdr-global-z3',
    'source-mercury-usgs-messenger-topography-z3',
  ]);
  const interior = context('mercury', 'interior');
  assert.deepEqual(interior.missions, []);
  assert.deepEqual(interior.sources.map(source => source.id), [
    'nasa-mercury-facts',
    'source-mercury-usgs-messenger-bdr-global-z3',
  ]);
});

test('Mercury exposes the selected instrument product as a source link', () => {
  const normal = context('mercury', 'normal');
  assert.deepEqual(normal.sources, [{
    id: 'source-mercury-usgs-messenger-bdr-global-z3',
    title: 'MESSENGER MDIS monochrome mosaic',
    href: 'https://astrogeology.usgs.gov/search/map/mercury-messenger-global-products',
  }]);
});

test('unresolved capture attribution names the credited group without guessing a mission', () => {
  const visible = context('mars', 'normal');
  assert.deepEqual(visible.missions, []);
  assert.equal(visible.notes.length, 1);
  assert.equal(visible.notes[0].label, 'Viking orbiters');
  assert.match(visible.notes[0].reason, /does not identify which individual orbiter/);
});

test('an unknown dataset does not inherit another dataset’s contributors', () => {
  assert.deepEqual(context('earth', 'missing-dataset'), { missions: [], facilities: [], notes: [], sources: [] });
});
