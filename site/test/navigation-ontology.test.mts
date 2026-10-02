import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { OBJECTS, OVERVIEWS, SCENE_OBJECTS, requireObject, requireSceneObject } from '../objects.mts';
import { objectAdapter } from '../object-adapter.mts';
import { SEARCH_OBJECTS } from '../search/search-objects.mts';
import { prepareSceneDistance } from '@cssearth/bake/navigation';
import { readObjectDescriptors, readOverviews } from '@cssearth/objects/node';
import { distanceDescription, isExtendedClassification, normalizeDestinationQuery, parseNavigationDistance } from '@cssearth/objects';
import { isRecord } from '@cssearth/core';
import { parsePreparedGalaxyCatalog, resolveSpatialCitation } from '@cssearth/catalog';
import { resolve } from 'node:path';

test('every scene and every package the host draws has exactly one searchable destination, built from its own descriptor', async () => {
  const descriptors = await readObjectDescriptors(resolve('src/objects'));
  // A galaxy, a nebula or a cluster is an authored object like any body: its recipe declares no surface.
  const hosted = [...descriptors].filter(([, descriptor]) => isRecord(descriptor) && isRecord(descriptor.properties) && isRecord(descriptor.properties.recipe)
    && Array.isArray(descriptor.properties.recipe.surfaces) && !descriptor.properties.recipe.surfaces.length).map(([id]) => id);
  // 30 galaxies, nebulae and clusters, and the four levels of the zoom ladder.
  assert.equal(hosted.length, 34);
  // A bank is context the world draws, never an object: none carries a catalogue entry.
  for (const [id, descriptor] of descriptors) if (isRecord(descriptor) && typeof descriptor.type === 'string' && /-bank$/u.test(descriptor.type)) assert.ok(isRecord(descriptor.properties) && descriptor.properties.catalog === undefined, id);
  const overviews = await readOverviews(resolve('src/objects'));
  // The registry holds objects only, each with its own scene. A level of the zoom ladder is one of them.
  assert.equal(OBJECTS, SCENE_OBJECTS);
  for (const id of hosted) assert.equal(requireSceneObject(id).id, id);
  assert.deepEqual(OVERVIEWS.map(level => level.id), overviews.map(overview => overview.id));
  assert.deepEqual(OVERVIEWS.map(level => level.id), ['milky-way', 'local-group', 'nearby-universe', 'observable-universe']);
  for (const level of OVERVIEWS) {
    const object = requireSceneObject(level.id);
    assert.equal(object.route, `/${level.id}/`);
    assert.deepEqual(object.level?.zoom, level.zoom);
    // Each names the context packages the world draws for it, and none of those is an object.
    for (const id of level.packages) assert.equal(OBJECTS.some(candidate => candidate.id === id), false, `${level.id} draws ${id}`);
  }
  const sitemap = await (await import('../pages/sitemap.xml.ts')).GET().text();
  for (const level of OVERVIEWS) assert.equal(sitemap.split(`/${level.id}/</loc>`).length, 2, `${level.id} is in the sitemap once`);
  // The site's own address leads: it was absent, and it is the page a search result should name (2026-10-01).
  assert.ok(sitemap.includes('<url><loc>https://css.earth/</loc></url>'));
  // Every object is searched through the catalogue, the levels included.
  assert.deepEqual(new Set(SEARCH_OBJECTS.map(object => object.id)), new Set(OBJECTS.map(object => object.id)));
  assert.deepEqual(objectAdapter.routes(SCENE_OBJECTS), SCENE_OBJECTS.map(object => object.route));
  assert.equal(requireSceneObject('m31').id, 'm31');
  for (const [query, id] of [['Andromeda', 'm31'], ['M31', 'm31'], ['LMC', 'lmc'], ['SMC', 'smc'], ['NGC 1976', 'm42'], ['Virgo', 'virgo-cluster']]) {
    const object = requireObject(id!);
    assert.ok((object.searchNames ?? []).some(name => name.includes(normalizeDestinationQuery(query!))), query);
  }
  // Each is placed by its own world frame; only a scale of the universe centred on the observer sits at the origin.
  for (const id of hosted) {
    const object = requireObject(id);
    assert.ok(isExtendedClassification(object.classification), id);
    assert.equal(Math.hypot(...object.worldFrame.originM) > 0, !['nearby-universe', 'observable-universe'].includes(id), id);
  }
});

