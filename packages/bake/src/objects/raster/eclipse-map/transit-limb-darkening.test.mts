/** The Kepler long-cadence reader and the fold at its 30-minute cadence (transit-limb-darkening.ts), on a file written here. */
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { binaryTableHdu, foldTransits, primaryHdu, readKeplerLightCurve, readTransitLightCurve, transitWindow } from '@cssearth/bake/objects/raster';

const test = sourceTest();
/** Kepler's long cadence: 270 frames of 6.02 s read every 29.4 minutes. */
const CADENCE_DAYS = 0.02043359821692, PERIOD_DAYS = 10, DURATION_HOURS = 4, DEPTH = 500e-6, FIRST_TRANSIT_BKJD = 135;
/** One quarter of a star with a box transit every ten days; `flagged` samples carry a quality flag and a wild flux. */
function quarter(header: { telescope?: string; mode?: string; reference?: number } = {}, flagged: readonly number[] = []): Buffer {
  const rows = Array.from({ length: 4400 }, (_unused, i) => {
    const time = 131.5 + i * CADENCE_DAYS, phase = ((time - FIRST_TRANSIT_BKJD) / PERIOD_DAYS + 0.5) % 1 - 0.5, inTransit = Math.abs(phase * PERIOD_DAYS) < DURATION_HOURS / 48;
    return flagged.includes(i) ? [time, 9e5, 10, 128] : [time, 1e4 * (inTransit ? 1 - DEPTH : 1) * (1 + 1e-5 * (time - 150)), 2, 0];
  });
  return Buffer.concat([
    primaryHdu([['TELESCOP', header.telescope ?? 'Kepler'], ['KEPLERID', 6541920], ['QUARTER', 2], ['OBSMODE', header.mode ?? 'long cadence']]),
    binaryTableHdu('LIGHTCURVE', [{ name: 'TIME', form: 'D' }, { name: 'PDCSAP_FLUX', form: 'E' }, { name: 'PDCSAP_FLUX_ERR', form: 'E' }, { name: 'SAP_QUALITY', form: 'J' }], rows,
      [['TIMESYS', 'TDB'], ['BJDREFI', header.reference ?? 2454833], ['BJDREFF', 0], ['TIMEUNIT', 'd'], ['INT_TIME', 6.01980290327], ['NUM_FRM', 270], ['TIMEPIXR', 0.5], ['TIMEDEL', CADENCE_DAYS]]),
  ]);
}

test('a Kepler long-cadence file is read on the BMJD_TDB scale, without its flagged samples', () => {
  const curve = readKeplerLightCurve(quarter({}, [7, 8]));
  assert.deepEqual([curve.quarter, curve.keplerId, curve.time.length], [2, 6541920, 4398]);
  assert.ok(Math.abs(curve.time[0]! - (131.5 + 2454833 - 2400000.5)) < 1e-9, 'BJD - 2454833 becomes BJD - 2400000.5');
  assert.ok(Math.abs(curve.cadenceSeconds - 1765.46) < 0.01 && Math.abs(curve.exposureSeconds - 1625.35) < 0.01);
  assert.ok(Math.max(...curve.flux) < 2e4, 'a flagged sample is not kept');
  const generic = readTransitLightCurve(quarter());
  assert.deepEqual([generic.mission, generic.window, generic.cadenceSeconds], ['Kepler', 2, curve.cadenceSeconds]);
});

test('a file in another time system, or not at the long cadence, is refused', () => {
  assert.throws(() => readKeplerLightCurve(quarter({ reference: 2457000 })), /BJD_TDB - 2454833/u);
  assert.throws(() => readKeplerLightCurve(quarter({ mode: 'short cadence' })), /long cadence/u);
  assert.throws(() => readTransitLightCurve(quarter({ telescope: 'TESS' })), /2457000|sector/u, 'a file that is not Kepler\'s is read as a TESS one');
});

test('at 30 minutes a four-hour transit counts with the samples it holds, and its depth folds back', () => {
  const curve = readKeplerLightCurve(quarter()), window = transitWindow(DURATION_HOURS, curve.cadenceSeconds);
  // 0.9 and 0.4 of a 4-hour transit hold 7 and 3 half-hour samples: the 2-minute floors of 10 and 5 would count no transit.
  assert.deepEqual([window.minOutside, window.minInside], [7, 3]);
  assert.deepEqual([transitWindow(2, curve.cadenceSeconds).minOutside, transitWindow(2, curve.cadenceSeconds).minInside], [4, 2], 'never fewer than a line and two points');
  assert.deepEqual([transitWindow(DURATION_HOURS).minOutside, transitWindow(DURATION_HOURS).minInside], [108, 48], 'the 2-minute window is unchanged');
  const orbit = { periodDays: PERIOD_DAYS, transitTimeBmjdTdb: FIRST_TRANSIT_BKJD + 2454833 - 2400000.5 }, folded = foldTransits([curve], orbit, window);
  assert.equal(folded.transits, 9);
  const middle = [...folded.flux].filter((_flux, i) => Math.abs(folded.time[i]! - orbit.transitTimeBmjdTdb) < 0.3 * DURATION_HOURS / 24);
  assert.ok(Math.abs(1 - middle.reduce((sum, flux) => sum + flux, 0) / middle.length - DEPTH) < 2e-6, 'the baseline line removes the slope and leaves the depth');
});
