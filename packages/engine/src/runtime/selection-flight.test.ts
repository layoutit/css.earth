import { describe, expect, it } from 'vitest';
import { buildSelectionFlightCurve, selectionFlightProgress, createSelectionFlight, createSelectionFlightSample,
  sampleSelectionFlight, sampleSelectionFlightInto, cameraPoseToReferenceFrame, cameraPoseFromReferenceFrame } from './selection-flight.js';
import type { PhysicalCameraPose, OrientationXyzw, PositionM } from './selection-flight.js';

const identity: OrientationXyzw = [0, 0, 0, 1];
const quarterTurn: OrientationXyzw = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
const pose = (positionM: PositionM, orientationXyzw = identity): PhysicalCameraPose => ({ positionM, orientationXyzw });
const quaternionDot = (a: OrientationXyzw, b: OrientationXyzw) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const expectPose = (actual: PhysicalCameraPose, expected: PhysicalCameraPose) => {
  actual.positionM.forEach((value, index) => expect(value).toBeCloseTo(expected.positionM[index], 4));
  expect(Math.abs(quaternionDot(actual.orientationXyzw, expected.orientationXyzw))).toBeCloseTo(1, 12);
};

describe('universal selection flight', () => {
  it('matches executed Galaxio range fixtures in both directions and near-equal cases', () => {
    // Captured by executing Galaxio navigation/orbitMath.ts, without this module.
    const fixtures = [
      { start: 160000000000, end: 12000000, durationS: 2.260234422211422,
        progress: [0, .627691033068926, .9812292136470021, .9999250056245782, .9999997059572997, .9999999905165807, 1] },
      { start: 12000000, end: 160000000000, durationS: 2.260234422211422,
        progress: [0, 9.483419391367306e-9, 2.9404270036116135e-7, .00007499437542195449, .018770786352997986, .372308966931074, 1] },
      { start: 100, end: 100.5, durationS: 1.5, progress: [0, .028000000000000004, .15625, .5, .84375, .972, 1] },
      { start: 1000000000000, end: 1000000000, durationS: 1.7313088384672168,
        progress: [0, .47964949448743793, .9341073298787375, .9990009990009989, .9999858240061261, .9999990782193017, 1] },
    ];
    const times = [0, .1, .25, .5, .75, .9, 1];
    for (const fixture of fixtures) {
      const curve = buildSelectionFlightCurve(fixture.start, fixture.end);
      expect(curve.durationS).toBe(fixture.durationS);
      times.forEach((time, index) => expect(selectionFlightProgress(curve, time)).toBeCloseTo(fixture.progress[index], 14));
    }
  });

  it('preserves actual camera endpoints and the oracle one-second orientation turn', () => {
    const focusPositionM: PositionM = [1.1e11, 2e10, -3e10];
    const from = pose([-5e10, 2e10, -3e10]);
    const to = pose([1.1e11, 2e10, -3e10 + 1.2e7], quarterTurn);
    const flight = createSelectionFlight({ from, to, focusPositionM });
    expectPose(sampleSelectionFlight(flight, 0), from);
    expectPose(sampleSelectionFlight(flight, flight.durationS), to);
    expect(sampleSelectionFlight(flight, flight.durationS).complete).toBe(true);
    const middle = sampleSelectionFlight(flight, .5);
    expect(middle.orientationXyzw[1]).toBeCloseTo(Math.sin(Math.PI / 8), 12);
    expectPose({ ...sampleSelectionFlight(flight, 1), positionM: to.positionM }, to);
    expect(sampleSelectionFlight(flight, 1).complete).toBe(false);
  });

  it('uses range interpolation and the shortest great-circle approach in metres', () => {
    const flight = createSelectionFlight({ from: pose([100, 0, 0]), to: pose([0, 0, 100]), focusPositionM: [0, 0, 0] });
    const sample = sampleSelectionFlight(flight, flight.durationS / 2);
    [100 * Math.SQRT1_2, 0, 100 * Math.SQRT1_2].forEach((value, index) => expect(sample.positionM[index]).toBeCloseTo(value, 12));
    expect(Math.hypot(...sample.positionM)).toBeCloseTo(100, 12);
  });

  it('takes the nearest quaternion sign without a full spin or roll snap', () => {
    const fromQ: OrientationXyzw = [0, 0, Math.sin(1.4), Math.cos(1.4)];
    const toQ: OrientationXyzw = [0, 0, -Math.sin(1.45), -Math.cos(1.45)];
    const flight = createSelectionFlight({ from: pose([100, 0, 0], fromQ), to: pose([0, 0, 100], toQ), focusPositionM: [0, 0, 0] });
    let previous = sampleSelectionFlight(flight, 0);
    for (let step = 1; step <= 100; step++) {
      const sample = sampleSelectionFlight(flight, step * flight.durationS / 100);
      expect(quaternionDot(previous.orientationXyzw, sample.orientationXyzw)).toBeGreaterThan(.9999);
      expect(Math.hypot(...sample.orientationXyzw)).toBeCloseTo(1, 12);
      previous = sample;
    }
    expect(Math.abs(quaternionDot(previous.orientationXyzw, toQ))).toBeCloseTo(1, 12);
  });

  it('starts an interrupted flight at the last painted pose, independent of reused buffers', () => {
    const first = createSelectionFlight({ from: pose([1e11, 0, 0]), to: pose([0, 0, 2e7], quarterTurn), focusPositionM: [0, 0, 0] });
    const out = createSelectionFlightSample(), positionBuffer = out.positionM, orientationBuffer = out.orientationXyzw;
    expect(sampleSelectionFlightInto(first, .4, out)).toBe(out);
    const expected = structuredClone(out);
    const replacement = createSelectionFlight({ from: out, to: pose([2e11, 0, 1e7]), focusPositionM: [2e11, 0, 0] });
    sampleSelectionFlightInto(first, first.durationS, out);
    const restarted = sampleSelectionFlight(replacement, 0);
    expect(restarted.positionM).toEqual(expected.positionM);
    expect(restarted.orientationXyzw).toEqual(expected.orientationXyzw);
    expect(out.positionM).toBe(positionBuffer); expect(out.orientationXyzw).toBe(orientationBuffer);
  });

  it('transports both position and roll between independently rotated focus frames', () => {
    const frameA = { originM: [8e10, -2e10, 0] as const, localToReferenceXyzw: quarterTurn };
    const frameB = { originM: [-1e11, 3e10, 8e10] as const, localToReferenceXyzw: [Math.SQRT1_2, 0, 0, Math.SQRT1_2] as const };
    const localA = pose([2400, 1500, 220000], [0, 0, Math.sin(.6), Math.cos(.6)]);
    const reference = cameraPoseToReferenceFrame(localA, frameA);
    const localB = cameraPoseFromReferenceFrame(reference, frameB);
    expectPose(cameraPoseToReferenceFrame(localB, frameB), reference);
    expectPose(cameraPoseFromReferenceFrame(reference, frameA), localA);
  });

  it('keeps antipodal paths finite and continuous instead of crossing the focus', () => {
    const flight = createSelectionFlight({ from: pose([100, 0, 0]), to: pose([-100, 0, 0]), focusPositionM: [0, 0, 0] });
    let previous = sampleSelectionFlight(flight, 0);
    for (let step = 1; step <= 100; step++) {
      const sample = sampleSelectionFlight(flight, step * flight.durationS / 100);
      expect(sample.positionM.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...sample.positionM)).toBeCloseTo(100, 10);
      expect(Math.hypot(...sample.positionM.map((value, index) => value - previous.positionM[index]))).toBeLessThan(5);
      previous = sample;
    }
  });

  it('rejects invalid durations and nonphysical camera poses', () => {
    const input = { from: pose([100, 0, 0]), to: pose([0, 0, 100]), focusPositionM: [0, 0, 0] as const };
    expect(() => createSelectionFlight({ ...input, durationS: 0 })).toThrow();
    expect(() => createSelectionFlight({ ...input, from: pose([0, 0, 0]) })).toThrow();
    expect(() => createSelectionFlight({ ...input, to: pose([100, 0, 0], [0, 0, 0, 0]) })).toThrow();
    expect(() => sampleSelectionFlight(createSelectionFlight(input), NaN)).toThrow();
  });
});
