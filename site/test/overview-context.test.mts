import assert from 'node:assert/strict';
import test from 'node:test';
import preparedContext from '../../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import { bodyCardViewAtCamera, overviewScopeAtCamera, viewDistance } from '../overview-context.mts';
import { presentWorldCamera } from '../../src/renderers/css/dist/navigation.js';
import { parsePreparedWorldContext } from '../../src/renderers/css/dist/index.js';

// The same validated plan the application mounts; the raw JSON import is untyped.
const context = parsePreparedWorldContext(preparedContext);

import type { WorldCameraPose, PreparedWorldCameraFrame } from '../../src/renderers/css/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '../../src/renderers/css/runtime/world-navigation-types.ts';

const camera = (distance: number, plan: Pick<typeof context, 'focus'> = context): WorldCameraPose => ({
  referenceFrame: 'world', epochJdTt: 1, pose: {
    positionM: [plan.focus.positionM[0], plan.focus.positionM[1], plan.focus.positionM[2] + distance],
    orientationXyzw: [0, 0, 0, 1],
  },
});
const frameAt = (originM: PreparedWorldCameraFrame['originM'], bodyRadiusM: number): PreparedWorldCameraFrame => ({
  originM, bodyRadiusM, referenceFrame: 'world', epochJdTt: 1,
  presentationToReference: [1,0,0,0,1,0,0,0,1], metersPerUnit: 1,
});

test('body cards switch at the shared camera detail threshold, independent of camera aim', () => {
  const frame = frameAt([100, 200, 300], 1000);
  const optics: ReturnType<ObjectWorldNavigation["optics"]> = { framingRadiusPixels: 1, visibleRect: null, focalPixels: 1000, principalOffsetPixels: [0,0], widthPixels: 2000,
    heightPixels: 2000, detailHandoffDiameterPixels: 14 };
  const thresholdDistance = frame.bodyRadiusM * Math.sqrt(1 + (2 * optics.focalPixels / optics.detailHandoffDiameterPixels) ** 2);
  for (const [scale, expected] of [[0.99, 'detail'], [1.01, 'overview'], [1000, 'overview']] as const) {
    const world: WorldCameraPose = { referenceFrame: 'world', epochJdTt: 1, pose: {
      positionM: [frame.originM[0], frame.originM[1], frame.originM[2] + thresholdDistance * scale],
      orientationXyzw: [0,0,0,1],
    } };
    const silhouette = presentWorldCamera(world, frame, optics).silhouette;
    assert.ok(silhouette);
    const diameter = 2 * silhouette.tangentialSemiAxis;
    assert.equal(diameter <= optics.detailHandoffDiameterPixels ? 'overview' : 'detail', expected);
    assert.equal(bodyCardViewAtCamera(world, frame, optics, "fixture"), expected);
    const turned: WorldCameraPose = { ...world, pose: { ...world.pose, orientationXyzw: [0,1,0,0] } };
    assert.equal(bodyCardViewAtCamera(turned, frame, optics, "fixture"), expected, 'Looking away does not change zoom mode');
  }
  assert.equal(bodyCardViewAtCamera(camera(0, { ...context, focus: { ...context.focus, positionM: [...frame.originM] } }), frame, optics, "fixture"), 'detail');
  assert.equal(bodyCardViewAtCamera(null, frame, optics, "fixture"), 'detail');
});

test('overview follows the prepared galaxy fade and restores correctly at maximum zoom', () => {
  const { fadeStartDistanceM: start, fullDistanceM: full } = context.volume;
  assert.equal(overviewScopeAtCamera(camera(start)), 'solar-system');
  assert.equal(overviewScopeAtCamera(camera(full)), 'milky-way');
  assert.equal(overviewScopeAtCamera(camera(context.camera.maximumDistanceM)), 'milky-way');
  assert.equal(overviewScopeAtCamera(camera(start * 1.1), 'milky-way'), 'milky-way');
  assert.equal(overviewScopeAtCamera(camera(start * .99), 'milky-way'), 'solar-system');
});

test('galactic distance is measured from the Sun, independent of selected body and surface radius', () => {
  const plan = { ...context, focus: { ...context.focus, positionM: [100, 200, 300] as const } };
  const world = camera(500, plan), frame = frameAt([100, 200, 400], 20);
  const galactic = viewDistance(world, frame, 'milky-way', plan);
  assert.equal(galactic.label, 'Distance from Sun:');
  assert.equal(galactic.meters, 500);
  const surface = viewDistance(world, frame, 'solar-system', plan);
  assert.equal(surface.label, 'Altitude:');
  assert.equal(surface.meters, 380);
});

test('prepared focus distance follows its catalogue position independently of the selected detail and overview scope', () => {
  const focus = { name: 'Prepared galaxy', positionM: [1e20, 2e20, -3e20] as const };
  const world = camera(1e18, { ...context, focus: { ...context.focus, positionM: [1e20, 2e20, -3e20] } });
  const frame = frameAt([100,200,300], 20);
  const value = viewDistance(world, frame, 'milky-way', undefined, focus);
  assert.equal(value.label, 'Distance to Prepared galaxy:');
  assert.ok(Math.abs(value.meters / 1e18 - 1) < 1e-12);
  assert.equal(viewDistance(world, frame, 'solar-system', undefined, focus).meters, value.meters);
  assert.equal(viewDistance(world, frame, 'milky-way').label, 'Distance from Sun:');
});
