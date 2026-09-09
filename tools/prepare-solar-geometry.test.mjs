import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadSceneEpochEphemeris, SCENE_EPHEMERIS_DIRECTORY } from '../packages/astronomy/tools/scene-ephemeris.mjs';
import { loadAstronomyPackage } from '../src/platform/astronomy-package.mjs';
import { OBJECTS } from '../site/objects.mjs';
import * as geometry from '../src/platform/solar-geometry.mjs';

const epoch = geometry.SOLAR_GEOMETRY_EPOCH_JD_TT;
const snapshots = await loadSceneEpochEphemeris(epoch);
const astronomy = await loadAstronomyPackage();
const apply = (m, v) => [0, 1, 2].map(row => v.reduce((sum, value, column) => sum + m[row * 3 + column] * value, 0));
const sub = (a, b) => a.map((value, i) => value - b[i]);
const scale = (v, k) => v.map(value => value * k);
const unit = v => scale(v, 1 / Math.hypot(...v));
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const heliocentricKm = id => scale(apply(geometry.BODY_FIXED_TO_ICRF_MATRICES[id], geometry.BODY_FIXED_SUN_DIRECTIONS[id]),
  -geometry.BODY_ORBITS[id].heliocentricDistanceAu * geometry.ASTRONOMICAL_UNIT_KILOMETERS);

test('primary-specific companion sources define one global parent origin and conic at the scene epoch', async () => {
  for (const id of ['hiiaka', 'menoetius', 'romulus']) {
    const source = JSON.parse(await readFile(new URL(`../src/planets/${id}/source/validation/epoch-state.json`, import.meta.url), 'utf8'));
    const parent = source.centerBodyId, primary = source.parentHeliocentricState;
    assert.deepEqual(geometry.BODY_HELIOCENTRIC_STATES[parent].positionKm, primary.positionKm);
    assert.deepEqual(geometry.BODY_HELIOCENTRIC_STATES[parent].velocityKmPerDay, primary.velocityKmPerDay);
    const relative = sub(heliocentricKm(id), primary.positionKm);
    assert.ok(Math.hypot(...sub(relative, source.positionKm)) < .00001, `${id}: global center composition`);
    if (geometry.BODY_ORBITS[parent]) {
      assert.ok(Math.hypot(...sub(heliocentricKm(parent), primary.positionKm)) < .00001, `${parent}: visible body shares the primary origin`);
      const normal = unit(apply(geometry.BODY_FIXED_TO_ICRF_MATRICES[parent], geometry.BODY_FIXED_ORBIT_NORMAL_DIRECTIONS[parent]));
      assert.ok(Math.hypot(...sub(normal, unit(cross(primary.positionKm, primary.velocityKmPerDay)))) < 1e-12, `${parent}: conic uses source velocity`);
      assert.equal(geometry.BODY_POSITION_PROVENANCE[parent].sha256, geometry.BODY_HELIOCENTRIC_STATES[parent].provenance.sha256);
    }
  }
  assert.equal(geometry.BODY_ORBITS.patroclus, undefined, 'a coordinate origin does not create a standalone scene');
});

for (const id of ['phobos', 'mimas', 'janus', 'epimetheus', 'helene', 'triton']) {
  test(`${id}: the published position and orbit plane reproduce retained Horizons, not the displaced compact fit`, () => {
    const source = snapshots.get(id);
    const matrix = geometry.BODY_FIXED_TO_ICRF_MATRICES[id];
    const local = scale(apply(matrix, geometry.BODY_ORBITS[id].centerPositionAu), -geometry.ASTRONOMICAL_UNIT_KILOMETERS);
    assert.ok(Math.hypot(...sub(local, source.positionKm)) < 1e-8, 'body-centered stored orbit matches independent source state');
    assert.ok(Math.hypot(...sub(unit(apply(matrix, geometry.BODY_FIXED_ORBIT_NORMAL_DIRECTIONS[id])),
      unit(cross(source.positionKm, source.velocityKmPerDay)))) < 1e-12, 'velocity belongs to the same source state');
    const relative = sub(heliocentricKm(id), heliocentricKm(source.centerBodyId));
    assert.ok(Math.hypot(...sub(relative, source.positionKm)) < .00001, 'heliocentric frame translation preserves the corrected parent-relative position');
    const old = astronomy.satellitePositionKm(id, epoch);
    assert.ok(Math.hypot(...sub(old, source.positionKm)) > 500, 'regression fixture exercises a significant old fit error');
    assert.equal(geometry.BODY_POSITION_PROVENANCE[id].sha256, source.provenance.sha256);
  });
}

test('Earth is displaced from the EMB by the retained Earth-center vector and the Moon shares that same parent', () => {
  const emb = scale(astronomy.systemBarycentreHeliocentricAu('emb', epoch), geometry.ASTRONOMICAL_UNIT_KILOMETERS);
  const offset = sub(heliocentricKm('earth'), emb);
  assert.ok(Math.hypot(...sub(offset, snapshots.get('earth').positionKm)) < 1e-7);
  assert.ok(Math.hypot(...offset) > 4000, 'does not silently substitute the barycentre');
  const lunarOffset = sub(heliocentricKm('moon'), heliocentricKm('earth'));
  assert.ok(Math.hypot(...sub(lunarOffset, astronomy.moonPositionRelativeToPlanetKm('moon', epoch))) < 1e-7);
});

