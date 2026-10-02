import { it } from 'node:test';
import assert from 'node:assert/strict';
import { advanceSelectionFlightInto, createSelectionFlight, createSelectionFlightSample } from '@cssearth/engine';
import type { PositionM } from '@cssearth/engine';
import { presentWorldCamera } from './world-camera.js';

/** A flight to a body 23 km wide, 157 parsecs from the frame origin (PSR J0437-4715), drawn frame by frame. With the poses'
 * exact offsets the body's centre slides one way on screen; from world positions alone, which resolve a kilometre there, it
 * reversed 21 times by up to 2 px in the same flight (2026-10-01). */
const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [6.9e17, 3.3e18, -3.5e18] as PositionM,
  presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1] as const, metersPerUnit: 11360 / 248, bodyRadiusM: 11360 };
const viewport = { focalPixels: 1200, widthPixels: 1280, heightPixels: 800, principalOffsetPixels: [0, 0] as const };

function reversals(exact: boolean) {
  const o = frame.originM, r = frame.bodyRadiusM;
  const pose = (range: number) => { const offsetM: PositionM = [0.2 * r, 0.1 * r, range];
    return { positionM: [o[0] + offsetM[0], o[1] + offsetM[1], o[2] + offsetM[2]] as PositionM, orientationXyzw: [0, 0, 0, 1] as const, ...(exact ? { focusOffset: { originM: o, offsetM } } : {}) }; };
  const flight = createSelectionFlight({ from: pose(1e6 * r), to: pose(5 * r), focusPositionM: o }), sample = createSelectionFlightSample();
  const xs: number[] = [];
  for (let time = 0, step = 0; step < 4000 && !sample.complete; step++) {
    time = advanceSelectionFlightInto(flight, [{ positionM: o, radiusM: r }], time, time + 1 / 60, sample);
    const shown = presentWorldCamera({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt, pose: { positionM: [...sample.positionM] as unknown as PositionM, orientationXyzw: [...sample.orientationXyzw] as unknown as readonly [number, number, number, number],
      ...(exact && sample.hasFocusOffset ? { focusOffset: { originM: [...sample.focusOriginM] as unknown as PositionM, offsetM: [...sample.focusOffsetM] as unknown as PositionM } } : {}) } }, frame, viewport);
    if (shown.centerPixels) xs.push(shown.centerPixels[0]);
  }
  let count = 0;
  for (let i = 2; i < xs.length; i++) { const a = xs[i - 1]! - xs[i - 2]!, b = xs[i]! - xs[i - 1]!; if (a * b < 0 && Math.min(Math.abs(a), Math.abs(b)) > 0.05) count++; }
  return count;
}

it('a flight to a small body far from the frame origin holds it steady on screen through the exact offsets', () => {
  assert.equal(reversals(true), 0);
  assert.ok(reversals(false) > 5, 'world positions alone cannot hold the camera this close to a body this far away');
});
