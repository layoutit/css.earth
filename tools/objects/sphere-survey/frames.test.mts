import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apparitions, selectFrames, series } from './frames.mts';

/** Five exposures a minute apart at each listed epoch, as the survey took them. */
const epochs = (...starts: string[]) => starts.flatMap(start => [0, 1, 2, 3, 4].map(minute => ({ start: new Date(Date.parse(`${start}Z`) + minute * 60_000).toISOString().slice(0, 23) })));

test('frames group into apparitions months apart and series minutes apart', () => {
  const frames = epochs('2017-10-10T03:56:00', '2017-10-11T04:40:00', '2019-02-25T04:00:00');
  assert.deepEqual(apparitions(frames).map(group => group.length), [10, 5]);
  assert.deepEqual(series(frames).map(group => group.length), [5, 5, 5]);
});

test('the apparition the figure shows most is kept whole while it fits', () => {
  const frames = epochs('2017-10-10T03:56:00', '2017-10-11T04:40:00', '2019-02-25T04:00:00', '2019-03-15T03:00:00', '2019-03-20T03:00:00');
  assert.equal(selectFrames(frames, [frames[4], frames[7]]).length, 10, 'two shown columns in 2017 outweigh fifteen unshown frames in 2019');
  assert.equal(selectFrames(frames, [frames[4], frames[12]]).length, 15, 'one shown column each: the larger apparition');
  assert.equal(selectFrames(frames, [frames[20], frames[21]]).length, 15, 'the figure shows 2019 only');
});

test('a larger apparition keeps every series, thinned evenly, the shown frames first', () => {
  const frames = epochs('2018-11-28T03:54:00', '2018-12-14T07:05:00', '2018-12-19T04:45:00', '2018-12-19T05:55:00', '2018-12-19T06:30:00', '2018-12-26T05:00:00', '2019-01-09T04:00:00');
  const shown = [frames[4], frames[9]], kept = selectFrames(frames, shown, 32);
  assert.equal(kept.length, 32);
  assert.deepEqual(series(kept).map(group => group.length), [5, 5, 5, 5, 4, 4, 4], 'four from every series, the spare places to the earliest');
  assert.ok(shown.every(frame => kept.includes(frame)));
  const eleven = selectFrames(frames, shown, 11);
  assert.deepEqual(series(eleven).map(group => group.length), [2, 2, 2, 2, 1, 1, 1]);
  assert.ok(eleven.includes(frames[4]), 'the shown frame, not the first, is kept in a thinned series');
  assert.throws(() => selectFrames(frames, shown, 6), /more series than the 6-frame bound/);
});
