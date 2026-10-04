import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { FAR_ZOOM, PROGRAMS, SELF_TIMED_READ, selfTimedStart, stepLabel, summariseSelfTimed, type SelfTimedStep } from './ipad-self-timed.mts';
const test = sourceTest();

test('a self-timed record names each late frame by what happened in it', () => {
  // A run that started at 1,000 ms: 120 frames of 16 ms, but the third of 30 ms as a page arrives and a scene is handed
  // over, and the hundredth of 40 ms under a slow timer.
  const frames = [1000], work = [0];
  for (let frame = 1; frame <= 120; frame++) { frames.push(frames.at(-1)! + (frame === 3 ? 30 : frame === 100 ? 40 : 16)); work.push(frame === 3 ? 9 : 2); }
  const program: SelfTimedStep[] = [['wheel', 60, 20], ['fly', 'sun'], ['wait', 30], ['click', 'button', 1], ['drag', 30, 5, 0, 'fling']];
  const summary = summariseSelfTimed({ done: true, t0: 1000, frames, work,
    objects: [[1000, 'earth'], [1070, 'sun']], files: [[1040, 'navigation/sun/', 409600], [1500, 'late.bin', 10]], slow: [[frames[99]! + 5, 12, 'timer:() => swap()'], [1300, 9, 'timer:later']],
    marks: [[1000, 0], [1974, 1], [1974, 2], [2454, 3], [2454, 4]], skipped: [3] }, program);
  assert.deepEqual({ ...summary, late: summary.late.length }, { done: true, frames: 120, over20: 2, over25: 2, over33: 1, longestMs: 40,
    frameCallbacksMs: { mean: 2.06, p99: 2, longest: 9 }, handovers: ['earth at 0 s', 'sun at 0.07 s'], skipped: ['click button #1'], late: 2 });
  assert.deepEqual(summary.late, [
    { ms: 30, at: .03, step: 'wheel out, 60 frames, 0.06 s in', handover: ['earth at 0 s', 'sun at 0.07 s'], arrived: ['navigation/sun/ 400 KB'], slow: [] },
    { ms: 40, at: 1.6, step: 'drag 5, 0 a frame for 30 frames, fling, 0.18 s in', handover: [], arrived: [], slow: ['12 ms timer:() => swap()'] }]);
  assert.equal(summariseSelfTimed({ done: false, t0: 0, frames: [], work: [], objects: [], files: [], slow: [], marks: [], skipped: [] }).frames, 0);
  assert.deepEqual(PROGRAMS.fly!.slice(0, 2).map(stepLabel), ['fly to moon', 'wait, 210 frames']);
  assert.equal(stepLabel(['click', 'button[name="dataset"]', 1]), 'click button[name="dataset"] #1');
});

test('the page scripts carry the program and hand back the record', () => {
  const start = selfTimedStart(FAR_ZOOM), fly = selfTimedStart(PROGRAMS.fly!, 0);
  assert.ok(start.includes(JSON.stringify(FAR_ZOOM)) && start.includes('__selfTimed') && fly.includes('"fly","moon"'));
  // Each is an expression the capture can evaluate: it parses as a script.
  for (const script of [start, fly, selfTimedStart(PROGRAMS.drag!), SELF_TIMED_READ]) assert.doesNotThrow(() => new Function(`return ${script}`));
});
