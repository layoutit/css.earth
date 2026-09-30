import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { projectVolumeImpostors, selectImpostorViews } from './volume-impostor-projection.js';
import { projectedVolumeOpacity, projectVolumeSphere } from './projected-volume-visibility.js';
import { validateVolumeImpostors } from './volume-impostor-validation.js';
import type { PreparedVolumeImpostors, VolumeCameraPublication, VolumeVector } from './types.js';

const frame = { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0] as const,
  localToReferenceXyzw: [0, 0, 0, 1] as const, metersPerUnit: 1,
  boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
const bank: PreparedVolumeImpostors = { schema: 'cssearth-volume-impostors@1', radiusUnits: 1,
  fullBelowDiameterPixels: 128, volumeAboveDiameterPixels: 256,
  views: [
    { id: 'front', back: [0, 0, 1], right: [1, 0, 0], down: [0, -1, 0], texturePath: 'front.png' },
    { id: 'back', back: [0, 0, -1], right: [-1, 0, 0], down: [0, -1, 0], texturePath: 'back.png' },
    { id: 'right', back: [1, 0, 0], right: [0, 0, -1], down: [0, -1, 0], texturePath: 'right.png' },
    { id: 'left', back: [-1, 0, 0], right: [0, 0, 1], down: [0, -1, 0], texturePath: 'left.png' },
    { id: 'up', back: [0, 1, 0], right: [-1, 0, 0], down: [0, 0, -1], texturePath: 'up.png' },
    { id: 'down', back: [0, -1, 0], right: [1, 0, 0], down: [0, 0, -1], texturePath: 'down.png' },
  ] };
