import test from 'node:test';
import assert from 'node:assert/strict';
import { formatViewCoordinate, formatViewDate, formatViewDistance, measureView, viewScale } from '../view-readout.mjs';

const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const state = { eyeM: [0, 0, 3e6], radiusM: 1e6, rotation: identity,
  view: { left: -.5, right: .5, top: -.5, bottom: .5 }, focalPixels: 1000,
  axes: { prime: [0, 0, 1], east: [1, 0, 0], north: [0, 1, 0] } };

test('scene date follows the numeric TT epoch across calendar days', () => {
  assert.equal(formatViewDate(2461286.5), 'Thursday, 3 September 2026');
  assert.equal(formatViewDate(2461287.5), 'Friday, 4 September 2026');
  assert.equal(formatViewDate(null), '—');
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
  assert.equal(value.scale.label, '100 km');
  assert.equal(value.scale.pixels, 80);
  assert.ok(Math.abs(value.scale.measurePixels - 50) < .0001);
  assert.match(value.scaleTitle, /surface/);
});

test('prepared surface measurements remain valid inside the enclosing reference sphere', () => {
  const value = measureView({ ...state, eyeM: [0, 0, 999000], surface: { altitudeM: 26000, metersPerPixel: 25 } });
  assert.equal(value.altitudeM, 26000);
  assert.deepEqual(value.scale, { label: '2 km', pixels: 80, measurePixels: 80 });
  assert.match(value.scaleTitle, /rendered view/);
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
  assert.equal(value.scale.label, '100 km');
});

test('galaxy distances keep a finite ruler without a spurious surface hit', () => {
  const value = measureView({ ...state, eyeM: [0, 0, 1e21] });
  assert.equal(value.coordinates, null);
  assert.ok(Number.isFinite(value.scale.pixels));
  assert.match(value.scale.label, /ly$/);
});
