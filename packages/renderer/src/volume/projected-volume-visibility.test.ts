import assert from 'node:assert/strict';
import { test } from 'node:test';
import { outsideVolumeOpacity } from './projected-volume-visibility.ts';

const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [1000, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 10,
  boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } } as unknown as Parameters<typeof outsideVolumeOpacity>[1];
const from = (distanceM: number) => ({ pose: { positionM: [1000 + distanceM, 0, 0], orientationXyzw: [0, 0, 0, 1] } }) as unknown as Parameters<typeof outsideVolumeOpacity>[0];

test('a volume\'s billboard draws only from outside its framing sphere, whole from a quarter of its radius farther out', () => {
  // The sphere is 4 units, 40 m, in radius.
  assert.equal(outsideVolumeOpacity(from(5), frame, 4), 0, 'beside a star inside the galaxy');
  assert.equal(outsideVolumeOpacity(from(40), frame, 4), 0, 'on the sphere');
  assert.ok(Math.abs(outsideVolumeOpacity(from(40 * Math.sqrt(1.25)), frame, 4) - .5) < 1e-9, 'halfway, in the logarithm');
  assert.equal(outsideVolumeOpacity(from(50), frame, 4), 1);
  assert.equal(outsideVolumeOpacity(from(5000), frame, 4), 1, 'from the Local Group');
});
