import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { buildSelectionFlightCurve, selectionFlightProgress, createSelectionFlight, createSelectionFlightSample,
  sampleSelectionFlight, sampleSelectionFlightInto, cameraPoseToReferenceFrame, cameraPoseFromReferenceFrame, sameEyePlace } from './selection-flight.js';
import type { PhysicalCameraPose, OrientationXyzw, PositionM } from './selection-flight.js';

const identity: OrientationXyzw = [0, 0, 0, 1];
const quarterTurn: OrientationXyzw = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
const pose = (positionM: PositionM, orientationXyzw = identity): PhysicalCameraPose => ({ positionM, orientationXyzw });
const quaternionDot = (a: OrientationXyzw, b: OrientationXyzw) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const expectPose = (actual: PhysicalCameraPose, expected: PhysicalCameraPose) => {
  actual.positionM.forEach((value, index) => assert.ok(Math.abs(value - (expected.positionM[index])) < 10 ** -4 / 2, `${value} is not close to ${expected.positionM[index]}`));
  assert.ok(Math.abs(Math.abs(quaternionDot(actual.orientationXyzw, expected.orientationXyzw)) - (1)) < 10 ** -12 / 2, `${Math.abs(quaternionDot(actual.orientationXyzw, expected.orientationXyzw))} is not close to ${1}`);
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
      assert.equal(curve.durationS, fixture.durationS);
      times.forEach((time, index) => assert.ok(Math.abs(selectionFlightProgress(curve, time) - (fixture.progress[index])) < 10 ** -14 / 2, `${selectionFlightProgress(curve, time)} is not close to ${fixture.progress[index]}`));
    }
  });

  it('preserves camera endpoints and turns with the same progress as the approach', () => {
    const focusPositionM: PositionM = [1.1e11, 2e10, -3e10];
    const from = pose([-5e10, 2e10, -3e10]);
    const to = pose([1.1e11, 2e10, -3e10 + 1.2e7], quarterTurn);
    const flight = createSelectionFlight({ from, to, focusPositionM });
    expectPose(sampleSelectionFlight(flight, 0), from);
    expectPose(sampleSelectionFlight(flight, flight.durationS), to);
    assert.equal(sampleSelectionFlight(flight, flight.durationS).complete, true);
    const middle = sampleSelectionFlight(flight, .5);
    assert.ok(Math.abs(middle.orientationXyzw[1] - (Math.sin(Math.PI / 4 * middle.progress))) < 10 ** -12 / 2, `${middle.orientationXyzw[1]} is not close to ${Math.sin(Math.PI / 4 * middle.progress)}`);
    assert.equal(flight.orientationDurationS, flight.positionDurationS);
    assert.equal(sampleSelectionFlight(flight, 1).complete, false);
  });

  it('keeps an anchored target centered through a short oblique zoom and completes the turn on arrival', () => {
    const from = pose([0, 0, 1e13]);
    const to = pose([1e7, 0, 0], quarterTurn);
    const flight = createSelectionFlight({ from, to, focusPositionM: [0, 0, 0], durationS: .35 });
    assert.equal(flight.durationS, .35);
    for (let step = 0; step <= 60; step++) {
      const sample = sampleSelectionFlight(flight, flight.durationS * step / 60);
      const local = cameraPoseFromReferenceFrame(pose([0, 0, 0]), {
        originM: sample.positionM, localToReferenceXyzw: sample.orientationXyzw,
      });
      const range = Math.hypot(...local.positionM);
      assert.ok((Math.abs(local.positionM[0]) / range) < 1e-12);
      assert.ok((Math.abs(local.positionM[1]) / range) < 1e-12);
      assert.ok(local.positionM[2] < 0);
    }
    expectPose(sampleSelectionFlight(flight, .35), to);
  });

  it('uses range interpolation and the shortest great-circle approach in metres', () => {
    const flight = createSelectionFlight({ from: pose([100, 0, 0]), to: pose([0, 0, 100]), focusPositionM: [0, 0, 0] });
    const sample = sampleSelectionFlight(flight, flight.durationS / 2);
    [100 * Math.SQRT1_2, 0, 100 * Math.SQRT1_2].forEach((value, index) => assert.ok(Math.abs(sample.positionM[index] - (value)) < 10 ** -12 / 2, `${sample.positionM[index]} is not close to ${value}`));
    assert.ok(Math.abs(Math.hypot(...sample.positionM) - (100)) < 10 ** -12 / 2, `${Math.hypot(...sample.positionM)} is not close to ${100}`);
  });

  it('takes the nearest quaternion sign without a full spin or roll snap', () => {
    const fromQ: OrientationXyzw = [0, 0, Math.sin(1.4), Math.cos(1.4)];
    const toQ: OrientationXyzw = [0, 0, -Math.sin(1.45), -Math.cos(1.45)];
    const flight = createSelectionFlight({ from: pose([100, 0, 0], fromQ), to: pose([0, 0, 100], toQ), focusPositionM: [0, 0, 0] });
    let previous = sampleSelectionFlight(flight, 0);
    for (let step = 1; step <= 100; step++) {
      const sample = sampleSelectionFlight(flight, step * flight.durationS / 100);
      assert.ok(quaternionDot(previous.orientationXyzw, sample.orientationXyzw) > .9999);
      assert.ok(Math.abs(Math.hypot(...sample.orientationXyzw) - (1)) < 10 ** -12 / 2, `${Math.hypot(...sample.orientationXyzw)} is not close to ${1}`);
      previous = sample;
    }
    assert.ok(Math.abs(Math.abs(quaternionDot(previous.orientationXyzw, toQ)) - (1)) < 10 ** -12 / 2, `${Math.abs(quaternionDot(previous.orientationXyzw, toQ))} is not close to ${1}`);
  });

  it('starts an interrupted flight at the last painted pose, independent of reused buffers', () => {
    const first = createSelectionFlight({ from: pose([1e11, 0, 0]), to: pose([0, 0, 2e7], quarterTurn), focusPositionM: [0, 0, 0] });
    const out = createSelectionFlightSample(), positionBuffer = out.positionM, orientationBuffer = out.orientationXyzw;
    assert.equal(sampleSelectionFlightInto(first, .4, out), out);
    const expected = structuredClone(out);
    const replacement = createSelectionFlight({ from: out, to: pose([2e11, 0, 1e7]), focusPositionM: [2e11, 0, 0] });
    sampleSelectionFlightInto(first, first.durationS, out);
    const restarted = sampleSelectionFlight(replacement, 0);
    assert.deepEqual(restarted.positionM, expected.positionM);
    assert.deepEqual(restarted.orientationXyzw, expected.orientationXyzw);
    assert.equal(out.positionM, positionBuffer); assert.equal(out.orientationXyzw, orientationBuffer);
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
      assert.equal(sample.positionM.every(Number.isFinite), true);
      assert.ok(Math.abs(Math.hypot(...sample.positionM) - (100)) < 10 ** -10 / 2, `${Math.hypot(...sample.positionM)} is not close to ${100}`);
      assert.ok(Math.hypot(...sample.positionM.map((value, index) => value - previous.positionM[index])) < 5);
      previous = sample;
    }
  });

  it('rejects invalid durations and nonphysical camera poses', () => {
    const input = { from: pose([100, 0, 0]), to: pose([0, 0, 100]), focusPositionM: [0, 0, 0] as const };
    assert.throws(() => createSelectionFlight({ ...input, durationS: 0 }));
    assert.throws(() => createSelectionFlight({ ...input, from: pose([0, 0, 0]) }));
    assert.throws(() => createSelectionFlight({ ...input, to: pose([100, 0, 0], [0, 0, 0, 0]) }));
    assert.throws(() => sampleSelectionFlight(createSelectionFlight(input), NaN));
  });
});

