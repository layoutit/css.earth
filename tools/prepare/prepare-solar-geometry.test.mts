import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadSceneEpochEphemeris, SCENE_EPHEMERIS_DIRECTORY } from '../../packages/astronomy/tools/scene-ephemeris.mts';
import { loadAstronomyPackage } from '../../src/platform/astronomy-package.mts';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import * as geometry from '../../src/platform/solar-geometry.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../sources/source-values.mts';
import { parseSolidPreparationSource } from '../objects/terrestrial-layers/profile-source.mts';
import { parseSolidReplayScene } from '../prepared/prepared-replay-source.mts';
import { requireObjectRuntimeDefinition } from '../contract/object-runtime-contract.mts';

type Vector = readonly number[];
type EpochStateSource = { centerBodyId: string; positionKm: Vector; parentHeliocentricState: { positionKm: Vector; velocityKmPerDay: Vector } };
const requireSnapshot = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new TypeError(`${label} is missing.`);
  return value;
};
const requireVector = (value: unknown, label: string): Vector => requireArray(value, label).map((component, index) => requireFiniteNumber(component, `${label}[${index}]`));
const requireEpochState = (value: unknown, label: string): EpochStateSource => {
  const record = requireRecord(value, label), parent = requireRecord(record.parentHeliocentricState, `${label} parent heliocentric state`);
  return { centerBodyId: requireString(record.centerBodyId, `${label} center body`), positionKm: requireVector(record.positionKm, `${label} position`),
    parentHeliocentricState: { positionKm: requireVector(parent.positionKm, `${label} parent position`), velocityKmPerDay: requireVector(parent.velocityKmPerDay, `${label} parent velocity`) } };
};

const epoch = geometry.SOLAR_GEOMETRY_EPOCH_JD_TT;
const snapshots = await loadSceneEpochEphemeris(epoch);
const astronomy = await loadAstronomyPackage();
const apply = (m: Vector, v: Vector): number[] => [0, 1, 2].map(row => v.reduce((sum, value, column) => sum + requireSnapshot(m[row * 3 + column], 'matrix value') * value, 0));
const sub = (a: Vector, b: Vector): number[] => a.map((value, i) => value - requireSnapshot(b[i], 'vector value'));
const scale = (v: Vector, k: number): number[] => v.map(value => value * k);
const unit = (v: Vector): number[] => scale(v, 1 / Math.hypot(...v));
const cross = (a: Vector, b: Vector): number[] => [requireSnapshot(a[1], 'cross x')*requireSnapshot(b[2], 'cross z')-requireSnapshot(a[2], 'cross y')*requireSnapshot(b[1], 'cross y'), requireSnapshot(a[2], 'cross y')*requireSnapshot(b[0], 'cross x')-requireSnapshot(a[0], 'cross x')*requireSnapshot(b[2], 'cross z'), requireSnapshot(a[0], 'cross x')*requireSnapshot(b[1], 'cross y')-requireSnapshot(a[1], 'cross y')*requireSnapshot(b[0], 'cross x')];
const heliocentricKm = (id: string): number[] => {
  const orbit = requireSnapshot(geometry.BODY_ORBITS[id], `${id} orbit`);
  return scale(apply(requireSnapshot(geometry.BODY_FIXED_TO_ICRF_MATRICES[id], `${id} body-fixed matrix`), requireSnapshot(geometry.BODY_FIXED_SUN_DIRECTIONS[id], `${id} Sun direction`)),
    -orbit.heliocentricDistanceAu * geometry.ASTRONOMICAL_UNIT_KILOMETERS);
};

