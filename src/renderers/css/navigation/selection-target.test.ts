import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createWorldSelectionTarget } from './selection-target.js';
import { worldCameraFromCenteredPresentation, presentWorldCamera } from './world-camera.js';
import { parsePreparedWorldCameraFrame } from '../validation/world-frame.js';

const viewport = { focalPixels: 1247.08, principalOffsetPixels: [-170, 0] as const, framingRadiusPixels: 259.2 };
for (const [fromId, toId] of [['mercury', 'venus'], ['venus', 'mercury']]) {
  test(`${fromId} to ${toId} arrives at the authored physical size and orbital horizon`, async () => {
    const frames = await Promise.all([fromId, toId].map(async id => {
      const descriptor = JSON.parse(await readFile(new URL(`../../../planets/${id}/object.json`, import.meta.url), 'utf8'));
      return parsePreparedWorldCameraFrame(descriptor.properties.worldFrame)!;
    }));
    const [source, target] = frames;
    const from = worldCameraFromCenteredPresentation({ rotation: [1,0,0,0,1,0,0,0,1], distanceUnits: 3000 }, source, viewport);
    const result = createWorldSelectionTarget(from, target, viewport);
    const presentation = presentWorldCamera(result, target, viewport);
    expect(presentation.centerPixels![0]).toBeCloseTo(0, 6);
    expect(presentation.centerPixels![1]).toBeCloseTo(0, 6);
    expect(presentation.silhouette!.tangentialSemiAxis).toBeCloseTo(259.2, 6);
    const offset = result.pose.positionM.map((value, axis) => value - target.originM[axis]);
    const height = offset.reduce((sum, value, axis) => sum + value * target.orbitUpReference![axis], 0);
    expect(Math.abs(height)).toBeLessThan(.0001);
    expect(presentation.distanceM).toBeGreaterThan(target.bodyRadiusM);
    expect(Math.hypot(...result.pose.orientationXyzw)).toBeCloseTo(1, 12);
  });
}

test('invalid epoch, reflected frame, and non-unit prepared horizon fail at their boundaries', () => {
  const frame = { referenceFrame: 'test', epochJdTt: 1, originM: [0,0,0], presentationToReference: [1,0,0,0,1,0,0,0,1], metersPerUnit: 1, bodyRadiusM: 1 };
  expect(() => parsePreparedWorldCameraFrame({ ...frame, orbitUpReference: [0,2,0] })).toThrow('unit');
  expect(() => parsePreparedWorldCameraFrame({ ...frame, presentationToReference: [-1,0,0,0,1,0,0,0,1] })).toThrow('handedness');
  const valid = parsePreparedWorldCameraFrame(frame)!;
  expect(() => createWorldSelectionTarget({ referenceFrame: 'test', epochJdTt: 2,
    pose: { positionM: [0,0,10], orientationXyzw: [0,0,0,1] } }, valid, viewport)).toThrow('epoch');
});
