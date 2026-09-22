import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { loadNaturalEarthRows, naturalEarthZoomShare, parseNaturalEarthConfig } from './natural-earth.js';

const earthSource = resolve(process.cwd(), 'src/objects/earth/source');
const recipe = async () => JSON.parse(await readFile(resolve(earthSource, 'preparation/features.json'), 'utf8')).naturalEarth;

test('Natural Earth minimum zoom maps linearly between the farthest and closest camera views', () => {
  const discovery = { farthestZoomLevel: 1.1, closestZoomLevel: 4.4, mapMaximumZoomLevel: 5 };
  assert.equal(naturalEarthZoomShare(0, discovery), 0);
  assert.equal(naturalEarthZoomShare(1.1, discovery), 0);
  assert.ok(Math.abs(naturalEarthZoomShare(2.75, discovery) - 0.5) < 1e-12);
  assert.equal(naturalEarthZoomShare(4.4, discovery), 1);
  assert.equal(naturalEarthZoomShare(9, discovery), 1);
});

test('the recipe must say whether each class labels the map and give ordered discovery levels', async () => {
  const valid = await recipe();
  assert.doesNotThrow(() => parseNaturalEarthConfig(valid));
  const withoutMap = structuredClone(valid);
  delete withoutMap.layers[0].classes['Admin-0 country'].map;
  assert.throws(() => parseNaturalEarthConfig(withoutMap), /map must say/u);
  assert.throws(() => parseNaturalEarthConfig({ ...valid, discovery: { farthestZoomLevel: 4, closestZoomLevel: 2, mapMaximumZoomLevel: 5 } }), /must increase/u);
  assert.throws(() => parseNaturalEarthConfig({ ...valid, highlights: { tier: 5, ids: ['1', '1'] } }), /distinct/u);
});

test('the pinned Earth layers keep countries at label points, fold split parts and hide unlisted classes from the map', async () => {
  const config = parseNaturalEarthConfig(await recipe());
  const rows = loadNaturalEarthRows(earthSource, 'features', config);
  const france = rows.find(row => row.layer === 'countries' && row.name === 'France')!;
  assert.ok(france && france.extent === null && france.centerLon < 10 && france.centerLat > 40, 'France anchors at its European label point with no extent');
  assert.equal(france.searchOnly, false);
  const pacific = rows.filter(row => row.name === 'Pacific Ocean');
  assert.ok(pacific.length > 1 && pacific.filter(row => !row.searchOnly).length === 1, 'split ocean parts label the map once');
  assert.ok(rows.some(row => row.type === 'Cape') && rows.filter(row => row.type === 'Cape').every(row => row.searchOnly));
  const beijing = rows.find(row => row.layer === 'populated-places' && row.name === 'Beijing')!;
  assert.equal(beijing.zoomShare, 0.5, 'a class floor holds capitals back although Natural Earth shows them at world scale');
  const sahara = rows.find(row => row.name === 'Sahara')!;
  assert.equal(sahara.searchOnly, false, 'a highlighted desert labels the map');
  const [ocean, country, city] = [rows.find(row => row.type === 'Ocean')!, france, rows.find(row => row.type === 'City')!];
  assert.ok(ocean.priority > country.priority && country.priority > city.priority, 'class tiers order labels across layers');
  const missing = structuredClone(await recipe());
  missing.highlights.ids.push('1');
  assert.throws(() => loadNaturalEarthRows(earthSource, 'features', parseNaturalEarthConfig(missing)), /highlights are not in a configured layer/u);
});