test('primary-specific companion sources define one global parent origin and conic at the scene epoch', async () => {
  for (const id of ['hiiaka', 'menoetius', 'romulus'] as const) {
    const source = requireEpochState(JSON.parse(await readFile(new URL(`../../src/objects/${id}/source/validation/epoch-state.json`, import.meta.url), 'utf8')), `${id} epoch state`);
    const parent = source.centerBodyId, primary = source.parentHeliocentricState;
    assert.deepEqual(requireSnapshot(geometry.BODY_HELIOCENTRIC_STATES[parent], `${parent} heliocentric state`).positionKm, primary.positionKm);
    assert.deepEqual(requireSnapshot(geometry.BODY_HELIOCENTRIC_STATES[parent], `${parent} heliocentric state`).velocityKmPerDay, primary.velocityKmPerDay);
    const relative = sub(heliocentricKm(id), primary.positionKm);
    assert.ok(Math.hypot(...sub(relative, source.positionKm)) < .00001, `${id}: global center composition`);
    if (geometry.BODY_ORBITS[parent] !== undefined) {
      assert.ok(Math.hypot(...sub(heliocentricKm(parent), primary.positionKm)) < .00001, `${parent}: visible body shares the primary origin`);
      const normal = unit(apply(requireSnapshot(geometry.BODY_FIXED_TO_ICRF_MATRICES[parent], `${parent} body-fixed matrix`), requireSnapshot(geometry.BODY_FIXED_ORBIT_NORMAL_DIRECTIONS[parent], `${parent} orbit normal`)));
      assert.ok(Math.hypot(...sub(normal, unit(cross(primary.positionKm, primary.velocityKmPerDay)))) < 1e-12, `${parent}: conic uses source velocity`);
      assert.equal(requireSnapshot(new Map(Object.entries(geometry.BODY_POSITION_PROVENANCE)).get(parent), `${parent} position provenance`).sha256, requireSnapshot(geometry.BODY_HELIOCENTRIC_STATES[parent], `${parent} heliocentric state`).provenance.sha256);
    }
  }
  assert.ok(geometry.BODY_ORBITS.patroclus, 'the explicit Patroclus package shares the existing primary-specific origin');
});

for (const id of ['phobos', 'mimas', 'janus', 'epimetheus', 'helene', 'triton'] as const) {
  test(`${id}: the published position and orbit plane reproduce retained Horizons, not the displaced compact fit`, () => {
    const source = requireSnapshot(snapshots.get(id), `${id} snapshot`);
    const matrix = requireSnapshot(geometry.BODY_FIXED_TO_ICRF_MATRICES[id], `${id} body-fixed matrix`);
    const local = scale(apply(matrix, requireSnapshot(requireSnapshot(geometry.BODY_ORBITS[id], `${id} orbit`).centerPositionAu, `${id} body-centered orbit position`)), -geometry.ASTRONOMICAL_UNIT_KILOMETERS);
    assert.ok(Math.hypot(...sub(local, source.positionKm)) < 1e-8, 'body-centered stored orbit matches independent source state');
    assert.ok(Math.hypot(...sub(unit(apply(matrix, geometry.BODY_FIXED_ORBIT_NORMAL_DIRECTIONS[id])),
      unit(cross(source.positionKm, source.velocityKmPerDay)))) < 1e-12, 'velocity belongs to the same source state');
    const relative = sub(heliocentricKm(id), heliocentricKm(source.centerBodyId));
    assert.ok(Math.hypot(...sub(relative, source.positionKm)) < .00001, 'heliocentric frame translation preserves the corrected parent-relative position');
    const old = astronomy.satellitePositionKm(id, epoch);
    assert.ok(Math.hypot(...sub(old, source.positionKm)) > 500, 'regression fixture exercises a significant old fit error');
  });
}

test('all retained body centers are composed with their named parent at the fixed epoch', () => {
  for (const [id, source] of snapshots) {
    const parent = source.centerBodyId === 'sun' ? [0, 0, 0] : heliocentricKm(source.centerBodyId);
    const relative = sub(heliocentricKm(id), parent);
    assert.ok(Math.hypot(...sub(relative, source.positionKm)) < 0.00001, `${id}: wrong center or stale position`);
  }
  const emb = scale(astronomy.systemBarycentreHeliocentricAu('emb', epoch), geometry.ASTRONOMICAL_UNIT_KILOMETERS);
  assert.ok(Math.hypot(...sub(heliocentricKm('earth'), emb)) > 4000, 'Earth must not be replaced with the barycentre');
});