describe('a camera a few kilometres from a focus hundreds of parsecs away', () => {
  // PSR J0437-4715: 157 parsecs from the Sun, where a double resolves 1,024 m, and 11.36 km in radius.
  const frame = { originM: [6.9e17, 3.3e18, -3.5e18] as PositionM, localToReferenceXyzw: [0, 0, 0, 1] as OrientationXyzw };
  const local = (x: number): PhysicalCameraPose => ({ positionM: [x, 12.25, 44000], orientationXyzw: [0, 0, 0, 1] });
  it('reads back its own position exactly, through the offset the pose carries', () => {
    for (const x of [0, 0.5, 137.25, 5000.125]) {
      const back = cameraPoseFromReferenceFrame(cameraPoseToReferenceFrame(local(x), frame), frame);
      assert.deepEqual([...back.positionM], [x, 12.25, 44000]);
    }
  });
  it('falls back to the world positions for another origin or a pose rebuilt without the offset', () => {
    const world = cameraPoseToReferenceFrame(local(137.25), frame), rebuilt = { positionM: world.positionM, orientationXyzw: world.orientationXyzw };
    assert.notEqual(cameraPoseFromReferenceFrame(rebuilt, frame).positionM[0], 137.25, 'a double cannot hold 137 m at this distance');
    const moved = { ...world, positionM: [world.positionM[0] + 1e6, world.positionM[1], world.positionM[2]] as PositionM };
    assert.ok(Math.abs(cameraPoseFromReferenceFrame(moved, frame).positionM[0] - 1e6) < 2048, 'a stale offset is not used');
    const other = { ...frame, originM: [frame.originM[0] + 1e6, frame.originM[1], frame.originM[2]] as PositionM };
    assert.ok(Math.abs(cameraPoseFromReferenceFrame(world, other).positionM[0] + 1e6) < 2048);
  });
  it('tells two places apart that positionM rounds to one value', () => {
    const a = cameraPoseToReferenceFrame(local(137.25), frame), b = cameraPoseToReferenceFrame(local(137.5), frame);
    assert.deepEqual([...a.positionM], [...b.positionM], 'a quarter metre is below what positionM holds here');
    assert.equal(sameEyePlace(a, b), false);
    assert.equal(sameEyePlace(a, cameraPoseToReferenceFrame(local(137.25), frame)), true);
  });
});

it('a dolly about the focus scales the eye\'s offset from its origin and keeps the exact anchor', async () => {
  const { dollyPoseAboutFocus, eyeAnchor, cameraPoseToReferenceFrame } = await import('./selection-flight.js');
  const frame = { originM: [4.8e18, -2.1e18, 7.7e17] as const, localToReferenceXyzw: [0, 0, 0, 1] as const };
  const pose = cameraPoseToReferenceFrame({ positionM: [0, 0, 3e7], orientationXyzw: [0, 0, 0, 1] }, frame);
  const out = dollyPoseAboutFocus(pose, 1.5);
  assert.deepEqual(eyeAnchor(out), { originM: frame.originM, offsetM: [0, 0, 4.5e7] }, 'half as far again from the same origin, exactly');
  assert.deepEqual(out.orientationXyzw, pose.orientationXyzw);
  assert.equal(dollyPoseAboutFocus({ positionM: [1, 2, 3], orientationXyzw: [0, 0, 0, 1] }, 2).positionM[0], 1, 'a pose with no focus offset is left as it is');
  assert.equal(dollyPoseAboutFocus(pose, 0), pose, 'and so is a ratio that is not a distance');
});
