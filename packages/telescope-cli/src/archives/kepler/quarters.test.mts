import assert from 'node:assert/strict';
import test from 'node:test';
import { POINT } from './kepseismic.mts';
import { byQuarter, KEPLER_QUARTERS, measuredLight, mjdOf, parseQuarters } from './quarters.mts';

test('the mission\'s table of quarters holds 18 in order, each as long as its own count of cadences', () => {
  assert.equal(KEPLER_QUARTERS.length, 18);
  // Quarter 5 as the header of a star's own light curve file of that quarter has it (KIC 8120608: LC_START 55275.99115492, LC_END 55370.66003002, 4,634 rows).
  assert.deepEqual(KEPLER_QUARTERS[5], { quarter: 5, firstCadenceMjd: 55275.99115, lastCadenceMjd: 55370.66003, cadences: 4634 });
  // The table is consistent with itself: every quarter's times and count give the same cadence, 29.4244 minutes.
  for (const one of KEPLER_QUARTERS) assert.ok(Math.abs((one.lastCadenceMjd - one.firstCadenceMjd) / (one.cadences - 1) * 1440 - 29.4244) < 1e-3, `quarter ${one.quarter}`);
  assert.throws(() => parseQuarters({ quarters: [KEPLER_QUARTERS[1], KEPLER_QUARTERS[0]] }), /in order/u);
});

test('a light curve of the whole mission is split at the mission\'s own limits', () => {
  // Times on the mission's clock about the end of quarter 1 (MJD 54997.48122) and the start of quarter 2 (MJD 55002.01748).
  const clock = (mjd: number) => Number((mjd - mjdOf(0)).toFixed(6)), step = 0.020434;
  const time = [54997.44, 54997.4604, 54997.4809, 54997.6, 55001.9, 55002.0174, 55002.0379, 55002.0583].map(clock);
  const series = { time, flux: [100, -50, 25, 7, 7, -300, 400, 0], state: [1, 2, 1, 2, 2, 1, 2, 0], stepDays: step };
  const parts = byQuarter(series);
  // The fourth and fifth points lie between the two quarters and belong to neither; the last is empty.
  assert.deepEqual(parts.map(part => [part.quarter, part.flux, part.state]), [[1, [100, -50, 25], [1, 2, 1]], [2, [-300, 400], [1, 2]]]);
  assert.equal(mjdOf(parts[1]!.time[0]!).toFixed(4), '55002.0174');
  // A map is fitted to the measured points, as shares of the star's mean; the filled-in ones are left out.
  assert.deepEqual(measuredLight(parts[0]!), { time: [time[0], time[2]], flux: [1.0001, 1.000025] });
  assert.deepEqual(measuredLight(parts[1]!).flux, [0.9997]);
  // A quarter whose points are all empty is one the star was not observed in.
  assert.deepEqual(byQuarter({ ...series, state: series.state.map(state => state === POINT.empty ? state : POINT.empty) }), []);
});
