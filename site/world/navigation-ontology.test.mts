import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { OBJECTS, SCENE_OBJECTS, ancestorsOf, requireObject } from '../directory/objects.mts';
import { objectAdapter } from '../scene/object-adapter.mts';
import { SEARCH_OBJECTS } from '../search/search-objects.mts';
import { prepareSceneDistance } from '@cssearth/bake/navigation';
import { readObjectDescriptors } from '@cssearth/objects/node';
import { distanceDescription, isExtendedClassification, normalizeDestinationQuery, parseNavigationDistance, parsePreparedGalaxyCatalog } from '@cssearth/objects';
import { isRecord } from '@cssearth/core';
import { resolveSpatialCitation } from '@cssearth/catalog';
import { resolve } from 'node:path';
import { systemHostId, systemObjectId } from '../model/system-address.mts';

test('every scene and every package the host draws has exactly one searchable destination, built from its own descriptor', async () => {
  const descriptors = await readObjectDescriptors(resolve('src/objects'));
  // A galaxy, a nebula or a cluster is an authored object like any body: its recipe declares no surface.
  const hosted = [...descriptors].filter(([, descriptor]) => isRecord(descriptor) && isRecord(descriptor.properties) && isRecord(descriptor.properties.recipe)
    && Array.isArray(descriptor.properties.recipe.surfaces) && !descriptor.properties.recipe.surfaces.length).map(([id]) => id);
  // Galaxies, nebulae and clusters, the four objects seen from inside, and five places of the Nearby Universe (the Shapley
  // Supercluster, the Hercules and Leo clusters, the Great Attractor and the Local Void) that show its galaxy field.
  assert.equal(hosted.length, 164);
  // A bank is context the world draws, never an object: none carries a catalogue entry.
  for (const [id, descriptor] of descriptors) if (isRecord(descriptor) && typeof descriptor.type === 'string' && /-bank$/u.test(descriptor.type)) assert.ok(isRecord(descriptor.properties) && descriptor.properties.catalog === undefined, id);
  // The registry holds objects only. An object seen from inside is one of them, and so is a system: a host with the bodies
  // that orbit it, with an address and a page of its own, which mounts its host's scene (navigation/system-address.mts).
  const systems = OBJECTS.filter(object => object.system);
  assert.deepEqual(SCENE_OBJECTS, OBJECTS.filter(object => !object.system));
  assert.ok(systems.length > 700 && systems.some(object => object.id === 'solar-system') && systems.some(object => object.id === 'jupiter-system'));
  const starSystems = new Set(systems.filter(object => object.classification === 'star-system').map(object => object.name));
  for (const name of ['61 Cygni system', '70 Ophiuchi system', 'Alpha Centauri system', 'GJ 338 system', 'Struve 2398 system', 'Sirius system']) assert.ok(starSystems.has(name), name);
  assert.equal(requireObject('trappist-1-system').classification, 'planetary-system');
  for (const system of systems) {
    const host = requireObject(system.system!.host);
    assert.equal(system.id, systemObjectId(host.id), `${system.id} is named after its host`);
    assert.equal(system.route, `/${system.id}/`);
    // What kind of system it is is its classification: a planet's or small body's moons, a star with only stars inside its
    // system, or a star with a planet.
    const inside = OBJECTS.filter(object => object.parent === system.id && object.id !== host.id);
    if (!['star', 'black-hole'].includes(host.classification)) assert.equal(system.classification, 'satellite-system', system.id);
    else if (inside.some(object => !['star', 'black-hole'].includes(object.classification))) assert.equal(system.classification, 'planetary-system', system.id);
    else if (inside.length) assert.equal(system.classification, 'star-system', system.id);
    else assert.ok(['star-system', 'planetary-system'].includes(system.classification), system.id);
    assert.equal(host.system, undefined, `${host.id} hosts a system and is not one`);
  }
  // No other object's id reads as a system's.
  for (const object of SCENE_OBJECTS) assert.equal(systemHostId(object.id), null, object.id);
  for (const id of hosted) assert.equal(requireObject(id).id, id);
  // The objects seen from inside author their zoom facts; the order the view hands over in is the tree: Earth's ancestors.
  const inside = OBJECTS.filter(object => object.zoom);
  assert.deepEqual(new Set(inside.map(object => object.id)), new Set(['milky-way', 'local-group', 'nearby-universe', 'observable-universe']));
  assert.deepEqual(ancestorsOf('earth').map(object => object.id), ['earth-system', 'solar-system', 'milky-way', 'local-group', 'nearby-universe', 'observable-universe']);
  for (const object of inside) {
    assert.equal(object.route, `/${object.id}/`);
    // The banks the world draws for it name it as their host, and none of those is an object.
    for (const [id, descriptor] of descriptors) {
      if (isRecord(descriptor) && isRecord(descriptor.properties) && descriptor.properties.host === object.id) assert.equal(OBJECTS.some(candidate => candidate.id === id), false, `${object.id} hosts ${id}`);
    }
  }
  const sitemap = await (await import('../pages/sitemap.xml.ts')).GET().text();
  for (const object of inside) assert.equal(sitemap.split(`/${object.id}/</loc>`).length, 2, `${object.id} is in the sitemap once`);
  // The site's own address leads: it was absent, and it is the page a search result should name (2026-10-01).
  assert.ok(sitemap.includes('<url><loc>https://css.earth/</loc></url>'));
  // Every object is searched through the catalogue.
  assert.deepEqual(new Set(SEARCH_OBJECTS.map(object => object.id)), new Set(OBJECTS.map(object => object.id)));
  assert.deepEqual(objectAdapter.routes(SCENE_OBJECTS), SCENE_OBJECTS.map(object => object.route));
  assert.equal(requireObject('m31').id, 'm31');
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
  const halley = requireObject('comet-1p');
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
  assert.equal(requireObject('milky-way').classification, 'galaxy', 'the Milky Way row is detailed by its object');
  const m45 = OBJECTS.find(o => o.id === 'm45')!;
  assert.equal(m45.distance.subject?.id, 'm45-stellar-cluster');
  assert.match(distanceDescription(m45.distance), /Pleiades stellar cluster/);
  assert.match(distanceDescription(m45.distance), /dust-filament distances are not measured/);
});


