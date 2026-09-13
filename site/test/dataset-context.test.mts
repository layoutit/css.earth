import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { datasetContext } from '../dataset-context.mts';
import { parsePreparedSources } from '../../src/platform/prepared-sources.mts';
import { parsePreparedExploration } from '../../src/platform/prepared-exploration.mts';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';

const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const prepared = parsePreparedSources(await read('../prepared-sources.json'));
const exploration = parsePreparedExploration(await read('../prepared-machines.json'), prepared.sources);
const context = async (objectId: string, lensId: string) => datasetContext(objectId, lensId,
  validateObjectProvenance(await read(`../../src/objects/${objectId}/prepared/provenance.json`), objectId),
  exploration.graph, exploration.catalog, prepared.usage, prepared.sources);
const ids = (value: Awaited<ReturnType<typeof context>>) => value.sources.flatMap(group => group.links.map(link => link.id));

test('Mars elevation and thermal infrared select their own missions and products', async () => {
  const elevation = await context('mars', 'elevation'), thermal = await context('mars', 'thermal');
  assert.deepEqual(elevation.missions.map(mission => mission.id), ['mars-global-surveyor']);
  assert.deepEqual(thermal.missions.map(mission => mission.id), ['odyssey']);
  assert.deepEqual(ids(elevation), ['source-mars-usgs-mola-pseudocolor']);
  assert.ok(ids(thermal).length > 0);
  assert.ok(ids(thermal).every(id => !ids(elevation).includes(id)));
});

test('multi-input imagery keeps distinct source links but lists its mission once', async () => {
  const enhanced = await context('mercury', 'enhanced');
  assert.deepEqual(enhanced.missions.map(mission => mission.id), ['messenger']);
  assert.equal(ids(enhanced).length, 3);
  assert.equal(new Set(ids(enhanced)).size, 3);
  assert.equal(enhanced.sources.length, 1);
  const interior = await context('mercury', 'interior');
  assert.deepEqual(interior.missions, []);
  assert.ok(ids(interior).length > 0);
  // The cutaway actually consumes the monochrome surface as well as an interior reference.
  assert.deepEqual(ids(interior), ['nasa-mercury-facts', 'source-mercury-usgs-messenger-bdr-global-z3']);
});

test('unresolved capture attribution stays unresolved, without guessing a mission', async () => {
  const visible = await context('mars', 'normal');
  assert.deepEqual(visible.missions, []);
  assert.equal(visible.notes.length, 1);
  // The label names the credited group; only the individual orbiter is unknown.
  assert.equal(visible.notes[0].label, 'Viking orbiters');
  assert.match(visible.notes[0].reason, /does not identify which individual orbiter/);
  assert.deepEqual(ids(visible), ['source-mars-usgs-viking-mdim21-color']);
});

test('an unknown dataset does not inherit body, factsheet or shared-scene sources', async () => {
  const missing = await context('earth', 'missing-dataset');
  assert.deepEqual(missing, { missions: [], machines: [], notes: [], sources: [] });
});
