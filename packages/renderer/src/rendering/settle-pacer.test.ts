import { expect, test } from 'vitest';
import { createFramePacer, createSettlePacer, SETTLE_PACING } from './settle-pacer.js';
import { cameraMotionSignalFor } from '../navigation/camera-motion-signal.js';

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
  expect(frames).toHaveLength(1);
  run(0);
  expect(left()).toBe(0);
  const coast = harness('coasting', 5);
  coast.signal.begin('inertia');
  coast.pacer.request();
  // Coasting: no frame is requested until the coast stops.
  expect(coast.frames).toHaveLength(0);
  coast.signal.end('inertia');
  expect(coast.frames).toHaveLength(1);
  coast.run(0);
  expect(coast.left()).toBe(0);
});

test('held work lands a paced slice per frame, halving after a slow frame', () => {
  const { pacer, signal, frames, slices, run, left } = harness('motion', 100);
  signal.begin('zoom');
  pacer.request();
  expect(frames).toHaveLength(0);
  signal.end('zoom');
  run(0);
  expect(slices.at(-1)).toEqual([SETTLE_PACING.startUnits, false]);
  // The frame that carried the first slice took 40 ms: the pacer waits a frame and halves.
  run(40);
  run(50);
  expect(slices.at(-1)).toEqual([SETTLE_PACING.startUnits / 2, false]);
  while (frames.length) run(60 + slices.length * 10);
  expect(left()).toBe(0);
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
  expect(frames).toHaveLength(1);
  frames.shift()!(0);
  // One budget for the frame: the first owner takes it all, the second waits.
  expect(taken).toEqual([['a', SETTLE_PACING.startUnits]]);
  frames.shift()!(10);
  // The next frame starts with the other owner, from a budget grown after a quick frame.
  expect(taken[1]).toEqual(['b', SETTLE_PACING.startUnits * 1.5]);
  while (frames.length) frames.shift()!(20 + taken.length * 10);
  expect(taken.filter(([name]) => name === 'a').reduce((sum, [, wrote]) => sum + wrote, 0)).toBe(40);
  expect(taken.filter(([name]) => name === 'b').reduce((sum, [, wrote]) => sum + wrote, 0)).toBe(40);
  a.destroy(); b.destroy();
});
