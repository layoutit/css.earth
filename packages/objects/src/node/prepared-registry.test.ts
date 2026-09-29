import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFinished, test } from 'vitest';
import { PREPARED_CATALOGUE, readPreparedObjects } from './prepared-registry.js';

const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0], presentationToReference: [1, 0, 0, 0, 0, 1, 0, 1, 0],
  metersPerUnit: 1, bodyRadiusM: 1 };
const descriptor = (id: string, order: number, classification: string) => ({ schema: 'cssearth-object@1', id, properties: {
  catalog: { name: id, systemName: 'Solar System', classification, color: '#aabbcc', distanceAu: 1, description: `The ${id}.`, order, context: { name: id } },
  worldFrame: frame } });
const au = (value: number) => ({ meters: value * 149597870700, value, unit: 'AU', quantity: 'geometric', referencePoint: 'heliocentre', epochJdTt: 2461286.5 });
const discovery = (featured: boolean) => ({ featured, imagery: featured, illustration: false });
const focus = { kind: 'prepared-focus', id: 'helix', focusId: 'helix', name: 'Helix Nebula', searchNames: ['helix'], classification: 'nebula',
  systemName: 'Milky Way', route: '/helix/', sceneHostId: 'sun',
  distance: { meters: 3.085677581491367e16, value: 1, unit: 'pc', quantity: 'catalogue', referencePoint: 'observer', epochJdTt: null } };

async function checkout(records: { distances?: unknown; discoveries?: unknown; focuses?: unknown } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-prepared-registry-'));
  onTestFinished(() => rm(root, { force: true, recursive: true }));
  for (const [id, order, classification] of [['sun', 0, 'star'], ['mars', 4, 'planet']] as const) {
    await mkdir(join(root, 'src/objects', id), { recursive: true });
    await writeFile(join(root, 'src/objects', id, 'object.json'), JSON.stringify(descriptor(id, order, classification)));
  }
  await mkdir(join(root, 'site'));
  // The catalogue order is the order prepare:catalog wrote, not the alphabetical one.
  const written = { distances: { sun: au(0), mars: au(1.5) }, discoveries: { sun: discovery(false), mars: discovery(true) }, focuses: [focus], ...records };
  for (const [name, value] of Object.entries(written)) await writeFile(join(root, PREPARED_CATALOGUE[name as keyof typeof PREPARED_CATALOGUE]), JSON.stringify(value));
  return root;
}

test('reads the registry in catalogue order, with distances, discoveries and prepared focuses', async () => {
  const registry = readPreparedObjects(await checkout());
  assert.deepEqual(registry.objects.map(object => object.id), ['sun', 'mars', 'helix']);
  assert.deepEqual(registry.sceneObjects.map(object => object.id), ['sun', 'mars']);
  const mars = registry.requireSceneObject('mars');
  assert.equal(mars.distance.value, 1.5);
  assert.equal(mars.discovery.featured, true);
  assert.equal(mars.route, '/mars/');
  // The catalogue's order and context stay out of the registry, as the application registry leaves them out.
  assert.ok(!('order' in mars) && !('context' in mars));
  await assert.rejects(mars.loadScene(), /cannot mount a scene/);
  assert.throws(() => registry.requireSceneObject('helix'), /prepared focus/);
  assert.throws(() => registry.requireSceneObject('pluto'), /Unknown/);
});

test('reads each checkout once per process', async () => {
  const root = await checkout();
  assert.equal(readPreparedObjects(root), readPreparedObjects(join(root, 'site', '..')));
});

test('refuses catalogue records that disagree or a focus without its host', async () => {
  const cases: [Parameters<typeof checkout>[0], RegExp][] = [
    [{ discoveries: { sun: discovery(false) } }, /list different objects/],
    [{ discoveries: { sun: discovery(false), pluto: discovery(false) } }, /list different objects/],
    [{ distances: { sun: au(0), mars: au(1.5), pluto: au(39) }, discoveries: { sun: discovery(false), mars: discovery(true), pluto: discovery(false) } }, /Cannot find module|ENOENT/],
    [{ focuses: [{ ...focus, sceneHostId: 'mars', route: '/helix/' }, { ...focus, id: 'm1', focusId: 'm1', route: '/m1/', sceneHostId: 'jupiter' }] }, /not a registered scene: m1/],
    [{ focuses: {} }, /focuses/],
  ];
  for (const [records, error] of cases) {
    const root = await checkout(records);
    assert.throws(() => readPreparedObjects(root), error);
  }
});