test('distance display and order use the prepared position, never the legacy orbital reference', async () => {
  for (const object of SCENE_OBJECTS) {
    const descriptor = JSON.parse(await readFile(`src/objects/${object.id}/object.json`, 'utf8'));
    const distance = prepareSceneDistance(descriptor);
    assert.deepEqual(object.distance, distance, object.id);
    // A body on an orbit has a distance at the frame's epoch; one placed by a catalogue distance has no epoch.
    assert.equal(distance.epochJdTt, distance.quantity === 'catalogue' ? null : object.worldFrame?.epochJdTt, object.id);
    assert.equal(distance.referencePoint, distance.quantity === 'catalogue' ? 'observer' : 'heliocentre', object.id);
  }
  const halley = requireSceneObject('comet-1p');
  assert.ok(halley.distance.value > 30 && halley.distance.value < 40);
  assert.match(distanceDescription(halley.distance), /Distance from the Sun at JD/);
  assert.ok(!('distanceAu' in halley));
  assert.ok(SEARCH_OBJECTS.every((object, index) => index === 0 || object.distance.meters >= SEARCH_OBJECTS[index - 1]!.distance.meters));
  const cluster = requireObject('virgo-cluster');
  // A cluster sits at its Cosmicflows-4 group's measured distance, a catalogue distance, not its redshift's comoving one.
  assert.equal(cluster.distance.quantity, 'catalogue');
  assert.equal(cluster.distance.epochJdTt, null, 'navigation epoch must not become a measured distance epoch');
  assert.match(distanceDescription(cluster.distance), /adopted from the catalogue/);
  assert.throws(() => parseNavigationDistance({ ...cluster.distance, epochJdTt: 2461286.5 }));
  assert.throws(() => parseNavigationDistance({ ...cluster.distance, meters: cluster.distance.meters / 10 }), /inconsistent/);
  assert.throws(() => parseNavigationDistance({ ...cluster.distance, value: Number.MAX_VALUE }), /inconsistent/);
});

test('galaxy citations resolve across the full prepared catalogue, including the separate SMC paper', async () => {
  const raw: unknown = JSON.parse(await readFile('src/objects/local-group-galaxies/prepared/catalogue.json', 'utf8'));
  const catalogue = parsePreparedGalaxyCatalog(raw);
  for (const galaxy of catalogue.objects) {
    for (const reference of [galaxy.distance.sourceRef, galaxy.skyPosition.sourceRef, galaxy.halfLightRadius?.sourceRef, galaxy.membership.sourceRef]) {
      if (reference) assert.ok(resolveSpatialCitation(reference, catalogue.sources), `${galaxy.id}: ${reference}`);
    }
  }
  assert.equal(resolveSpatialCitation('Graczyk2020ApJ...904...13G', catalogue.sources)?.url, 'https://arxiv.org/abs/2010.08754');
  const galaxy = catalogue.objects[0]!;
  const broken = { ...catalogue, objects: [{ ...galaxy, distance: { ...galaxy.distance, sourceRef: 'missing-paper' } }] };
  assert.throws(() => parsePreparedGalaxyCatalog(broken), /Unresolved distance reference/);
});


test('physical hosts remain distinct from scene hosts and M45 retains its measured subject', async () => {
  const raw: unknown = JSON.parse(await readFile('src/objects/local-group-galaxies/prepared/catalogue.json', 'utf8'));
  const catalogue = parsePreparedGalaxyCatalog(raw), satellite = catalogue.objects.find(o => o.id === 'andromeda_01')!;
  assert.equal(satellite.hostId, 'm31', 'a host its object package details takes the package id');
  assert.equal(OBJECTS.some(o => o.id === satellite.id), false, 'a catalogue row without a package is data, never a destination');
  // The Milky Way row is detailed by the milky-way package, so it carries that id; its LVDB key stays in its source reference.
  assert.equal(catalogue.unpositionedHosts?.find(o => o.id === 'milky-way')?.sourceRef, 'lvdb-v1.1.1:mw:name_discovery');
  assert.equal(requireObject('milky-way').classification, 'galaxy', 'the Milky Way row is detailed by its object, which is also a level');
  const m45 = OBJECTS.find(o => o.id === 'm45')!;
  assert.equal(m45.distance.subject?.id, 'm45-stellar-cluster');
  assert.match(distanceDescription(m45.distance), /Pleiades stellar cluster/);
  assert.match(distanceDescription(m45.distance), /dust-filament distances are not measured/);
});

