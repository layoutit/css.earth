import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { silhouetteBottom, sphereSilhouette } from './sphere-silhouette.js';

const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
const from = (positionM: readonly [number, number, number]) => ({ referenceFrame: 'sun-icrf', epochJdTt: 2451545,
  pose: { positionM, orientationXyzw: [0, 0, 0, 1] as const } });

test('a sphere seen straight on is a circle of radius f tan(alpha)', () => {
  const shape = sphereSilhouette(from([0, 0, 2]), viewport, [0, 0, 0], 1)!;
  assert.ok(Math.abs(shape.x - (0)) < 10 ** -2 / 2, `${shape.x} is not close to ${0}`); assert.ok(Math.abs(shape.y - (0)) < 10 ** -2 / 2, `${shape.y} is not close to ${0}`);
  assert.ok(Math.abs(shape.major - (1000 * Math.tan(Math.PI / 6))) < 10 ** -2 / 2, `${shape.major} is not close to ${1000 * Math.tan(Math.PI / 6)}`); assert.ok(Math.abs(shape.minor - (shape.major)) < 10 ** -2 / 2, `${shape.minor} is not close to ${shape.major}`);
  assert.ok(Math.abs(silhouetteBottom(shape) - (shape.major)) < 10 ** -2 / 2, `${silhouetteBottom(shape)} is not close to ${shape.major}`);
});

test('off the axis the outline stretches along the line to the centre, and its ends are the grazing lines', () => {
  const shape = sphereSilhouette(from([-1, 0, 2]), viewport, [0, 0, 0], 0.5)!;
  const theta = Math.atan2(1, 2), alpha = Math.asin(0.5 / Math.hypot(1, 2));
  assert.ok(Math.abs((shape.x - shape.major) - (1000 * Math.tan(theta - alpha))) < 10 ** -2 / 2, `${(shape.x - shape.major)} is not close to ${1000 * Math.tan(theta - alpha)}`);
  assert.ok(Math.abs((shape.x + shape.major) - (1000 * Math.tan(theta + alpha))) < 10 ** -2 / 2, `${(shape.x + shape.major)} is not close to ${1000 * Math.tan(theta + alpha)}`);
  assert.ok(shape.major > shape.minor);
  assert.equal(sphereSilhouette(from([0, 0, 0.5]), viewport, [0, 0, 0], 1), null, 'none from inside');
  assert.equal(sphereSilhouette(from([0, 0, -2]), viewport, [0, 0, 0], 1), null, 'none from behind');
});
