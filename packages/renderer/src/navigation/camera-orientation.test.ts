import { validateWorldRotation } from '@cssearth/objects';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { nearestWorldRotation } from '@cssearth/engine';

const multiply = (a: readonly number[], b: readonly number[]) => Array.from({ length: 9 }, (_, index) => {
  const row = Math.floor(index / 3), column = index % 3;
  return a[row * 3]! * b[column]! + a[row * 3 + 1]! * b[3 + column]! + a[row * 3 + 2]! * b[6 + column]!;
});
const yaw = (degrees: number) => { const c = Math.cos(degrees * Math.PI / 180), s = Math.sin(degrees * Math.PI / 180); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const pitch = (degrees: number) => { const c = Math.cos(degrees * Math.PI / 180), s = Math.sin(degrees * Math.PI / 180); return [1, 0, 0, 0, c, -s, 0, s, c]; };
// A matrix read back from a CSS string, which browsers hold at float32 (objects camera-pose.ts parseRestoredCameraPose).
const fromCss = (rows: readonly number[]) => rows.map(Math.fround);

it('a rebase by a matrix read from CSS leaves the camera check, and its nearest rotation passes it', () => {
  const scene = multiply(pitch(12), yaw(34)), change = fromCss(multiply(pitch(-7.3), yaw(121.9)));
  const rebased = multiply(scene, change);
  assert.throws(() => validateWorldRotation(rebased), /orthonormal|handedness/u, 'the drift this guards against is real');
  assert.doesNotThrow(() => validateWorldRotation(nearestWorldRotation(rebased)));
});

it('a rotation multiplied for many frames stays a rotation when each frame takes its nearest rotation', () => {
  let kept = pitch(12);
  for (let frame = 0; frame < 20_000; frame++) kept = nearestWorldRotation(multiply(frame % 500 === 0 ? fromCss(yaw(17.3)) : yaw(0.021), kept));
  assert.doesNotThrow(() => validateWorldRotation(kept));
});

it('a true rotation is its own nearest rotation', () => {
  const rotation = multiply(pitch(33), yaw(-71));
  for (const [index, value] of nearestWorldRotation(rotation).entries()) assert.ok(Math.abs(value - rotation[index]!) < 1e-15);
  assert.throws(() => nearestWorldRotation([0, 0, 0, 0, 1, 0, 0, 0, 1]), /degenerate/u);
});
