import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createFramePacer, createSettlePacer, SETTLE_PACING } from './settle-pacer.js';
import { cameraMotionSignalFor } from '../../navigation/camera-motion-signal.js';

function harness(holdWhile: 'motion' | 'coasting', pending: number) {
  const frames: ((now?: number) => void)[] = [], slices: [number, boolean][] = [];
  const signal = cameraMotionSignalFor(new EventTarget());
  let left = pending;
  const pacer = createSettlePacer((budget, moving) => {
    slices.push([budget, moving]);
    if (moving) return 0;
    const wrote = Math.min(left, budget); left -= wrote; return wrote;
  }, { frame: callback => frames.push(callback), motion: signal, holdWhile });
  const run = (now: number) => { const due = frames.splice(0); for (const callback of due) callback(now); };
  return { pacer, signal, frames, slices, run, left: () => left };
}

test('membership waits only for a coast; a driven camera keeps it live', () => {
  const { pacer, signal, frames, run, left } = harness('coasting', 5);
  signal.begin('drag');
  pacer.request();
  assert.equal(frames.length, 1);
  run(0);
  assert.equal(left(), 0);
  const coast = harness('coasting', 5);
  coast.signal.begin('inertia');
  coast.pacer.request();
  // Coasting: no frame is requested until the coast stops.
  assert.equal(coast.frames.length, 0);
  coast.signal.end('inertia');
  assert.equal(coast.frames.length, 1);
  coast.run(0);
  assert.equal(coast.left(), 0);
});

test('held work lands a paced slice per frame, halving after a slow frame', () => {
  const { pacer, signal, frames, slices, run, left } = harness('motion', 100);
  signal.begin('zoom');
  pacer.request();
  assert.equal(frames.length, 0);
  signal.end('zoom');
  run(0);
  assert.deepEqual(slices.at(-1), [SETTLE_PACING.startUnits, false]);
  // The frame that carried the first slice took 40 ms: the pacer waits a frame and halves.
  run(40);
  run(50);
  assert.deepEqual(slices.at(-1), [SETTLE_PACING.startUnits / 2, false]);
  while (frames.length) run(60 + slices.length * 10);
  assert.equal(left(), 0);
});

test('owners of one document share one frame budget and take turns', () => {
  const frames: ((now?: number) => void)[] = [];
  const pacer = createFramePacer(callback => { frames.push(callback); });
  const taken: [string, number][] = [];
  const owner = (name: string, pending: number) => {
    let left = pending;
    return createSettlePacer(budget => { const wrote = Math.min(left, budget); left -= wrote; if (wrote) taken.push([name, wrote]); return wrote; },
      { frame: pacer, holdWhile: 'never' });
  };
  const a = owner('a', 40), b = owner('b', 40);
  a.request(); b.request();
  assert.equal(frames.length, 1);
  frames.shift()!(0);
  // One budget for the frame: the first owner takes it all, the second waits.
  assert.deepEqual(taken, [['a', SETTLE_PACING.startUnits]]);
  frames.shift()!(10);
  // The next frame starts with the other owner, from a budget grown after a quick frame.
  assert.deepEqual(taken[1], ['b', SETTLE_PACING.startUnits * 1.5]);
  while (frames.length) frames.shift()!(20 + taken.length * 10);
  assert.equal(taken.filter(([name]) => name === 'a').reduce((sum, [, wrote]) => sum + wrote, 0), 40);
  assert.equal(taken.filter(([name]) => name === 'b').reduce((sum, [, wrote]) => sum + wrote, 0), 40);
  a.destroy(); b.destroy();
});

test("a frame's own work takes a share of the budget, split by what each asked the frame before, and paces the next frame", () => {
  const frames: ((now?: number) => void)[] = [];
  const pacer = createFramePacer(callback => frames.push(callback));
  const run = (now: number) => { const due = frames.splice(0); for (const callback of due) callback(now); };
  const start = SETTLE_PACING.startUnits;
  // The first to ask may spend the whole budget; the frame is watched from then on.
  assert.equal(pacer.take(start * 4), start);
  assert.equal(pacer.take(start / 4), start / 4, 'work within the budget is granted whole');
  assert.equal(frames.length, 1);
  run(0);
  // The next frame knows what was asked: two takers share the budget in that proportion.
  assert.equal(pacer.take(start * 4), start * 4 * start / (start * 4 + start / 4));
  assert.equal(pacer.take(start / 4), start / 4 * start / (start * 4 + start / 4));
  // A frame over the slow limit halves the budget; quick ones grow it back to the maximum.
  run(SETTLE_PACING.slowFrameMs + 10);
  run(SETTLE_PACING.slowFrameMs + 20);
  assert.equal(pacer.take(start * 4), start / 2);
  let now = SETTLE_PACING.slowFrameMs + 20;
  for (let frame = 0; frame < 12; frame++) { run(now += 16); pacer.take(1000); }
  assert.equal(pacer.take(1000), SETTLE_PACING.maximumUnits);
  assert.equal(pacer.take(0), 0);
});
