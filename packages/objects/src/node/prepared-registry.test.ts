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

// A level of the zoom ladder is an object: a galaxy whose package also authors its place on the ladder.
const zoom = { enter: { fade: 'system', at: 'end' }, returnBelow: { fade: 'system', at: 'middle' }, frame: { distance: { distancePc: 8000 } } };
const level = (id: string, order: number, classifications: string[]) => {
  const row = { descriptor: descriptor(id, 20 + order, 'galaxy'), distance: parseNavigationDistance(parsec), discovery: discovery(true) };
  return { ...row, descriptor: { ...row.descriptor, properties: { ...row.descriptor.properties, overview: { order, zoom, holds: [{ classifications }], packages: [] } } } };
};
const overview = level('milky-way', 1, ['nebula']);

const scene = (id: string, order: number, classification: string, distanceAu: number, featured: boolean) =>
  ({ descriptor: descriptor(id, order, classification), distance: parseNavigationDistance(au(distanceAu)), discovery: discovery(featured) });
const scenes = [scene('sun', 0, 'star', 0, false), scene('mars', 4, 'planet', 1.5, true)];

async function checkout(records: { scenes?: PreparedCatalogueRow[]; focuses?: unknown[]; levels?: unknown[]; module?: string; overviews?: unknown } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-prepared-registry-'));
  temporary.push(root);
  for (const [id, order, classification] of [['sun', 0, 'star'], ['mars', 4, 'planet']] as const) {
    await mkdir(join(root, 'src/objects', id), { recursive: true });
    await writeFile(join(root, 'src/objects', id, 'object.json'), JSON.stringify(descriptor(id, order, classification)));
  }
  await mkdir(join(root, 'site'));
  // The catalogue order is the order prepare:catalog wrote, not the alphabetical one.
  await writeFile(join(root, PREPARED_CATALOGUE.entries), records.module ??
    preparedCatalogueModule([...records.scenes ?? scenes, ...records.focuses ?? [focus], ...records.levels ?? [overview]] as PreparedCatalogueRow[]));
  await writeFile(join(root, PREPARED_CATALOGUE.overviews), JSON.stringify(records.overviews ?? records.levels ?? [overview]));
  return root;
}

test('reads the registry in catalogue order, with distances, discoveries and overviews', async () => {
  const registry = readPreparedObjects(await checkout());
  assert.deepEqual(registry.objects.map(object => object.id), ['sun', 'mars', 'helix', 'milky-way']);
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
  assert.equal(registry.worldObjects, registry.objects);
  const helix = registry.objects.find(object => object.id === 'helix')!;
  assert.partialDeepStrictEqual(helix, { classification: 'nebula', route: '/helix/', systemName: 'Solar System' });
  // A level is one of the objects, with a scene of its own; the ladder reads it from the registry.
  assert.equal(registry.requireSceneObject('milky-way').id, 'milky-way');
  assert.equal(registry.objects.find(object => object.id === 'milky-way')?.level?.order, 1);
  const two = readPreparedObjects(await checkout({ levels: [level('local-group', 2, ['galaxy']), overview] }));
  assert.deepEqual(two.levels.map(level => level.id), ['milky-way', 'local-group']);
  // The levels file repeats rows of the catalogue: a row it alone holds is refused.
  const stray = await checkout({ overviews: [overview, level('local-group', 2, ['galaxy'])] });
  assert.throws(() => readPreparedObjects(stray), /local-group is not a level object/);
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
