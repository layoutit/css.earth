import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { OBJECTS, SCENE_OBJECTS, requireObject, requireSceneObject } from '../objects.mts';
import { objectAdapter } from '../object-adapter.mts';
import { PLANET_SEARCH_OBJECTS } from '../planet-search-objects.mts';
import { readPreparedFocusObjects, prepareSceneDistance, prepareFocusObject } from '../../tools/prepare-navigation-destinations.mts';
import { normalizeDestinationQuery } from '../destination-search.mts';
import { parsePreparedGalaxyCatalog, resolveSpatialCitation } from '@cssearth/catalog';
import { parseNavigationDistance, distanceDescription } from '../navigation-distance.mts';
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
