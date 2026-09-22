import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import prepared from '../moon-labels.prepared.json' with { type: 'json' };
import world from '../../src/objects/sun/prepared/world-context.json' with { type: 'json' };
import catalogue from '../source/moon-catalogues.json' with { type: 'json' };
import { parseMoonLabels, projectMoonLabels } from '../catalogue-moon-labels.mts';
import { hasProperMoonName, prepareBodyMoons } from '../prepare-body-moons.mts';
import { parseMoonVector } from '../../tools/prepare/prepare-moon-labels.mts';
import { sourceArray, sourceObject, sourceText } from '../../src/platform/source-catalog.mts';
import { minorMoonOrbitIds } from '../moon-orbit-policy.mts';

test('prepared unavailable moon labels cover proper names and match pinned Horizons vectors', async () => {
  const bytes = await readFile(new URL('../source/moon-horizons.json.gz', import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), prepared.sourceSha256);
  const source = sourceObject(JSON.parse(gunzipSync(bytes).toString()));
  const responses = sourceArray(source.responses, sourceObject);
  const centers: Readonly<Record<string, string>> = { jupiter: '599', saturn: '699', uranus: '799', neptune: '899' };
  for (const parentId of Object.keys(centers)) {
    const named = new Set(catalogue.systems.find(system => system.id === parentId)!.moons.filter(hasProperMoonName).map(moon => moon.id));
    assert.deepEqual(prepared.moons.filter(moon => moon.parentId === parentId).map(moon => moon.id),
      prepareBodyMoons(parentId).filter(moon => !moon.object && named.has(moon.id)).map(moon => moon.id));
  }
  assert.equal(prepared.moons.filter(moon => moon.positionM === null).length, 0);
  for (const moon of parseMoonLabels(prepared)) {
    const response = responses.find(response => response.id === moon.id)!;
    const vector = parseMoonVector(response.response, sourceText(response.code), centers[moon.parentId], world.frame.epochJdTt);
    const parent = world.bodies.find(body => body.id === moon.parentId)!;
    assert.deepEqual(moon.positionM, vector.positionKm.map((value, axis) => parent.positionM[axis] + value * 1000));
  }
  const wrongBody = responses.find(response => response.id === 's-2025-u1')!;
  assert.throws(() => parseMoonVector(wrongBody.response, '75052', '799', world.frame.epochJdTt), /target\/frame/);
});

test('designation-only moons stay in the sidebar and do not become scene labels', () => {
  const saturn = catalogue.systems.find(system => system.id === 'saturn')!;
  assert.equal(saturn.moons.filter(hasProperMoonName).length, 63);
  assert.equal(prepareBodyMoons('saturn').length, 293);
  assert.equal(prepared.moons.filter(moon => moon.parentId === 'saturn').length, 17);
  assert.ok(prepared.moons.some(moon => moon.id === 'narvi'));
  assert.ok(prepared.moons.some(moon => moon.id === 'gerd'));
  assert.ok(prepareBodyMoons('saturn').some(moon => moon.id === 's-2023-s1'));
  assert.equal(prepared.moons.some(moon => moon.id === 's-2023-s1'), false);
  assert.ok(prepared.moons.every(moon => !/^S\//u.test(moon.name)));
  assert.equal(hasProperMoonName({ name: 'Hippocamp', provisionalDesignation: 'S/2004 N1' }), true);
  assert.equal(hasProperMoonName({ name: 'S/2004 N1', provisionalDesignation: 'S/2004 N1' }), false);
});

test('disabled captions respect foreground labels, planet occlusion and overview scale', () => {
  const parent = { id: 'parent', positionM: [0, 0, 0], radiusM: 10 };
  const moons = [
    { id: 'clear', name: 'Clear', parentId: 'parent', positionM: [40, 0, 0], parentDistanceM: 40 },
    { id: 'behind', name: 'Behind', parentId: 'parent', positionM: [0, 0, -40], parentDistanceM: 40 },
  ];
  const pose = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5,
    pose: { positionM: [0, 0, 100] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 100, widthPixels: 500, heightPixels: 300, principalOffsetPixels: [0, 0] as const };
  const parents = new Map([[parent.id, parent]]);
  assert.deepEqual(projectMoonLabels(moons, [30, 30], parents, parent, pose, viewport, []).map(point => point.index), [0]);
  assert.equal(projectMoonLabels(moons, [30, 30], parents, parent, pose, viewport, [{ left: 20, right: 60, top: -20, bottom: 20 }]).length, 0);
  assert.equal(projectMoonLabels(moons, [30, 30], parents, parent, { ...pose, pose: { ...pose.pose, positionM: [0, 0, 10000] } }, viewport, []).length, 0);
});

test('major moon orbits remain enabled and minor moon orbits are suppressed across planets', () => {
  const minor = new Set(minorMoonOrbitIds(world.bodies));
  for (const id of ['moon', 'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto', 'mimas', 'enceladus', 'tethys', 'dione', 'rhea', 'titan', 'hyperion', 'iapetus', 'miranda', 'ariel', 'umbriel', 'titania', 'oberon', 'triton', 'nereid']) assert.equal(minor.has(id), false, id);
  for (const id of ['amalthea', 'himalia', 'phoebe', 'atlas', 'pandora', 'puck', 'portia', 'proteus', 'larissa']) assert.equal(minor.has(id), true, id);
  assert.equal(minor.has('saturn'), false);
});


test('disabled captions keep admission through small zoom reversals', () => {
  const parent = { id: 'parent', positionM: [0, 0, 0], radiusM: 1 };
  const moon = { id: 'named', name: 'Named', parentId: 'parent', positionM: [30.5, 0, 0], parentDistanceM: 30.5 };
  const pose = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5,
    pose: { positionM: [0, 0, 100] as const, orientationXyzw: [0, 0, 0, 1] as const } };
  const viewport = { focalPixels: 100, widthPixels: 500, heightPixels: 300, principalOffsetPixels: [0, 0] as const };
  const parents = new Map([[parent.id, parent]]);
  // 30.5 px sits between the exit and entry thresholds: an existing caption
  // survives, while a new one waits for enough room.
  assert.equal(projectMoonLabels([moon], [30], parents, parent, pose, viewport, []).length, 0);
  assert.equal(projectMoonLabels([moon], [30], parents, parent, pose, viewport, [], undefined, new Set([0])).length, 1);
  const farther = { ...pose, pose: { ...pose.pose, positionM: [0, 0, 105] as const } };
  assert.equal(projectMoonLabels([moon], [30], parents, parent, farther, viewport, [], undefined, new Set([0])).length, 0);
});