test('regeneration retains every current registry orbit, including moons and comets', () => {
  assert.deepEqual(Object.keys(geometry.BODY_ORBITS), OBJECTS.filter(body =>
    ['planet', 'dwarf-planet', 'satellite', 'asteroid', 'comet'].includes(body.classification)).map(body => body.id));
  assert.equal(geometry.BODY_POSITION_PROVENANCE.daphnis, undefined, 'unavailable contemporary ephemeris is not relabeled as observed');
});

test('a frozen snapshot fails closed on stale epoch, corrupted bytes, wrong center and missing body', async () => {
  await assert.rejects(loadSceneEpochEphemeris(epoch + 1), /epoch/);
  const directory = await mkdtemp(resolve(tmpdir(), 'cssearth-epoch-source-test-'));
  const url = pathToFileURL(`${directory}/`);
  try {
    await cp(SCENE_EPHEMERIS_DIRECTORY, directory, { recursive: true });
    const file = new URL('manifest.json', url);
    const original = JSON.parse(await readFile(file, 'utf8'));
    const altered = structuredClone(original);
    altered.records[0].center = 4;
    await writeFile(file, JSON.stringify(altered));
    await assert.rejects(loadSceneEpochEphemeris(epoch, url), /identity/);
    altered.records = original.records.slice(1);
    await writeFile(file, JSON.stringify(altered));
    await assert.rejects(loadSceneEpochEphemeris(epoch, url), /missing/);
    await writeFile(file, JSON.stringify(original));
    await writeFile(new URL(original.records[0].path, url), 'unbound response');
    await assert.rejects(loadSceneEpochEphemeris(epoch, url), /hash/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('epoch refresh updates the rendered carrier while preserving source geometry, texture addresses and lens bindings', async () => {
  const { refreshSolidSceneEpoch } = await import('./objects/terrestrial-layers/solid-scene.mjs');
  const { restoreDepthSource } = await import('./prepared-depth-partitions.mjs');
  const { prepareEclipticPresentationFrame } = await import('../src/platform/solar-presentation-frame.mjs');
  const read = async name => JSON.parse(await readFile(new URL(`../src/planets/mimas/${name}`, import.meta.url), 'utf8'));
  const config = await read('source/preparation/terrestrial.json');
  const scene = await read('prepared/scene.json'), definition = restoreDepthSource(await read('prepared/runtime.json'));
  // An old surface carrier must actually change; a new descriptor alone cannot fix it.
  const oldTransform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
  scene.systemTransform = oldTransform;
  const index = definition.tree.nodes.findIndex(node => node.className?.split(' ').includes('mimas-system'));
  definition.tree.nodes[index].style = `transform:${oldTransform}`;
  const result = await refreshSolidSceneEpoch({ config, scene, definition });
  assert.equal(result.scene.systemTransform, prepareEclipticPresentationFrame('mimas').cssTransform);
  assert.notEqual(result.scene.systemTransform, oldTransform);
  assert.equal(result.definition.tree.nodes[index].style, `transform:${result.scene.systemTransform}`);
  assert.equal(result.scene.bodyLeaves, scene.bodyLeaves);
  assert.equal(result.scene.surfaceTriangles, scene.surfaceTriangles);
  for (const key of ['assets', 'controls', 'variants', 'materials', 'surfaceHit']) assert.equal(result.definition[key], definition[key], key);
  definition.tree.nodes.forEach((node, i) => { if (i !== index) assert.equal(result.definition.tree.nodes[i], node); });
  assert.deepEqual(await refreshSolidSceneEpoch({ config, ...result }), result, 'refresh is idempotent');
});

test('epoch refresh restores a compiled surface before updating its physical frame', async () => {
  const { refreshSolidSceneEpoch } = await import('./objects/terrestrial-layers/solid-scene.mjs');
  const { restoreDepthSource } = await import('./prepared-depth-partitions.mjs');
  const read = async name => JSON.parse(await readFile(new URL(`../src/planets/phobos/${name}`, import.meta.url), 'utf8'));
  const config = await read('source/preparation/terrestrial.json'), scene = await read('prepared/scene.json');
  const definition = await read('prepared/runtime.json');
  assert.ok(definition.depthPartitions?.groups.length > 1, 'exercise actual compiled source carriers');
  const original = structuredClone(definition);
  const expected = await refreshSolidSceneEpoch({ config, scene, definition: restoreDepthSource(definition) });
  const actual = await refreshSolidSceneEpoch({ config, scene, definition });
  assert.deepEqual(actual, expected);
  assert.deepEqual(definition, original, 'refresh does not mutate the retained prepared bank');
  assert.deepEqual(actual.definition.surfaceHit.triangles, definition.surfaceHit.triangles);
  assert.deepEqual(actual.definition.assets, definition.assets);
});
