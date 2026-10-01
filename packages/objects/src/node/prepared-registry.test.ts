import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { parseNavigationDistance } from '../registry/index.js';
import { PREPARED_CATALOGUE, preparedCatalogueModule, readPreparedObjects } from './prepared-registry.js';
import type { PreparedCatalogueRow } from './prepared-registry.js';

// Temporary checkouts the tests make, removed once the file's tests finish.
const temporary: string[] = [];
after(() => Promise.all(temporary.map(path => rm(path, { recursive: true, force: true }))));

const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0], presentationToReference: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  metersPerUnit: 1, bodyRadiusM: 1 };
const descriptor = (id: string, order: number, classification: string) => ({ schema: 'cssearth-object@2', id, properties: {
  catalog: { name: id, systemName: 'Solar System', classification, color: '#aabbcc', distanceAu: 1, description: `The ${id}.`, order, context: { name: id } },
  worldFrame: frame } });
const au = (value: number) => ({ meters: value * 149597870700, value, unit: 'AU', quantity: 'geometric', referencePoint: 'heliocentre', epochJdTt: 2461286.5 });
const discovery = (featured: boolean) => ({ featured, imagery: featured, illustration: false });
const parsec = { meters: 3.085677581491367e16, value: 1, unit: 'pc', quantity: 'catalogue', referencePoint: 'observer', epochJdTt: null };
// A nebula: an object like any body, placed by a catalogue distance.
const hosted = (id: string) => ({ descriptor: descriptor(id, 9, 'nebula'), distance: parseNavigationDistance(parsec), discovery: discovery(false) });
const focus = hosted('helix');

const level = (id: string, name: string) => ({ schema: 'cssearth-object@2', id, type: 'density-volume', properties: { overview: { name, description: 'Our galaxy.', order: 1,
  zoom: { enter: { fade: 'system', at: 'end' }, returnBelow: { fade: 'system', at: 'middle' }, frame: { distance: { distancePc: 8000 } } },
  holds: [{ classifications: ['nebula'] }], packages: [] } } });
const overview = { descriptor: level('milky-way', 'Milky Way') };

const scene = (id: string, order: number, classification: string, distanceAu: number, featured: boolean) =>
  ({ descriptor: descriptor(id, order, classification), distance: parseNavigationDistance(au(distanceAu)), discovery: discovery(featured) });
const scenes = [scene('sun', 0, 'star', 0, false), scene('mars', 4, 'planet', 1.5, true)];

async function checkout(records: { scenes?: PreparedCatalogueRow[]; focuses?: unknown[]; module?: string; overviews?: unknown } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-prepared-registry-'));
  temporary.push(root);
  for (const [id, order, classification] of [['sun', 0, 'star'], ['mars', 4, 'planet']] as const) {
    await mkdir(join(root, 'src/objects', id), { recursive: true });
    await writeFile(join(root, 'src/objects', id, 'object.json'), JSON.stringify(descriptor(id, order, classification)));
  }
  await mkdir(join(root, 'site'));
  // The catalogue order is the order prepare:catalog wrote, not the alphabetical one.
  await writeFile(join(root, PREPARED_CATALOGUE.entries), records.module ??
    preparedCatalogueModule([...records.scenes ?? scenes, ...records.focuses ?? [focus]] as PreparedCatalogueRow[]));
  await writeFile(join(root, PREPARED_CATALOGUE.overviews), JSON.stringify(records.overviews ?? [overview]));
  return root;
}

test('reads the registry in catalogue order, with distances, discoveries and overviews', async () => {
  const registry = readPreparedObjects(await checkout());
  assert.deepEqual(registry.objects.map(object => object.id), ['sun', 'mars', 'helix']);
  assert.equal(registry.sceneObjects, registry.objects);
  assert.deepEqual(registry.levels.map(level => level.id), ['milky-way']);
  const mars = registry.requireSceneObject('mars');
  assert.equal(mars.distance.value, 1.5);
  assert.equal(mars.discovery.featured, true);
  assert.equal(mars.route, '/mars/');
  // The catalogue's order and context stay out of the registry, as the application registry leaves them out.
  assert.ok(!('order' in mars) && !('context' in mars));
  await assert.rejects(mars.loadScene(), /cannot mount a scene/);
  // A nebula is a scene and a body of the world like any other.
  assert.equal(registry.requireSceneObject('helix').id, 'helix');
  assert.deepEqual(registry.worldObjects.map(object => object.id), ['sun', 'mars', 'helix']);
  const helix = registry.objects.find(object => object.id === 'helix')!;
  // A level with a catalogue entry is a body of the world too. It is still a level, not an object.
  const placedLevel = { descriptor: { ...hosted('local-group').descriptor, type: 'galaxy-catalog', properties: { ...hosted('local-group').descriptor.properties,
    overview: { order: 2, zoom: level('x', 'x').properties.overview.zoom, holds: [{ classifications: ['galaxy'] }] } } },
    distance: parseNavigationDistance(parsec), discovery: discovery(true) };
  const placed = readPreparedObjects(await checkout({ overviews: [overview, placedLevel] }));
  assert.deepEqual(placed.worldObjects.map(object => object.id), ['sun', 'mars', 'helix', 'local-group']);
  assert.deepEqual(placed.levels.map(level => level.id), ['milky-way', 'local-group']);
  assert.deepEqual(placed.objects.map(object => object.id), ['sun', 'mars', 'helix']);
  assert.partialDeepStrictEqual(helix, { classification: 'nebula', route: '/helix/', systemName: 'Solar System' });
  assert.throws(() => registry.requireSceneObject('milky-way'), /no scene of its own/);
  assert.throws(() => registry.requireSceneObject('pluto'), /Unknown/);
});

test('reads each checkout once per process', async () => {
  const root = await checkout();
  assert.equal(readPreparedObjects(root), readPreparedObjects(join(root, 'site', '..')));
});

test('refuses a catalogue it cannot decode or a level without its host', async () => {
  const cases: [Parameters<typeof checkout>[0], RegExp][] = [
    [{ scenes: [...scenes, { ...scenes[1]!, descriptor: { id: 'pluto' } }] }, /Invalid catalogue entry/],
    [{ scenes: [{ ...scenes[0]!, discovery: { featured: 'yes' } as never }] }, /Invalid prepared object discovery/],
    [{ focuses: [{ ...focus, descriptor: null }] }, /Invalid catalogue entry/],
    [{ module: 'export const OTHER = [];\n' }, /exports no CATALOGUE_ENTRIES array/],
    [{ overviews: {} }, /overviews/],
  ];
  for (const [records, error] of cases) {
    const root = await checkout(records);
    assert.throws(() => readPreparedObjects(root), error);
  }
});