test('every object is inside exactly one object, and the Observable Universe is the root', async () => {
  const byId = new Map(OBJECTS.map(object => [object.id, object]));
  assert.deepEqual(OBJECTS.filter(object => object.parent === undefined).map(object => object.id), ['observable-universe']);
  for (const object of OBJECTS) {
    if (object.parent !== undefined) assert.ok(byId.has(object.parent), `${object.id} is inside ${object.parent}`);
    assert.equal(ancestorsOf(object.id).at(-1)?.id ?? object.id, 'observable-universe', object.id);
  }
  // A body with a system of its own is inside it, and the system sits where the body would.
  for (const system of OBJECTS.filter(object => object.system)) assert.equal(requireObject(system.system!.host).parent, system.id, system.id);
  // Every body an orbit graph gives a star's system is inside that system in the tree.
  const { allPlanetarySystems } = await import('./systems/object-systems.mts');
  for (const system of allPlanetarySystems(SCENE_OBJECTS)) {
    const inside = requireObject(system.id).parent!;
    for (const member of system.memberIds) if (byId.has(member)) assert.ok(ancestorsOf(member).some(object => object.id === inside), `${member} orbits ${system.id} and is inside ${inside}`);
  }
  const chain = (id: string) => ancestorsOf(id).map(object => object.id);
  assert.deepEqual(chain('moon'), ['earth-system', 'solar-system', 'milky-way', 'local-group', 'nearby-universe', 'observable-universe']);
  assert.deepEqual(chain('trappist-1b').slice(0, 2), ['trappist-1-system', 'milky-way']);
  // McConnachie (2012): the Magellanic Clouds are in the Milky Way's subgroup, Triangulum in Andromeda's.
  assert.deepEqual(chain('lmc').slice(0, 2), ['milky-way', 'local-group']);
  assert.deepEqual(chain('m33').slice(0, 2), ['m31', 'local-group']);
  // Cosmicflows-4 groups: M87 is in Virgo, which is inside the Nearby Universe, not the Local Group.
  assert.deepEqual(chain('m87-star'), ['m87', 'virgo-cluster', 'nearby-universe', 'observable-universe']);
  assert.deepEqual(chain('hv-2827').slice(0, 2), ['lmc', 'milky-way']);
  assert.deepEqual(chain('abell-2744'), ['observable-universe']);
});
