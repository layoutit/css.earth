import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { PositionM } from '@cssearth/engine';
import { apply, blendOrientations, composeRotations, heldRotation, sceneUp, transposeRotation, turnAboutUp } from './free-camera.js';
import { validateWorldRotation } from './world-camera-math.js';

const close = (actual: readonly number[], expected: readonly number[], tolerance = 1e-12) =>
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]!) <= tolerance, `${actual} vs ${expected}`));
// An arbitrary tilted vertical in a scene frame.
const tilt = -26.73 * Math.PI / 180, spin = 60 * Math.PI / 180;
const pole: PositionM = [Math.cos(spin) * Math.sin(tilt), Math.sin(spin) * Math.sin(tilt), Math.cos(tilt)];
// An arbitrary orbit-mode orientation to project from.
const current = composeRotations(turnAboutUp([1, 0, 0, 0, 1, 0, 0, 0, 1], [0.3, -0.8, 0.52], 71),
  turnAboutUp([1, 0, 0, 0, 1, 0, 0, 0, 1], [1, 0.2, 0], -38));

test('the free camera shows the vertical at the chosen elevation, with no roll', () => {
  for (const elevation of [0, Math.atan(Math.SQRT1_2) * 180 / Math.PI, 60, 90]) {
    const rotation = heldRotation(current, pole, elevation);
    validateWorldRotation(rotation);
    const radians = elevation * Math.PI / 180;
    close(apply(rotation, pole), [0, -Math.cos(radians), Math.sin(radians)]);
  }
});

test('the free camera keeps the current heading', () => {
  const rotation = heldRotation(current, pole, 35);
  const project = (r: readonly number[]) => {
    const right: PositionM = [r[0]!, r[1]!, r[2]!], along = right[0] * pole[0] + right[1] * pole[1] + right[2] * pole[2];
    const flat = right.map((value, axis) => value - along * pole[axis]!), length = Math.hypot(...flat);
    return flat.map(value => value / length);
  };
  close(project(rotation), project(current));
  // Re-applying it changes nothing: every publication can hold the view without drift.
  close(heldRotation(rotation, pole, 35), rotation);
});

test('a turn about the pole keeps the elevation', () => {
  const rotation = heldRotation(current, pole, 35);
  const turned = composeRotations(turnAboutUp(rotation, pole, 47), rotation);
  validateWorldRotation(turned);
  close(apply(turned, pole), apply(rotation, pole));
  close(composeRotations(turned, transposeRotation(turned)), [1, 0, 0, 0, 1, 0, 0, 0, 1]);
});

test('the world vertical reaches each scene through its prepared presentation frame', () => {
  const obliquity = 84381.448 / 3600 * Math.PI / 180, north = [0, -Math.sin(obliquity), Math.cos(obliquity)] as const;
  // A CSS scene is a reflection of the reference frame: y runs down.
  const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461000.5, originM: [0, 0, 0] as PositionM,
    presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1 };
  close(sceneUp(frame, north), [0, Math.sin(obliquity), Math.cos(obliquity)]);
});

test('the settle blend runs from the flight orientation to the level one', () => {
  const from = [0, 0, Math.sin(0.4), Math.cos(0.4)] as const, to = [0, 0, -Math.sin(0.1), -Math.cos(0.1)] as const;
  close(blendOrientations(from, to, 0), from);
  close(blendOrientations(from, to, 1), to.map(value => -value));
  const middle = blendOrientations(from, to, 0.5);
  close([Math.hypot(...middle)], [1]);
});
