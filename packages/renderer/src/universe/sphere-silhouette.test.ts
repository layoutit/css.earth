import { expect, test } from 'vitest';
import { silhouetteBottom, sphereSilhouette } from './sphere-silhouette.js';

const viewport = { focalPixels: 1000, principalOffsetPixels: [0, 0] as const, widthPixels: 1000, heightPixels: 800 };
const from = (positionM: readonly [number, number, number]) => ({ referenceFrame: 'sun-icrf', epochJdTt: 2451545,
  pose: { positionM, orientationXyzw: [0, 0, 0, 1] as const } });

test('a sphere seen straight on is a circle of radius f tan(alpha)', () => {
  const shape = sphereSilhouette(from([0, 0, 2]), viewport, [0, 0, 0], 1)!;
  expect(shape.x).toBeCloseTo(0); expect(shape.y).toBeCloseTo(0);
  expect(shape.major).toBeCloseTo(1000 * Math.tan(Math.PI / 6)); expect(shape.minor).toBeCloseTo(shape.major);
  expect(silhouetteBottom(shape)).toBeCloseTo(shape.major);
});

test('off the axis the outline stretches along the line to the centre, and its ends are the grazing lines', () => {
  const shape = sphereSilhouette(from([-1, 0, 2]), viewport, [0, 0, 0], 0.5)!;
  const theta = Math.atan2(1, 2), alpha = Math.asin(0.5 / Math.hypot(1, 2));
  expect(shape.x - shape.major).toBeCloseTo(1000 * Math.tan(theta - alpha));
  expect(shape.x + shape.major).toBeCloseTo(1000 * Math.tan(theta + alpha));
  expect(shape.major).toBeGreaterThan(shape.minor);
  expect(sphereSilhouette(from([0, 0, 0.5]), viewport, [0, 0, 0], 1), 'none from inside').toBeNull();
  expect(sphereSilhouette(from([0, 0, -2]), viewport, [0, 0, 0], 1), 'none from behind').toBeNull();
});
