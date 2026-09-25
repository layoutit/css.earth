import { test } from 'vitest';
import assert from 'node:assert/strict';
import { densityPlacementTransform, parseDensityPlacement, placeDensitySlices } from './density-placement.ts';
import type { VolumeSlices } from '../contracts/volume-slices.ts';
const placement = parseDensityPlacement({ schema: 'cssearth-density-placement@1', scale: 2, rotationZDegrees: 90,
  pivotUnits: [1, 2, 3], translationUnits: [4, 5, 6] });
test('model placement transports full support with invertible points and rotated normals', () => {
  const transform = densityPlacementTransform(placement), point = transform.point([2, 2, 4]);
  assert.deepEqual(point, [5, 9, 11]); assert.deepEqual(transform.inverse(point), [2, 2, 4]);
  const normal = transform.normal([1, 0, 0]); assert.ok(Math.abs(normal[0]) < 1e-12); assert.equal(normal[1], 1);
  assert.deepEqual(transform.bounds({ min: [1, 2, 3], max: [2, 3, 4] }), { min: [3, 7, 9], max: [5, 9, 11] });
  assert.throws(() => parseDensityPlacement({ ...placement, scale: 0 }));
});
test('authored placement changes coordinates only, retaining every texture pin, pixel grid, UV and alpha statistic', () => {
  const quad = { id: 'z0', axis: 'z' as const, sliceIndex: 0, texturePath: 'slice.png', widthPx: 3, heightPx: 4,
    vertices: [[1, 2, 3], [2, 2, 3], [2, 3, 3], [1, 3, 3]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
    center: [1.5, 2.5, 3], normal: [0, 0, 1], sha256: 'a'.repeat(64), bytes: 25, alphaCoverage: .7 };
  const input = { quads: [quad], boundsUnits: { min: [1, 2, 3], max: [2, 3, 4] }, provenance: {},
    approximation: { slabPitchUnits: { x: 1, y: 2, z: 3 } } } as VolumeSlices;
  const output = placeDensitySlices(input, placement);
  for (const key of ['texturePath', 'widthPx', 'heightPx', 'uvs', 'sha256', 'bytes', 'alphaCoverage'] as const)
    assert.deepEqual(output.quads[0]![key], input.quads[0]![key]);
  assert.deepEqual(input.quads[0]!.vertices, quad.vertices); assert.notDeepEqual(output.quads[0]!.vertices, quad.vertices);
  assert.deepEqual(output.approximation.slabPitchUnits, { x: 2, y: 4, z: 6 });
});
