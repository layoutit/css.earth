import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import type { PositionM } from '@cssearth/engine';
import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';
import type { WorldRotation } from '@cssearth/renderer/navigation/world-camera-math.ts';
import type { SurfaceAxes } from '../surface-minimap-math.mts';
import { required, position } from './navigation-test-values.mts';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cesiumMinimapExcerpts } from '../../tools/prepare/prepare-cesium-minimap.mts';
import { directionOnMap, mapDirection, orbitMapCamera } from '../surface-minimap-math.mts';
import { rotateWorldPosition, worldRotationFromQuaternion } from '@cssearth/renderer/navigation';
import Camera from '@cesium/engine/Source/Scene/Camera.js';
import Ellipsoid from '@cesium/engine/Source/Core/Ellipsoid.js';
import Rectangle from '@cesium/engine/Source/Core/Rectangle.js';
import { minimapCamera, rectangleOnMap, surfaceViewRectangle } from '../surface-minimap-rectangle.mts';
import { surfaceMapViewport } from '../surface-map-context.mts';

test('surface consumers use the published clipped viewport without measuring the scene', () => {
  const scene = { closest() { throw new Error('Unexpected layout read'); } };
  assert.deepEqual(surfaceMapViewport(scene as unknown as HTMLElement, { focalPixels: 800, framingRadiusPixels: 400, detailHandoffDiameterPixels: 320, principalOffsetPixels: [40, -20],
    visibleRect: { left: -600, right: 400, top: -300, bottom: 300 } }),
  { left: -.8, right: .45, top: -.35, bottom: .4 });
});

// Independently specified CSS surface axes: the first map column is +Y,
// quarter-turn east is +X, and north is +Z. A mirrored map must fail these.
const axes: SurfaceAxes = { prime: [0, 1, 0], east: [1, 0, 0], north: [0, 0, 1] };
const near = (a: number, b: number, epsilon = 1e-9) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const vectorNear = (a: readonly number[], b: readonly number[], epsilon = 1e-9) => a.forEach((value, i) => near(value, b[i], epsilon));

test('vendored Cesium helpers reproduce the pinned upstream methods verbatim', async () => {
  for (const [name, expected] of await cesiumMinimapExcerpts()) {
    assert.equal(await readFile(new URL(`../vendor/${name}`, import.meta.url), 'utf8'), expected);
  }
});

test('flat map cardinal landmarks retain east-west order and north-up orientation', () => {
  for (const [u, v, direction] of [[0, .5, [0, 1, 0]], [.25, .5, [1, 0, 0]], [.5, .5, [0, -1, 0]], [.75, .5, [-1, 0, 0]], [.2, 0, [0, 0, 1]]] as const) {
    vectorNear(mapDirection(u, v, axes), direction);
    const point = directionOnMap(direction, axes);
    near(point.v, v);
    if (v !== 0) near(point.u, u);
  }
  vectorNear(mapDirection(1.25, .5, axes), [1, 0, 0]);
});

test('map navigation rotates camera and eye together, retaining distance and roll', () => {
  const origin: PositionM = [1e11, -2e11, 3e11];
  const world: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5,
    pose: { positionM: position(origin.map((x, i) => x + [0, 0, 1e7][i])), orientationXyzw: [0, 0, Math.SQRT1_2, Math.SQRT1_2] } };
  const moved = orbitMapCamera(world, origin, [1, 0, 0]);
  vectorNear(moved.pose.positionM.map((x, i) => x - origin[i]), [1e7, 0, 0], 1e-4);
  const rotation = worldRotationFromQuaternion(moved.pose.orientationXyzw);
  vectorNear(rotateWorldPosition(rotation, [0, 0, -1]), [-1, 0, 0]);
  vectorNear(rotateWorldPosition(rotation, [1, 0, 0]), [0, 1, 0]);
  assert.equal(moved.referenceFrame, world.referenceFrame);
  assert.deepEqual(world.pose.orientationXyzw, [0, 0, Math.SQRT1_2, Math.SQRT1_2]);
});

test('opposite-side clicks and seam crossings stay finite and reach the requested point', () => {
  let world: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, pose: { positionM: [0, 10, 0], orientationXyzw: [0, 0, 0, 1] } };
  for (const u of [.5, .99, 1.01, -.01]) {
    world = orbitMapCamera(world, [0, 0, 0], mapDirection(u, .5, axes));
    vectorNear(world.pose.positionM, mapDirection(u, .5, axes).map(x => x * 10));
    near(Math.hypot(...world.pose.orientationXyzw), 1);
  }
});

const identity: WorldRotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const view = { left: -.8, right: .8, top: -.5, bottom: .5 };

test('minimap uses the upstream Cesium rectangle for zoom, roll, poles and horizon cases', () => {
  for (const distance of [1.02, 1.2, 2, 4]) {
    for (const u of [.001, .25, .7, .999]) {
      for (const v of [.001, .2, .5, .8, .999]) {
        const world = orbitMapCamera({ referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, pose: { positionM: [0, 0, distance], orientationXyzw: [0, 0, Math.sin(.3), Math.cos(.3)] } },
          [0, 0, 0], mapDirection(u, v, axes));
        const state = { eye: world.pose.positionM, rotation: worldRotationFromQuaternion(world.pose.orientationXyzw), view, axes };
        const expected: unknown = Reflect.apply(Camera.prototype.computeViewRectangle, minimapCamera(state), [Ellipsoid.UNIT_SPHERE]);
        assert.ok(expected === undefined || expected instanceof Rectangle);
        assert.deepEqual(surfaceViewRectangle(state).bounds, rectangleOnMap(expected));
      }
    }
  }
});

test('Cesium whole-globe fallback is retained and the rectangle shrinks with close zoom', () => {
  const far = surfaceViewRectangle({ eye: [0, 0, 4], rotation: identity, view, axes });
  assert.deepEqual(far.bounds, { left: 0, top: 0, width: 1, height: 1 });
  const close = surfaceViewRectangle({ eye: [0, 0, 1.1], rotation: identity, view, axes });
  assert.ok(required(close.bounds).height < required(far.bounds).height / 3);
  near(required(close.center).v, 0);
});

test('out-of-view globe hides the rectangle and zero-longitude bounds wrap on the texture', () => {
  const space = surfaceViewRectangle({ eye: [0, 0, 4], rotation: identity,
    view: { left: 1, right: 2, top: -.5, bottom: .5 }, axes });
  assert.deepEqual(space, { bounds: null, center: null });
  const wrapped = rectangleOnMap(new Rectangle(-Math.PI / 6, -Math.PI / 4, Math.PI / 6, Math.PI / 4));
  near(required(wrapped).left, 11 / 12);
  near(required(wrapped).width, 1 / 6);
  near(required(wrapped).top, .25);
  near(required(wrapped).height, .5);
});
