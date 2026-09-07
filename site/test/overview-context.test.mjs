import assert from 'node:assert/strict';
import test from 'node:test';
import context from '../../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import { overviewScopeAtCamera, viewDistance } from '../overview-context.mjs';

const camera = (distance, plan = context) => ({ pose: {
  positionM: plan.focus.positionM.map((value, axis) => value + (axis === 2 ? distance : 0)),
} });

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
