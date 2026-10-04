import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { FAR_ZOOM, SELF_TIMED_READ, selfTimedStart, summariseSelfTimed } from './ipad-self-timed.mts';
const test = sourceTest();

test('a self-timed record names each late frame by what happened in it', () => {
  // A run that started at 1,000 ms: 120 frames of 16 ms, but the third of 30 ms as a page arrives and a scene is handed
  // over, and the hundredth of 40 ms under a slow timer.
  const frames = [1000], work = [0];
  for (let frame = 1; frame <= 120; frame++) { frames.push(frames.at(-1)! + (frame === 3 ? 30 : frame === 100 ? 40 : 16)); work.push(frame === 3 ? 9 : 2); }
  const summary = summariseSelfTimed({ done: true, t0: 1000, frames, work,
    objects: [[1000, 'earth'], [1070, 'sun']], files: [[1040, 'navigation/sun/', 409600], [1500, 'late.bin', 10]], slow: [[frames[99]! + 5, 12, 'timer:() => swap()'], [1300, 9, 'timer:later']] });
  assert.deepEqual({ ...summary, late: summary.late.length }, { done: true, frames: 120, over20: 2, over25: 2, over33: 1, longestMs: 40,
    frameCallbacksMs: { mean: 2.06, p99: 2, longest: 9 }, handovers: ['earth at 0 s', 'sun at 0.07 s'], late: 2 });
  assert.deepEqual(summary.late, [
    { ms: 30, at: .03, handover: ['earth at 0 s', 'sun at 0.07 s'], arrived: ['navigation/sun/ 400 KB'], slow: [] },
    { ms: 40, at: 1.6, handover: [], arrived: [], slow: ['12 ms timer:() => swap()'] }]);
  assert.equal(summariseSelfTimed({ done: false, t0: 0, frames: [], work: [], objects: [], files: [], slow: [] }).frames, 0);
});

test('the page scripts carry the program and hand back the record', () => {
  const start = selfTimedStart(FAR_ZOOM);
  assert.ok(start.includes(JSON.stringify(FAR_ZOOM)) && start.includes('__selfTimed'));
  // Both are expressions the capture can evaluate: they parse as a script.
  for (const script of [start, SELF_TIMED_READ]) assert.doesNotThrow(() => new Function(`return ${script}`));
});
