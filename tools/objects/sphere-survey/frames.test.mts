import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { anchorApparition, apparitions, selectFrames, series } from './frames.mts';

/** Five exposures a minute apart at each listed epoch, as the survey took them. */
const epochs = (...starts: string[]) => starts.flatMap(start => [0, 1, 2, 3, 4].map(minute => ({ start: new Date(Date.parse(`${start}Z`) + minute * 60_000).toISOString().slice(0, 23) })));

test('frames group into apparitions months apart and series minutes apart', () => {
  const frames = epochs('2017-10-10T03:56:00', '2017-10-11T04:40:00', '2019-02-25T04:00:00');
  assert.deepEqual(apparitions(frames).map(group => group.length), [10, 5]);
  assert.deepEqual(series(frames).map(group => group.length), [5, 5, 5]);
});

test('a lens is anchored on the apparition the figure shows most, then the larger, then the earlier', () => {
  const frames = epochs('2017-10-10T03:56:00', '2017-10-11T04:40:00', '2019-02-25T04:00:00', '2019-03-15T03:00:00', '2019-03-20T03:00:00');
  assert.equal(anchorApparition(frames, [frames[4], frames[7]]).anchor, 0, 'two shown columns in 2017 outweigh fifteen unshown frames in 2019');
  assert.equal(anchorApparition(frames, [frames[4], frames[12]]).anchor, 1, 'one shown column each: the larger apparition');
  assert.equal(anchorApparition(frames, []).anchor, 1);
  assert.equal(anchorApparition(epochs('2017-10-10T03:56:00', '2019-02-25T04:00:00'), []).anchor, 0, 'equal apparitions: the earlier');
});

test('every frame of the apparitions a lens casts is kept while they fit the bound', () => {
  const frames = epochs('2019-02-25T04:00:00', '2017-10-10T03:56:00', '2017-10-11T04:40:00');
  const kept = selectFrames(frames, [frames[0]]);
  assert.equal(kept.length, 15);
  assert.deepEqual(kept.map(frame => frame.start), [...frames].map(frame => frame.start).sort(), 'in time order across apparitions');
});

test('more frames than the bound keep every series, thinned evenly, the shown frames first', () => {
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
