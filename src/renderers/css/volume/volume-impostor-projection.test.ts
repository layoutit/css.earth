import { expect, test } from 'vitest';
import { projectVolumeImpostors, selectImpostorViews } from './volume-impostor-projection.js';
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
  expect(front).toMatchObject({ x: 7, y: -4, diameterPixels: 20, volumeMix: 0, visible: true, views: [{ id: 'front', weight: 1 }] });
  // Seen from its front the image is upright: its right and down axes are the camera's.
  [1, 0, 0, 1].forEach((n, i) => expect(front.views[0]!.matrix[i]).toBeCloseTo(n));
  expect(projectVolumeImpostors(publication(10, 200), frame, bank).diameterPixels).toBe(40);
  expect(projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, positionM: [1, 2, 10] } } }, frame, bank))
    .toMatchObject({ x: -3, y: 16 });
});
test('continuous size handoff keeps full volume inside the cloud and culls only the exterior distant sphere', () => {
  for (const [diameter, volumeMix] of [[128, 0], [192, .5], [256, 1]]) {
    const value = projectVolumeImpostors(publication(1000 / diameter, 500), frame, bank);
    expect(value.diameterPixels).toBeCloseTo(diameter); expect(value.volumeMix).toBeCloseTo(volumeMix);
  }
  expect(projectVolumeImpostors(publication(.1), frame, bank)).toMatchObject({ volumeMix: 1, visible: true, views: [] });
  expect(projectVolumeImpostors(publication(-10), frame, bank)).toMatchObject({ visible: false, views: [] });
  const p = publication();
  expect(projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, positionM: [100, 0, 10] } } }, frame, bank).visible).toBe(false);
});
test('camera roll rotates the prepared image, without selecting another depth direction', () => {
  const p = publication(), a = Math.sqrt(.5);
  const view = projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, orientationXyzw: [0, 0, a, a] } } }, frame, bank).views[0]!;
  expect(view.id).toBe('front');
  // A quarter-turn roll is a rotation of the image, not a reflection.
  [0, 1, -1, 0].forEach((n, i) => expect(view.matrix[i]).toBeCloseTo(n));
});
test('directional views have bounded continuous weights and declared orthonormal camera bases', () => {
  const resources = new Set(bank.views.map(view => view.texturePath));
  expect(validateVolumeImpostors(bank, resources)).toEqual(bank);
  for (let degree = 0; degree <= 360; degree++) {
    const a = degree * Math.PI / 180, back: VolumeVector = [Math.sin(a), 0, Math.cos(a)];
    const views = selectImpostorViews(bank.views, back);
    expect(views.length).toBeLessThanOrEqual(3); expect(views.reduce((sum, view) => sum + view.weight, 0)).toBeCloseTo(1);
  }
  expect(() => validateVolumeImpostors({ ...bank, volumeAboveDiameterPixels: 1 }, resources)).toThrow('thresholds');
  expect(() => validateVolumeImpostors(bank, new Set())).toThrow('declared');
  expect(() => validateVolumeImpostors({ ...bank, views: [{ ...bank.views[0], right: [2, 0, 0] }, ...bank.views.slice(1)] }, resources)).toThrow('orthonormal');
});
test('turning in place keeps the same views; moving around the volume selects new ones', () => {
  const p = publication();
  const turned = (yawDegrees: number) => {
    const half = yawDegrees * Math.PI / 360;
    return projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, orientationXyzw: [0, Math.sin(half), 0, Math.cos(half)] } } }, frame, bank);
  };
  // A small turn keeps the sphere on screen; the chosen views and weights must not change with it.
  const ahead = turned(0), aside = turned(4);
  expect(aside.visible).toBe(true);
  expect(aside.views.map(view => [view.id, view.weight])).toEqual(ahead.views.map(view => [view.id, view.weight]));
  const moved = projectVolumeImpostors({ ...p, world: { ...p.world, pose: { positionM: [10, 0, 0], orientationXyzw: [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)] } } }, frame, bank);
  expect(moved.views.map(view => view.id)).toEqual(['right']);
});
test('a distant cloud beside or behind the camera is neither near nor visible', () => {
  const p = publication(100);
  // Turned to face along +x, the cloud at the origin sits 90° off-axis at distance 100: depth is zero.
  const beside = projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, orientationXyzw: [0, Math.SQRT1_2, 0, Math.SQRT1_2] } } }, frame, bank);
  expect(beside.visible).toBe(false); expect(Number.isFinite(beside.diameterPixels)).toBe(true); expect(beside.volumeMix).toBe(0);
  expect(beside.views).toEqual([]);
  // Facing away from it.
  const behind = projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, orientationXyzw: [0, 1, 0, 0] } } }, frame, bank);
  expect(behind.visible).toBe(false); expect(behind.volumeMix).toBe(0);
  // Inside the sphere is still inside, whatever the view direction.
  const within = projectVolumeImpostors({ ...p, world: { ...p.world, pose: { ...p.world.pose, positionM: [0, 0, .5], orientationXyzw: [0, Math.SQRT1_2, 0, Math.SQRT1_2] } } }, frame, bank);
  expect(within).toMatchObject({ visible: true, volumeMix: 1, diameterPixels: Number.POSITIVE_INFINITY });
  // Just off the edge of the field of view but large enough to reach into it: visible.
  const edge = projectVolumeImpostors({ ...p, world: { ...p.world, pose: { positionM: [0, 0, 3], orientationXyzw: [0, Math.sin(Math.PI * 40 / 360), 0, Math.cos(Math.PI * 40 / 360)] } } }, frame, bank);
  expect(edge.visible).toBe(true);
});
