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
    for (const step of after) assert.ok(Math.abs(step - interval) < interval * .01, `a steadied step of ${step} ms against ${interval}`);
    times.forEach((time, frame) => assert.ok(Math.abs(time - reported[frame]!) <= 1, 'a steadied time left its reported millisecond'));
  });

  it('passes precise times through untouched', () => {
    const steady = createSteadyFrameTime();
    for (const time of [1000.25, 1016.92, 1033.58, 1050.25, 1066.92]) assert.equal(steady(time), time);
  });

  it('starts again from the reported time after a late frame or a pause', () => {
    const steady = createSteadyFrameTime();
    rounded(30, 1000 / 60).forEach(steady);
    for (const late of [5507, 5900, 9000]) assert.equal(steady(late), late);
  });

  it('advances a frame that skipped one interval by two', () => {
    const steady = createSteadyFrameTime(), reported = rounded(60, 1000 / 60);
    const before = reported.slice(0, 40).map(steady).at(-1)!;
    const after = steady(reported[41]!);
    assert.ok(Math.abs(after - before - 2000 / 60) < .4, `two intervals on, not ${after - before} ms`);
  });
});