const publication = (distance = 10, focalPixels = 100): VolumeCameraPublication => ({
  world: { referenceFrame: 'fixture', epochJdTt: 123, pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, 0, 1] } },
  viewport: { focalPixels, principalOffsetPixels: [7, -4], widthPixels: 400, heightPixels: 300 },
});
test('perspective footprint follows focal length, position and principal point with shared physical handedness', () => {
  const p = publication();
  const front = projectVolumeImpostors(p, frame, bank);
  assert.partialDeepStrictEqual(front, { x: 7, y: -4, diameterPixels: 20, volumeMix: 0, visible: true, views: [{ id: 'front', weight: 1 }] });
  // Seen from its front the image is upright: its right and down axes are the camera's.
  [1, 0, 0, 1].forEach((n, i) => assert.ok(Math.abs(front.views[0]!.matrix[i] - (n)) < 10 ** -2 / 2, `${front.views[0]!.matrix[i]} is not close to ${n}`));
  assert.equal(projectVolumeImpostors(publication(10, 200), frame, bank).diameterPixels, 40);
  assert.partialDeepStrictEqual(projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, positionM: [1, 2, 10] } } }, frame, bank), { x: -3, y: 16 });
});
test('continuous size handoff keeps full volume inside the cloud and culls only the exterior distant sphere', () => {
  for (const [diameter, volumeMix] of [[128, 0], [192, .5], [256, 1]]) {
    const value = projectVolumeImpostors(publication(1000 / diameter, 500), frame, bank);
    assert.ok(Math.abs(value.diameterPixels - (diameter)) < 10 ** -2 / 2, `${value.diameterPixels} is not close to ${diameter}`); assert.ok(Math.abs(value.volumeMix - (volumeMix)) < 10 ** -2 / 2, `${value.volumeMix} is not close to ${volumeMix}`);
  }
  assert.partialDeepStrictEqual(projectVolumeImpostors(publication(.1), frame, bank), { volumeMix: 1, visible: true, views: [] });
  assert.partialDeepStrictEqual(projectVolumeImpostors(publication(-10), frame, bank), { visible: false, views: [] });
  const p = publication();
  assert.equal(projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, positionM: [100, 0, 10] } } }, frame, bank).visible, false);
});
test('camera roll rotates the prepared image, without selecting another depth direction', () => {
  const p = publication(), a = Math.sqrt(.5);
  const view = projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, orientationXyzw: [0, 0, a, a] } } }, frame, bank).views[0]!;
  assert.equal(view.id, 'front');
  // A quarter-turn roll is a rotation of the image, not a reflection.
  [0, 1, -1, 0].forEach((n, i) => assert.ok(Math.abs(view.matrix[i] - (n)) < 10 ** -2 / 2, `${view.matrix[i]} is not close to ${n}`));
});
test('directional views have bounded continuous weights and declared orthonormal camera bases', () => {
  const resources = new Set(bank.views.map(view => view.texturePath));
  assert.deepEqual(validateVolumeImpostors(bank, resources), bank);
  for (let degree = 0; degree <= 360; degree++) {
    const a = degree * Math.PI / 180, back: VolumeVector = [Math.sin(a), 0, Math.cos(a)];
    const views = selectImpostorViews(bank.views, back);
    assert.ok(views.length <= 3); assert.ok(Math.abs(views.reduce((sum, view) => sum + view.weight, 0) - (1)) < 10 ** -2 / 2, `${views.reduce((sum, view) => sum + view.weight, 0)} is not close to ${1}`);
  }
  assert.throws(() => validateVolumeImpostors({ ...bank, volumeAboveDiameterPixels: 1 }, resources), /thresholds/);
  assert.throws(() => validateVolumeImpostors(bank, new Set()), /declared/);
  assert.throws(() => validateVolumeImpostors({ ...bank, views: [{ ...bank.views[0], right: [2, 0, 0] }, ...bank.views.slice(1)] }, resources), /orthonormal/);
});
test('turning in place keeps the same views; moving around the volume selects new ones', () => {
  const p = publication();
  const turned = (yawDegrees: number) => {
    const half = yawDegrees * Math.PI / 360;
    return projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, orientationXyzw: [0, Math.sin(half), 0, Math.cos(half)] } } }, frame, bank);
  };
  // A small turn keeps the sphere on screen; the chosen views and weights must not change with it.
  const ahead = turned(0), aside = turned(4);
  assert.equal(aside.visible, true);
  assert.deepEqual(aside.views.map(view => [view.id, view.weight]), ahead.views.map(view => [view.id, view.weight]));
  const moved = projectVolumeImpostors({ ...p, world: { ...p.world, pose: { positionM: [10, 0, 0], orientationXyzw: [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)] } } }, frame, bank);
  assert.deepEqual(moved.views.map(view => view.id), ['right']);
});
test('a distant cloud beside or behind the camera is neither near nor visible', () => {
  const p = publication(100);
  // Turned to face along +x, the cloud at the origin sits 90° off-axis at distance 100: depth is zero.
  const beside = projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, orientationXyzw: [0, Math.SQRT1_2, 0, Math.SQRT1_2] } } }, frame, bank);
  assert.equal(beside.visible, false); assert.equal(Number.isFinite(beside.diameterPixels), true); assert.equal(beside.volumeMix, 0);
  assert.deepEqual(beside.views, []);
  // Facing away from it.
  const behind = projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, orientationXyzw: [0, 1, 0, 0] } } }, frame, bank);
  assert.equal(behind.visible, false); assert.equal(behind.volumeMix, 0);
  // Inside the sphere is still inside, whatever the view direction.
  const within = projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, positionM: [0, 0, .5], orientationXyzw: [0, Math.SQRT1_2, 0, Math.SQRT1_2] } } }, frame, bank);
  assert.partialDeepStrictEqual(within, { visible: true, volumeMix: 1, diameterPixels: Number.POSITIVE_INFINITY });
  // Just off the edge of the field of view but large enough to reach into it: visible.
  const edge = projectVolumeImpostors({ ...p, world: { ...p.world, pose: { positionM: [0, 0, 3], orientationXyzw: [0, Math.sin(Math.PI * 40 / 360), 0, Math.cos(Math.PI * 40 / 360)] } } }, frame, bank);
  assert.equal(edge.visible, true);
});

test('a volume far behind the camera is out of view however large it would project, so its datasets are not fetched', () => {
  const ahead = publication();
  // Camera at +10 looking down -z sees the origin; turned half a turn about y, it faces away.
  const behind = { ...ahead, world: { ...ahead.world, pose: { ...ahead.world.pose, orientationXyzw: [0, 1, 0, 0] as const } } };
  // The dataset fetch gate: big enough to resolve, and the bounding sphere reaches the viewport.
  const fetches = (p: VolumeCameraPublication) => projectedVolumeOpacity(p.world, p.viewport, frame, 1) > 0 && projectVolumeSphere(p.world, p.viewport, frame, 1).visible;
  assert.equal(projectedVolumeOpacity(behind.world, behind.viewport, frame, 1), projectedVolumeOpacity(ahead.world, ahead.viewport, frame, 1));
  assert.equal(fetches(ahead), true);
  assert.equal(fetches(behind), false);
  // Inside the sphere it is always in view, whichever way the camera turns.
  const inside = { ...behind, world: { ...behind.world, pose: { ...behind.world.pose, positionM: [0, 0, 0.5] as const } } };
  assert.equal(projectVolumeSphere(inside.world, inside.viewport, frame, 1).visible, true);
});
