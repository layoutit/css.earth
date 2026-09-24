import { sourceTest } from '../../tests/objects/source-test.mts';
import assert from 'node:assert/strict';
import type { WorldCameraPose } from '../../src/renderers/css/navigation/world-camera.ts';
import type { WorldRotation } from '../../src/renderers/css/navigation/world-camera-math.ts';
import { required } from './navigation-test-values.mts';
import { formatViewCoordinate, formatViewDate, formatViewDistance, viewScale } from '../view-format.mts';
import { measurePreparedFocusView } from '../view-readout.mts';
import { measureView } from '../surface-minimap-rectangle.mts';
const test = sourceTest();

const identity: WorldRotation = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const state: Parameters<typeof measureView>[0] = { eyeM: [0, 0, 3e6], radiusM: 1e6, rotation: identity,
  view: { left: -.5, right: .5, top: -.5, bottom: .5 }, focalPixels: 1000,
  axes: { prime: [0, 0, 1], east: [1, 0, 0], north: [0, 1, 0] } };

test('scene date includes the calendar time and TT scale across calendar days', () => {
  assert.equal(formatViewDate(2461286.5), '2026-09-03 00:00 TT');
  assert.equal(formatViewDate(2461286.75), '2026-09-03 06:00 TT');
  assert.equal(formatViewDate(2461287.5), '2026-09-04 00:00 TT');
  assert.equal(Reflect.apply(formatViewDate, undefined, [null]), '—');
});

test('coordinates carry rounded seconds and preserve hemispheres', () => {
  assert.equal(formatViewCoordinate(-34.9020972, 'N', 'S'), '34°54′07.55″ S');
  assert.equal(formatViewCoordinate(179.99999999, 'E', 'W'), '180°00′00.00″ E');
});

test('altitude and distance scale use physical units across camera ranges', () => {
  assert.equal(formatViewDistance(1234567), '1,235 km');
  assert.equal(formatViewDistance(149597870700), '1 AU');
  assert.equal(formatViewDistance(9460730472580800), '1 ly');
  assert.deepEqual(viewScale(2000), { label: '100 km', pixels: 80, measurePixels: 50 });
  assert.equal(viewScale(0), null);
});

test('surface ruler measures the front surface, not the center plane', () => {
  const value = measureView(state);
  assert.equal(value.altitudeM, 2e6);
  assert.deepEqual(value.coordinates, { latitude: 0, longitude: 0 });
  assert.equal(required(value.scale).label, '100 km');
  assert.equal(required(value.scale).pixels, 80);
  assert.ok(Math.abs(required(value.scale).measurePixels - 50) < .0001);
  assert.match(value.scaleTitle, /surface/);
});

test('looking away supplies no invented surface coordinates or behind-camera ruler', () => {
  const value = measureView({ ...state, rotation: [-1, 0, 0, 0, 1, 0, 0, 0, -1] });
  assert.equal(value.coordinates, null);
  assert.equal(value.scale, null);
  assert.equal(value.altitudeM, 2e6);
});

test('objects without prepared geographic axes still have altitude and scale', () => {
  const value = measureView({ ...state, axes: undefined });
  assert.equal(value.coordinates, null);
  assert.equal(required(value.scale).label, '100 km');
});

test('galaxy distances keep a finite ruler without a spurious surface hit', () => {
  const value = measureView({ ...state, eyeM: [0, 0, 1e21] });
  assert.equal(value.coordinates, null);
  assert.ok(Number.isFinite(required(value.scale).pixels));
  assert.match(required(value.scale).label, /ly$/);
});

test('prepared focus uses its own depth plane for scale and never supplies planetary coordinates', () => {
  const focus: Parameters<typeof measurePreparedFocusView>[1] = { name: 'Prepared galaxy', positionM: [1e20, 0, 0] };
  const world: WorldCameraPose = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, pose: { positionM: [1e20, 0, 1e18], orientationXyzw: [0,0,0,1] } };
  const value = measurePreparedFocusView(world, focus, 1000);
  assert.deepEqual(value.scale, viewScale(1e15));
  assert.equal(value.coordinates, null);
  assert.equal(value.scaleTitle, 'Scale at the distance of Prepared galaxy');
  assert.equal(measurePreparedFocusView({ ...world, pose: { ...world.pose, orientationXyzw: [0,1,0,0] } }, focus, 1000).scale, null);
});
