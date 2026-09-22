import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { OBJECTS, SCENE_OBJECTS, requireObject, requireSceneObject } from '../objects.mts';
import { objectAdapter } from '../object-adapter.mts';
import { PLANET_SEARCH_OBJECTS } from '../planet-search-objects.mts';
import { readPreparedFocusObjects, prepareSceneDistance, prepareFocusObject } from '../../tools/prepare/prepare-navigation-destinations.mts';
import { normalizeDestinationQuery } from '../destination-search.mts';
import { parsePreparedGalaxyCatalog, resolveSpatialCitation } from '@cssearth/catalog';
import { parseNavigationDistance, distanceDescription } from '../navigation-distance.mts';
import { atlasTree, readObjects, type TreeNode } from '../../atlas/src/objects.mts';
import { applicationTreeDestination } from '../navigation-tree-destination.mts';
import { OVERVIEW_TITLES } from '../prepared-overview-titles.mjs';
import { resolve } from 'node:path';

test('every prepared spatial subject and every scene has exactly one searchable destination', async () => {
  const prepared = await readPreparedFocusObjects(resolve('src/objects'), 'sun');
  assert.equal(OBJECTS.length, SCENE_OBJECTS.length + prepared.length);
  assert.deepEqual(OBJECTS.filter(object => object.kind === 'prepared-focus'), prepared);
  assert.deepEqual(new Set(PLANET_SEARCH_OBJECTS.map(object => object.id)), new Set(OBJECTS.map(object => object.id)));
  assert.deepEqual(objectAdapter.routes(), SCENE_OBJECTS.map(object => object.route));
  assert.equal(requireObject('m_031').kind, 'prepared-focus');
  assert.throws(() => requireSceneObject('m_031'), /not a scene owner/);
  for (const [query, id] of [['Andromeda', 'm_031'], ['M31', 'm_031'], ['LMC', 'lmc'], ['SMC', 'smc'], ['NGC 1976', 'm42'], ['Virgo', 'virgo-cluster']]) {
    const object = requireObject(id!);
    assert.equal(object.kind, 'prepared-focus');
    assert.ok(object.kind === 'prepared-focus' && object.searchNames.some(name => name.includes(normalizeDestinationQuery(query!))), query);
  }
});

test('distance display and order use the prepared position, never the legacy orbital reference', async () => {
  for (const object of SCENE_OBJECTS) {
    const descriptor = JSON.parse(await readFile(`src/objects/${object.id}/object.json`, 'utf8'));
    const distance = prepareSceneDistance(descriptor);
    assert.deepEqual(object.distance, distance, object.id);
    assert.equal(distance.epochJdTt, object.worldFrame?.epochJdTt);
    assert.equal(distance.referencePoint, 'heliocentre');
  }
  const halley = requireSceneObject('comet-1p');
  assert.ok(halley.distance.value > 30 && halley.distance.value < 40);
  assert.match(distanceDescription(halley.distance), /Distance from the Sun at JD/);
  assert.ok(!('distanceAu' in halley));
  assert.ok(PLANET_SEARCH_OBJECTS.every((object, index) => index === 0 || object.distance.meters >= PLANET_SEARCH_OBJECTS[index - 1]!.distance.meters));
  const cluster = requireObject('virgo-cluster');
  assert.equal(cluster.distance.quantity, 'comoving');
  assert.equal(cluster.distance.epochJdTt, null, 'navigation epoch must not become a measured distance epoch');
  assert.match(distanceDescription(cluster.distance), /comoving/);
  assert.throws(() => parseNavigationDistance({ ...cluster.distance, epochJdTt: 2461286.5 }));
  assert.throws(() => parseNavigationDistance({ ...cluster.distance, meters: cluster.distance.meters / 10 }), /inconsistent/);
  assert.throws(() => parseNavigationDistance({ ...cluster.distance, value: Number.MAX_VALUE }), /inconsistent/);
});

