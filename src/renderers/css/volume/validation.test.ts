import { expect, test } from 'vitest';
import { cameraPoseToReferenceFrame } from '@cssearth/engine';
import { validatePreparedCssVolume } from './validation.js';
import type { PreparedCssVolume } from './types.js';
import { preparedVolumeCameraTransform } from './prepared-volume-runtime.js';

const valid = (): PreparedCssVolume => ({
  schema: 'cssearth-css-volume@1', id: 'milky-way',
  frame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1,
    boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
  anchors: [],
  stacks: [{ axis: 'x', leaves: [{ id: 'x-0', centerUnits: [0, 0, 0], texturePath: 'slices/x/00.png', widthPx: 2, heightPx: 2,
    style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] },
    { axis: 'y', leaves: [{ id: 'y-0', centerUnits: [0, 0, 0], texturePath: 'slices/y/00.png', widthPx: 2, heightPx: 2,
      style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] },
    { axis: 'z', leaves: [{ id: 'z-0', centerUnits: [0, 0, 0], texturePath: 'slices/z/00.png', widthPx: 2, heightPx: 2,
      style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] }],
  resources: ['x', 'y', 'z'].map(axis => ({ path: `slices/${axis}/00.png`, sha256: 'a'.repeat(64), bytes: 2, width: 2, height: 2 })),
  provenance: {}, approximation: {},
});

test('accepts the direct prepared CSS volume payload and all three stacks', () => {
  expect(validatePreparedCssVolume(valid()).stacks).toHaveLength(3);
});

test('rejects a runtime URL in authored leaf style', () => {
  const value = valid();
  Object.assign(value.stacks[0]!.leaves[0]!, { style: { ...value.stacks[0]!.leaves[0]!.style, transform: 'url(/runtime.png)' } });
  expect(() => validatePreparedCssVolume(value)).toThrow('URL-free');
});

test('projects the Sun anchor and arbitrary points through the same canonical observer', () => {
  const frame = valid().frame;
  const localFrame = { originM: frame.originM, localToReferenceXyzw: frame.localToReferenceXyzw };
  const poses = [
    { positionM: [2.1, -1.4, 4.8] as const, orientationXyzw: unit([0.11, -0.21, 0.07, 0.965]) },
    { positionM: [-3.2, 1.7, 2.6] as const, orientationXyzw: unit([-0.18, 0.09, 0.23, 0.95]) },
    { positionM: [0.8, 2.9, -4.1] as const, orientationXyzw: unit([0.29, 0.12, -0.16, 0.93]) },
  ];
  const points = [[0.25, -0.3, 0.1] as const, [-0.6, 0.4, 0.7] as const];
  for (const pose of poses) {
    const world = { referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
      pose: cameraPoseToReferenceFrame(pose, localFrame) };
    const viewport = { focalPixels: 720, principalOffsetPixels: [17, -11] as const };
    const transform = preparedVolumeCameraTransform({ world, viewport }, frame, 50);
    const local = pose;
    const cameraToVolume = matrixFromQuaternion(local.orientationXyzw);
    // The pose's camera axes are right, up and toward the eye; CSS eye space reverses up.
    const view = [cameraToVolume[0]!, cameraToVolume[3]!, cameraToVolume[6]!, -cameraToVolume[1]!, -cameraToVolume[4]!, -cameraToVolume[7]!, cameraToVolume[2]!, cameraToVolume[5]!, cameraToVolume[8]!];
    for (const point of points) {
      const source = [point[1], point[0], point[2]] as const;
      const expected = [
        viewport.principalOffsetPixels[0] + (dot(view, 0, source) - dot(view, 0, local.positionM)) * 50,
        viewport.principalOffsetPixels[1] + (dot(view, 3, source) - dot(view, 3, local.positionM)) * 50,
        viewport.focalPixels + (dot(view, 6, source) - dot(view, 6, local.positionM)) * 50,
      ];
      const actual = transformPoint(transform.rotation, transform.translationCssPixels, point, 50);
      expect(actual[0]).toBeCloseTo(expected[0], 8);
      expect(actual[1]).toBeCloseTo(expected[1], 8);
      expect(actual[2]).toBeCloseTo(expected[2], 8);
    }
  }
});

function matrixFromQuaternion([x, y, z, w]: readonly [number, number, number, number]): readonly number[] {
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}
function unit(value: readonly [number, number, number, number]): readonly [number, number, number, number] {
  const length = Math.hypot(...value);
  return [value[0] / length, value[1] / length, value[2] / length, value[3] / length];
}
function dot(matrix: readonly number[], offset: number, point: readonly number[]): number {
  return matrix[offset]! * point[0]! + matrix[offset + 1]! * point[1]! + matrix[offset + 2]! * point[2]!;
}
function transformPoint(rotation: readonly number[], translation: readonly [number, number, number], point: readonly [number, number, number], scale: number): readonly [number, number, number] {
  return [translation[0] + dot(rotation, 0, [point[0] * scale, point[1] * scale, point[2] * scale]),
    translation[1] + dot(rotation, 3, [point[0] * scale, point[1] * scale, point[2] * scale]),
    translation[2] + dot(rotation, 6, [point[0] * scale, point[1] * scale, point[2] * scale])];
}

test('rotated bank normals must remain an orthonormal basis', () => {
  const value = valid();
  const normals = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
  value.stacks.forEach((stack, i) => Object.assign(stack, { normalUnits: normals[i] }));
  expect(validatePreparedCssVolume(value).stacks[0]!.normalUnits).toEqual([0, 1, 0]);
  Object.assign(value.stacks[1]!, { normalUnits: [0, 1, 0] }); expect(() => validatePreparedCssVolume(value)).toThrow('orthogonal');
  Object.assign(value.stacks[1]!, { normalUnits: [0, 2, 0] }); expect(() => validatePreparedCssVolume(value)).toThrow('unit vector');
});
