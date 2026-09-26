import { expect, test } from 'vitest';
import { createSelectionFlight, sampleSelectionFlight } from '@cssearth/engine';
import { readFile } from 'node:fs/promises';
import { createWorldSelectionTarget } from './selection-target.js';
import { worldCameraFromCenteredPresentation, presentWorldCamera } from './world-camera.js';
import { parsePreparedWorldCameraFrame } from '../validation/world-frame.js';

const viewport = { focalPixels: 1247.08, principalOffsetPixels: [-170, 0] as const, framingRadiusPixels: 259.2 };
for (const [fromId, toId] of [['mercury', 'venus'], ['venus', 'mercury']]) {
  test(`${fromId} to ${toId} arrives at the authored physical size without resetting the viewing angle`, async () => {
    const frames = await Promise.all([fromId, toId].map(async id => {
      const descriptor = JSON.parse(await readFile(new URL(`../../../../src/objects/${id}/object.json`, import.meta.url), 'utf8'));
      return parsePreparedWorldCameraFrame(descriptor.properties.worldFrame)!;
    }));
    const [source, target] = frames;
    const from = worldCameraFromCenteredPresentation({ rotation: [1,0,0,0,1,0,0,0,1], distanceUnits: 3000 }, source, viewport);
    const result = createWorldSelectionTarget(from, target, viewport);
    const presentation = presentWorldCamera(result, target, viewport);
    expect(presentation.centerPixels![0]).toBeCloseTo(0, 6);
    expect(presentation.centerPixels![1]).toBeCloseTo(0, 6);
    expect(presentation.silhouette!.tangentialSemiAxis).toBeCloseTo(259.2, 6);
    expect(result.pose.orientationXyzw).toEqual(from.pose.orientationXyzw);
    expect(presentation.distanceM).toBeGreaterThan(target.bodyRadiusM);
    expect(Math.hypot(...result.pose.orientationXyzw)).toBeCloseTo(1, 12);
  });
}

test.each([-1, 1])('a departure above or below the orbital plane (%s) approaches the screen center without rotation', sign => {
  const frame = parsePreparedWorldCameraFrame({ referenceFrame: 'test', epochJdTt: 1,
    originM: [0,0,0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1],
    metersPerUnit: 1, bodyRadiusM: 1, orbitUpReference: [0,-1,0] })!;
  const from = { referenceFrame: 'test', epochJdTt: 1,
    pose: { positionM: [10, sign * 100, 1000] as const, orientationXyzw: [0,0,0,1] as const } };
  const to = createWorldSelectionTarget(from, frame, viewport);
  const flight = createSelectionFlight({ from: from.pose, to: to.pose, focusPositionM: frame.originM });
  let previousOffset = Infinity;
  for (let step = 0; step <= 60; step++) {
    const sample = sampleSelectionFlight(flight, step * flight.durationS / 60);
    expect(sample.orientationXyzw).toEqual(from.pose.orientationXyzw);
    const projection = presentWorldCamera({ ...from, pose: sample }, frame, viewport);
    expect(projection.centerPixels).not.toBeNull();
    const offset = Math.hypot(...projection.centerPixels!);
    expect(offset).toBeLessThanOrEqual(previousOffset + 1e-8);
    previousOffset = offset;
  }
  expect(previousOffset).toBeLessThan(1e-8);
  expect(sampleSelectionFlight(flight, flight.durationS).positionM).toEqual(to.pose.positionM);
});

test('invalid epoch, reflected frame, and non-unit prepared horizon fail at their boundaries', () => {
  const frame = { referenceFrame: 'test', epochJdTt: 1, originM: [0,0,0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1 };
  expect(() => parsePreparedWorldCameraFrame({ ...frame, orbitUpReference: [0,2,0] })).toThrow('unit');
  expect(() => parsePreparedWorldCameraFrame({ ...frame, presentationToReference: [1,0,0,0,1,0,0,0,1] })).toThrow('handedness');
  const valid = parsePreparedWorldCameraFrame(frame)!;
  expect(() => createWorldSelectionTarget({ referenceFrame: 'test', epochJdTt: 2,
    pose: { positionM: [0,0,10], orientationXyzw: [0,0,0,1] } }, valid, viewport)).toThrow('epoch');
});
