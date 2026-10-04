import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createSelectionFlight, sampleSelectionFlight, worldCameraFromCenteredPresentation } from '@cssearth/engine';
import { readFile } from 'node:fs/promises';
import { createWorldSelectionTarget } from './selection-target.js';
import { parsePreparedWorldCameraFrame } from '@cssearth/objects';
import { presentWorldCamera } from './world-camera.js';

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
    assert.ok(Math.abs(presentation.centerPixels![0] - (0)) < 10 ** -6 / 2, `${presentation.centerPixels![0]} is not close to ${0}`);
    assert.ok(Math.abs(presentation.centerPixels![1] - (0)) < 10 ** -6 / 2, `${presentation.centerPixels![1]} is not close to ${0}`);
    assert.ok(Math.abs(presentation.silhouette!.tangentialSemiAxis - (259.2)) < 10 ** -6 / 2, `${presentation.silhouette!.tangentialSemiAxis} is not close to ${259.2}`);
    assert.deepEqual(result.pose.orientationXyzw, from.pose.orientationXyzw);
    assert.ok(presentation.distanceM > target.bodyRadiusM);
    assert.ok(Math.abs(Math.hypot(...result.pose.orientationXyzw) - (1)) < 10 ** -12 / 2, `${Math.hypot(...result.pose.orientationXyzw)} is not close to ${1}`);
  });
}

for (const sign of [-1, 1]) test(`a departure above or below the orbital plane (${sign}) approaches the screen center without rotation`, () => {
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
    assert.deepEqual(sample.orientationXyzw, from.pose.orientationXyzw);
    const projection = presentWorldCamera({ ...from, pose: sample }, frame, viewport);
    assert.notEqual(projection.centerPixels, null);
    const offset = Math.hypot(...projection.centerPixels!);
    assert.ok(offset <= previousOffset + 1e-8);
    previousOffset = offset;
  }
  assert.ok(previousOffset < 1e-8);
  assert.deepEqual(sampleSelectionFlight(flight, flight.durationS).positionM, to.pose.positionM);
});

test('invalid epoch, reflected frame, and non-unit prepared horizon fail at their boundaries', () => {
  const frame = { referenceFrame: 'test', epochJdTt: 1, originM: [0,0,0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1 };
  assert.throws(() => parsePreparedWorldCameraFrame({ ...frame, orbitUpReference: [0,2,0] }), /unit/);
  assert.throws(() => parsePreparedWorldCameraFrame({ ...frame, presentationToReference: [1,0,0,0,1,0,0,0,1] }), /handedness/);
  const valid = parsePreparedWorldCameraFrame(frame)!;
  assert.throws(() => createWorldSelectionTarget({ referenceFrame: 'test', epochJdTt: 2,
    pose: { positionM: [0,0,10], orientationXyzw: [0,0,0,1] } }, valid, viewport), /epoch/);
});
