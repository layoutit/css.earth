import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSteadyFrameTime } from './steady-frame-time.js';

/** Frame starts every `intervalMs`, reported as Safari does: in whole milliseconds. */
const rounded = (count: number, intervalMs: number, from = 5000) => Array.from({ length: count }, (_, frame) => Math.round(from + frame * intervalMs));
const steps = (times: readonly number[]) => times.slice(1).map((time, index) => time - times[index]!);

describe('steady frame time', () => {
  for (const hertz of [60, 120, 90]) it(`spaces whole-millisecond ${hertz} Hz frame times one display interval apart`, () => {
    const interval = 1000 / hertz, reported = rounded(240, interval), steady = createSteadyFrameTime();
    const times = reported.map(steady);
    const before = steps(reported).slice(30), after = steps(times).slice(30);
    assert.ok(Math.max(...before) - Math.min(...before) >= 1, 'the reported intervals differ by a millisecond');
    for (const step of after) assert.ok(Math.abs(step - interval) < interval * .003, `a steadied step of ${step} ms against ${interval}`);
    times.forEach((time, frame) => assert.ok(Math.abs(time - reported[frame]!) <= 1.5, `a steadied time ${time} left its reported ${reported[frame]}`));
  });

  it('counts a late callback and the early one after it as one display interval each', () => {
    const interval = 1000 / 60, reported = rounded(120, interval), steady = createSteadyFrameTime();
    reported[60]! += 5; // a callback 5 ms late: 22 ms after the last, the next 12 ms after it
    const after = steps(reported.map(steady));
    assert.ok(reported[60]! - reported[59]! >= 21 && reported[61]! - reported[60]! <= 12);
    for (const step of after.slice(55, 70)) assert.ok(Math.abs(step - interval) < interval * .02, `a step of ${step} ms around the late callback`);
  });

  it('advances a frame that skipped one interval by two', () => {
    const interval = 1000 / 60, reported = rounded(60, interval), steady = createSteadyFrameTime();
    const before = reported.slice(0, 40).map(steady).at(-1)!;
    const after = steady(reported[41]!);
    assert.ok(Math.abs(after - before - 2 * interval) < .4, `two intervals on, not ${after - before} ms`);
  });

  it('stays with the reported time through a pause', () => {
    const interval = 1000 / 60, steady = createSteadyFrameTime();
    rounded(60, interval).forEach(steady);
    for (const later of [6400, 9000, 9017, 9033]) assert.ok(Math.abs(steady(later) - later) <= interval, 'a time after the pause left the reported one');
  });

  it('learns the interval again when the display changes its rate', () => {
    const steady = createSteadyFrameTime();
    rounded(60, 1000 / 60).forEach(steady);
    const faster = rounded(90, 1000 / 120, 6000), times = faster.map(steady);
    times.forEach((time, frame) => assert.ok(Math.abs(time - faster[frame]!) <= 26, `frame ${frame} at ${time} against ${faster[frame]}`));
    for (let frame = 1; frame < times.length; frame++) assert.ok(times[frame]! >= times[frame - 1]!, 'a returned time went back');
    for (const step of steps(times).slice(40)) assert.ok(Math.abs(step - 1000 / 120) < .1, `a step of ${step} ms at 120 Hz`);
  });

  it('passes precise times through untouched', () => {
    const steady = createSteadyFrameTime();
    for (const time of [1000.25, 1016.92, 1033.58, 1050.25, 1066.92]) assert.equal(steady(time), time);
  });
});
