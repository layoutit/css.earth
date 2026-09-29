import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { loadNaturalEarthRows, naturalEarthZoomShare, parseNaturalEarthConfig } from '@cssearth/bake/objects/surface-features';

const earthSource = resolve(process.cwd(), 'src/objects/earth/source');
const recipe = async () => JSON.parse(await readFile(resolve(earthSource, 'preparation/features.json'), 'utf8')).naturalEarth;

/** Why the layer test cannot run here: the archives the recipe names that are absent from this checkout. An absent archive is
 * an unrestored download only when Earth's source manifest declares it with an origin; any other absent name (undeclared or
 * misspelled) is a failure, not a skip. `unzip` names no absent path in its error, so the shared helper cannot tell them apart. */
async function unrestoredArchives(archives: readonly string[]): Promise<string | false> {
  const manifest: unknown = JSON.parse(await readFile(resolve(earthSource, 'manifest.json'), 'utf8'));
  const inputs = manifest && typeof manifest === 'object' && 'inputs' in manifest && Array.isArray(manifest.inputs) ? manifest.inputs as unknown[] : [];
  const downloads = new Set(inputs.flatMap(input => input && typeof input === 'object' && 'path' in input && 'origin' in input
    && typeof input.path === 'string' && typeof input.origin === 'string' ? [input.path] : []));
  const missing = archives.map(archive => `features/${archive}`).filter(path => !existsSync(resolve(earthSource, path)));
  const undeclared = missing.filter(path => !downloads.has(path));
  if (undeclared.length) throw new Error(`Natural Earth archives are missing and not declared as downloads in Earth's source manifest: ${undeclared.join(', ')}`);
  return missing.length ? `earth: ${missing.join(', ')} not restored; run node packages/bake/cli/restore-source-inputs.mts --object=earth` : false;
}

test('an absent Natural Earth archive skips only when the source manifest declares it as a download', async () => {
  await assert.rejects(unrestoredArchives(['ne_10m_admin_0_countrys.zip']), /not declared as downloads.*features\/ne_10m_admin_0_countrys\.zip/u);
  const declared = (await recipe()).layers.map((layer: { archive: string }) => layer.archive);
  const reason = await unrestoredArchives(declared);
  assert.ok(reason === false || /not restored/u.test(reason));
});

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

test('the pinned Earth layers keep countries at label points, fold split parts and hide unlisted classes from the map', async t => {
  const unrestored = await unrestoredArchives((await recipe()).layers.map((layer: { archive: string }) => layer.archive));
  if (unrestored) return t.skip(unrestored);
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
