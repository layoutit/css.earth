import assert from 'node:assert/strict';
import test from 'node:test';
import context from '../../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import { bodyCardViewAtCamera, overviewScopeAtCamera, viewDistance } from '../overview-context.mts';
import { presentWorldCamera } from '../../src/renderers/css/dist/navigation.js';

const camera = (distance, plan = context) => ({ pose: {
  positionM: plan.focus.positionM.map((value, axis) => value + (axis === 2 ? distance : 0)),
} });

test('body cards switch at the shared camera detail threshold, independent of camera aim', () => {
  const frame = { referenceFrame: 'world', epochJdTt: 1, originM: [100, 200, 300],
    presentationToReference: [1,0,0,0,1,0,0,0,1], metersPerUnit: 1, bodyRadiusM: 1000 };
  const optics = { focalPixels: 1000, principalOffsetPixels: [0,0], widthPixels: 2000,
    heightPixels: 2000, detailHandoffDiameterPixels: 14 };
  const thresholdDistance = frame.bodyRadiusM * Math.sqrt(1 + (2 * optics.focalPixels / optics.detailHandoffDiameterPixels) ** 2);
  for (const [scale, expected] of [[0.99, 'detail'], [1.01, 'overview'], [1000, 'overview']]) {
    const world = { referenceFrame: 'world', epochJdTt: 1, pose: {
      positionM: frame.originM.map((value, axis) => value + (axis === 2 ? thresholdDistance * scale : 0)),
      orientationXyzw: [0,0,0,1],
    } };
    const diameter = 2 * presentWorldCamera(world, frame, optics).silhouette.tangentialSemiAxis;
    assert.equal(diameter <= optics.detailHandoffDiameterPixels ? 'overview' : 'detail', expected);
    assert.equal(bodyCardViewAtCamera(world, frame, optics), expected);
    world.pose.orientationXyzw = [0,1,0,0];
    assert.equal(bodyCardViewAtCamera(world, frame, optics), expected, 'Looking away does not change zoom mode');
  }
  assert.equal(bodyCardViewAtCamera({ pose: { positionM: frame.originM } }, frame, optics), 'detail');
  assert.equal(bodyCardViewAtCamera(null, frame, optics), 'detail');
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
  const plan = { focus: { positionM: [100, 200, 300] } };
  const world = camera(500, plan), frame = { originM: [100, 200, 400], bodyRadiusM: 20 };
  const galactic = viewDistance(world, frame, 'milky-way', plan);
  assert.equal(galactic.label, 'Distance from Sun:');
  assert.equal(galactic.meters, 500);
  const surface = viewDistance(world, frame, 'solar-system', plan);
  assert.equal(surface.label, 'Altitude:');
  assert.equal(surface.meters, 380);
});