test('regeneration retains every current registry orbit, including moons and comets', () => {
  assert.deepEqual(Object.keys(geometry.BODY_ORBITS), SCENE_OBJECTS.filter(body =>
    ['planet', 'dwarf-planet', 'satellite', 'asteroid', 'trans-neptunian', 'interstellar', 'comet', 'exoplanet', 'star'].includes(body.classification) && body.id !== 'sun').map(body => body.id));
  assert.equal(new Map(Object.entries(geometry.BODY_POSITION_PROVENANCE)).get('daphnis'), undefined, 'unavailable contemporary ephemeris is not relabeled as observed');
});

test('a frozen snapshot fails closed on stale epoch, corrupted bytes, wrong center and missing body', async () => {
  await assert.rejects(loadSceneEpochEphemeris(epoch + 1), /epoch/);
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-epoch-source-test-'));
  const url = pathToFileURL(`${directory}/`);
  try {
    await cp(SCENE_EPHEMERIS_DIRECTORY, directory, { recursive: true });
    const file = new URL('manifest.json', url);
    const original = requireRecord(JSON.parse(await readFile(file, 'utf8')), 'scene ephemeris manifest');
    const altered = structuredClone(original);
    const records = requireArray(altered.records, 'scene ephemeris records');
    assert.equal(Reflect.set(requireRecord(requireSnapshot(records[0], 'first scene ephemeris record'), 'first scene ephemeris record'), 'center', 4), true);
    await writeFile(file, JSON.stringify(altered));
    await assert.rejects(loadSceneEpochEphemeris(epoch, url), /identity/);
    altered.records = requireArray(original.records, 'scene ephemeris records').slice(1);
    await writeFile(file, JSON.stringify(altered));
    await assert.rejects(loadSceneEpochEphemeris(epoch, url), /missing/);
    await writeFile(file, JSON.stringify(original));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('epoch refresh updates the rendered carrier while preserving source geometry, texture addresses and lens bindings', async () => {
  const { refreshSolidSceneEpoch } = await import('../objects/terrestrial-layers/solid-scene.mts');
  const { restoreDepthSource } = await import('../prepared/prepared-depth-partitions.mts');
  const { prepareEclipticPresentationFrame } = await import('../../src/platform/solar-presentation-frame.mts');
  const read = async (name: string): Promise<unknown> => JSON.parse(await readFile(new URL(`../../src/objects/mimas/${name}`, import.meta.url), 'utf8'));
  const config = parseSolidPreparationSource(await read('source/preparation/terrestrial.json'));
  const scene = parseSolidReplayScene(await read('prepared/scene.json')),
    definition = restoreDepthSource(requireObjectRuntimeDefinition(await read('prepared/runtime.json')));
  // An old surface carrier must actually change; a new descriptor alone cannot fix it.
  const oldTransform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
  assert.equal(Reflect.set(scene, 'systemTransform', oldTransform), true);
  const index = definition.tree.nodes.findIndex(node => node.className?.split(' ').includes('mimas-system'));
  assert.equal(Reflect.set(requireSnapshot(definition.tree.nodes[index], 'Mimas system carrier'), 'style', `transform:${oldTransform}`), true);
  const surfacesReport = await read('prepared/surfaces.json');
  const result = await refreshSolidSceneEpoch({ config, scene, definition, surfacesReport });
  assert.equal(result.scene.systemTransform, prepareEclipticPresentationFrame('mimas').cssTransform);
  assert.notEqual(result.scene.systemTransform, oldTransform);
  assert.equal(requireSnapshot(result.definition.tree.nodes[index], 'refreshed Mimas system carrier').style, `transform:${result.scene.systemTransform}`);
  assert.equal(result.scene.bodyLeaves, scene.bodyLeaves);
  assert.equal(result.scene.surfaceTriangles, scene.surfaceTriangles);
  assert.equal(result.definition.assets, definition.assets);
  assert.equal(result.definition.controls, definition.controls);
  assert.equal(result.definition.variants, definition.variants);
  assert.equal(result.definition.materials, definition.materials);
  assert.equal(result.definition.surfaceHit, definition.surfaceHit);
  definition.tree.nodes.forEach((node, i) => { if (i !== index) assert.equal(result.definition.tree.nodes[i], node); });
  assert.deepEqual(await refreshSolidSceneEpoch({ config, ...result, surfacesReport }), result, 'refresh is idempotent');
});

test('epoch refresh restores a compiled surface before updating its physical frame', async () => {
  const { refreshSolidSceneEpoch } = await import('../objects/terrestrial-layers/solid-scene.mts');
  const { restoreDepthSource } = await import('../prepared/prepared-depth-partitions.mts');
  const read = async (name: string): Promise<unknown> => JSON.parse(await readFile(new URL(`../../src/objects/mimas/${name}`, import.meta.url), 'utf8'));
  const config = parseSolidPreparationSource(await read('source/preparation/terrestrial.json')),
    scene = parseSolidReplayScene(await read('prepared/scene.json'));
  const definition = requireObjectRuntimeDefinition(await read('prepared/runtime.json'));
  assert.ok(requireSnapshot(definition.depthPartitions?.groups, 'compiled depth groups').length > 1, 'exercise actual compiled source carriers');
  const original = structuredClone(definition);
  const surfacesReport = await read('prepared/surfaces.json');
  const expected = await refreshSolidSceneEpoch({ config, scene, definition: restoreDepthSource(definition), surfacesReport });
  const actual = await refreshSolidSceneEpoch({ config, scene, definition, surfacesReport });
  assert.deepEqual(actual, expected);
  assert.deepEqual(definition, original, 'refresh does not mutate the retained prepared bank');
  assert.deepEqual(requireSnapshot(actual.definition.surfaceHit, 'refreshed surface hit').triangles, requireSnapshot(definition.surfaceHit, 'prepared surface hit').triangles);
  assert.deepEqual(actual.definition.assets, definition.assets);
});

test('published scene and standalone sky/light documents follow the runtime after a position refresh', async () => {
  let embeddedSkyCopies = 0, embeddedSunCopies = 0;
  for (const id of ['jupiter', 'saturn', 'moon', 'pluto', 'triton', 'mimas', 'phobos']) {
    const base = new URL(`../../src/objects/${id}/prepared/`, import.meta.url);
    const read = async (name: string) => requireRecord(JSON.parse(await readFile(new URL(name, base), 'utf8')));
    const runtime = await read('runtime.json'), scene = await read('scene.json');
    const sky = requireRecord(runtime.sky), sun = requireRecord(runtime.sun);
    if (scene.sky !== undefined) {
      embeddedSkyCopies++;
      assert.deepEqual(requireRecord(scene.sky).sceneRegistration, sky.sceneRegistration, `${id}: scene sky`);
    }
    assert.deepEqual((await read('sky.json')).sceneRegistration, sky.sceneRegistration, `${id}: standalone sky`);
    for (const key of ['localDirection', 'referenceViewDirection']) {
      if (scene.sun !== undefined) {
        embeddedSunCopies++;
        assert.deepEqual(requireRecord(scene.sun)[key], sun[key], `${id}: scene ${key}`);
      }
      assert.deepEqual((await read('sun.json'))[key], sun[key], `${id}: standalone ${key}`);
    }
  }
  assert.ok(embeddedSkyCopies >= 2 && embeddedSunCopies >= 4, 'exercise both embedded documents and standalone-only lanes');
});