test('galaxy citations resolve across the full prepared catalogue, including the separate SMC paper', async () => {
  const raw: unknown = JSON.parse(await readFile('src/objects/local-group/prepared/catalogue.json', 'utf8'));
  const catalogue = parsePreparedGalaxyCatalog(raw);
  for (const galaxy of catalogue.objects) {
    for (const reference of [galaxy.distance.sourceRef, galaxy.skyPosition.sourceRef, galaxy.halfLightRadius?.sourceRef, galaxy.membership.sourceRef]) {
      if (reference) assert.ok(resolveSpatialCitation(reference, catalogue.sources), `${galaxy.id}: ${reference}`);
    }
  }
  assert.equal(resolveSpatialCitation('Graczyk2020ApJ...904...13G', catalogue.sources)?.url, 'https://arxiv.org/abs/2010.08754');
  const galaxy = catalogue.objects[0]!;
  const future = prepareFocusObject({ ...galaxy, id: 'future_galaxy', name: 'Future galaxy', aliases: ['New alias'] }, 'sun');
  assert.equal(future.route, '/sun/?focus=future_galaxy');
  assert.ok(future.searchNames.includes('new alias'));
  const broken = { ...catalogue, objects: [{ ...galaxy, distance: { ...galaxy.distance, sourceRef: 'missing-paper' } }] };
  assert.throws(() => parsePreparedGalaxyCatalog(broken), /Unresolved distance reference/);
});


test('physical hosts remain distinct from scene hosts and M45 retains its measured subject', async () => {
  const raw: unknown = JSON.parse(await readFile('src/objects/local-group/prepared/catalogue.json', 'utf8'));
  const catalogue = parsePreparedGalaxyCatalog(raw), satellite = catalogue.objects.find(o => o.id === 'andromeda_01')!;
  assert.equal(satellite.hostId, 'm_031');
  assert.equal(prepareFocusObject(satellite, 'sun').sceneHostId, 'sun');
  assert.equal(catalogue.unpositionedHosts?.find(o => o.id === 'mw')?.sourceRef, 'lvdb-v1.1.1:mw:name_discovery');
  assert.equal(OBJECTS.some(o => o.id === 'mw'), false, 'a physical host does not fabricate a destination');
  const m45 = OBJECTS.find(o => o.id === 'm45')!;
  assert.equal(m45.distance.subject?.id, 'm45-stellar-cluster');
  assert.match(distanceDescription(m45.distance), /Pleiades stellar cluster/);
  assert.match(distanceDescription(m45.distance), /dust-filament distances are not measured/);
});


test('every row of the application navigation tree opens a route the application serves', () => {
  const rows: TreeNode[] = [];
  const walk = (node: TreeNode) => { if (node.object) rows.push(node); node.children.forEach(walk); };
  atlasTree(readObjects(), applicationTreeDestination).forEach(walk);
  const pages = new Set(objectAdapter.routes());
  const focuses = new Map(OBJECTS.filter(object => object.kind === 'prepared-focus').map(object => [object.id, object.route]));
  const overviews = new Set(Object.keys(OVERVIEW_TITLES));
  assert.ok(rows.length > 400, 'the tree still names every prepared destination');
  for (const row of rows) {
    const id = row.object!.id;
    if (row.href === null) {
      assert.equal(row.focusId, null, id);
      // A package with no destination is a label. Anything the application can open must link to it.
      assert.equal(pages.has(`/${id}/`), false, id);
      assert.equal(focuses.has(id), false, id);
      continue;
    }
    const url = new URL(row.href, 'https://example.test');
    assert.ok(pages.has(url.pathname), `${id} leads to an unserved page: ${row.href}`);
    const focus = url.searchParams.get('focus'), overview = url.searchParams.get('overview');
    assert.equal(focus, row.focusId, `${id} must name the subject it selects in place`);
    if (focus !== null) assert.equal(focuses.get(focus), row.href, `${id} must use the registered focus route`);
    else if (overview !== null) assert.ok(overviews.has(overview), `${id} names an unknown overview: ${overview}`);
    else assert.equal(row.href, `/${id}/`, `${id} must open its own page`);
  }
  // The Atlas site keeps its own route space: one documentation page per package.
  const atlas = new Map<string, string | null>();
  const collect = (node: TreeNode) => { if (node.object) atlas.set(node.object.id, node.href); node.children.forEach(collect); };
  atlasTree(readObjects()).forEach(collect);
  for (const [id, href] of atlas) assert.equal(href, `/${id}/`, id);
});
