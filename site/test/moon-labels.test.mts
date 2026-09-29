import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { projectMoonLabels } from '../catalogue-moon-labels.mts';
import { minorMoonOrbitIds } from '../build/prepare/prepare-world-presentation.mts';

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
  const demand = new Set<number>();
  assert.deepEqual(projectMoonLabels(moons, [0, 0], parents, parent, pose, viewport, [], undefined, undefined, undefined, demand), []);
  assert.deepEqual([...demand], [0]); // The occluded caption never needs a DOM measurement.
  demand.clear();
  projectMoonLabels(moons, [0, 0], parents, parent, { ...pose, pose: { ...pose.pose, positionM: [0, 0, 10000] } }, viewport, [], undefined, undefined, undefined, demand);
  assert.equal(demand.size, 0);
  assert.deepEqual(projectMoonLabels(moons, [30, 30], parents, parent, pose, viewport, []).map(point => point.index), [0]);
  assert.equal(projectMoonLabels(moons, [30, 30], parents, parent, pose, viewport, [{ left: 20, right: 60, top: -20, bottom: 20 }]).length, 0);
  assert.equal(projectMoonLabels(moons, [30, 30], parents, parent, { ...pose, pose: { ...pose.pose, positionM: [0, 0, 10000] } }, viewport, []).length, 0);
});

test('major moon orbits remain enabled and minor moon orbits are suppressed across planets', async () => {
  const world = requireRecord(JSON.parse(await readFile(new URL('../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')), 'world context');
  const bodies = requireArray(world.bodies, 'world bodies').map(value => {
    const body = requireRecord(value, 'world body');
    const orbit = body.orbit === undefined ? undefined : { centerBodyId: requireString(requireRecord(body.orbit, 'orbit').centerBodyId, 'orbit centre') };
    return { id: requireString(body.id, 'body id'), ...(orbit ? { orbit } : {}) };
  });
  const minor = new Set(minorMoonOrbitIds(bodies));
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
