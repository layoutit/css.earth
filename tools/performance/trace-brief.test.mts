import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { occupiedMs, buildBrief, decodeWork } from './trace-brief.mts';

test('nested and overlapping slices are counted once inside the selected window', () => {
  assert.equal(occupiedMs([{ ts: 0, dur: 6000 }, { ts: 1000, dur: 3000 }, { ts: 5000, dur: 4000 }], 2000, 8000), 6);
});

test('nested decode tasks count once per thread, preserving parallel worker occupancy', () => {
  const result = decodeWork([
    { name: 'ImageDecodeTask', ts: 0, dur: 10000, ph: 'X', tid: 1 },
    { name: 'Decode Image', ts: 1000, dur: 8000, ph: 'X', tid: 1 },
    { name: 'Decode Image', ts: 0, dur: 5000, ph: 'X', tid: 2 },
  ], 0, 20000);
  assert.equal(result.sliceCount, 3);
  assert.equal(result.summedThreadOccupancyMs, 15);
  assert.deepEqual(result.threads.map(t => t.occupiedMs), [10, 5]);
});

test('the brief prioritizes a busy task over a larger low-work presentation gap', () => {
  const trace = { events: [
    { pid: 1, tid: 2, ph: 'X', name: 'RunTask', ts: 100000, dur: 50000 },
    { pid: 1, tid: 2, ph: 'X', name: 'UpdateLayoutTree', ts: 110000, dur: 30000, args: { elementCount: 8000 } },
    { pid: 8, tid: 9, ph: 'X', name: 'RunTask', ts: 100000, dur: 100000 },
  ] };
  const analysis = {
    input: { name: 'fixture.json' }, selection: { rendererPid: 1, rendererMainTid: 2 }, window: { startTs: 0, endTs: 900000, durationMs: 900 },
    timeline: { displayMs: 16.667, stats: {}, frames: [
      { index: 1, startMs: 100, endMs: 150, intervalMs: 50, mainBusyMs: 50 },
      { index: 2, startMs: 200, endMs: 700, intervalMs: 500, mainBusyMs: 0 },
    ] },
    pipeline: { available: false }, longTasks: { available: true, count: 0 },
    garbageCollection: { occupancyMs: 0 }, cpuProfile: { topSelf: [] }, capabilities: { warnings: [] },
  };
  const brief = buildBrief(trace, analysis);
  assert.equal(brief.busiestTasks[0]?.atMs, 100);
  assert.equal(brief.busiestTasks[0]?.durationMs, 50);
  assert.equal(brief.busiestTasks[0]?.maxStyleElements, 8000);
  assert.equal(brief.busiestTasks[0]?.work.UpdateLayoutTree.occupiedMs, 30);
  assert.equal(brief.busiestTasks[0]?.overlappingFrameIntervals.length, 1);
  assert.equal(brief.lowMainWorkGaps[0]?.index, 2);
  assert.equal(brief.clues[0]?.id, 'busy-main-task');
  assert.match(brief.clues[0]?.fact ?? '', /8000 elements/);
  assert.equal(brief.pipeline.available, false);
});
