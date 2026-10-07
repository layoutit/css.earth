import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { parseKepseismic, POINT, readKepseismic } from './kepseismic.mts';

/** MAST's rows for Kepler-186 (KIC 8120608), as `Mast.Caom.Filtered.Position` answered on 2026-10-06. */
const row = (filter: number, target = '008120608') => ({ obs_collection: 'HLSP', provenance_name: 'KEPSEISMIC', target_name: `kplr${target}`, t_exptime: 1800, s_ra: 298.65272, s_dec: 43.95502,
  obs_id: `hlsp_kepseismic_kepler_phot_kplr${target}-${filter}d_kepler_v1_cor-filt-inp`, dataURL: `mast:HLSP/kepseismic/${target.slice(0, 4)}00000/${target.slice(4)}/${filter}d-filter/hlsp_kepseismic_kepler_phot_kplr${target}-${filter}d_kepler_v1_cor-filt-inp.fits` });

test('MAST\'s answer for a place is read as the KEPSEISMIC light curves there, one a filter', () => {
  const found = parseKepseismic({ status: 'COMPLETE', data: [row(80), row(55), row(20),
    // The mission's own light curves of the same target are another product.
    { obs_collection: 'Kepler', provenance_name: 'Kepler', target_name: 'kplr008120608', t_exptime: 1800, s_ra: 298.65272, s_dec: 43.95502, obs_id: 'kplr008120608_lc_Q011111111111111111', dataURL: 'http://archive.stsci.edu/missions/kepler/lightcurves/0081/008120608/kplr008120608_lc_Q011111111111111111.tar' }] });
  assert.deepEqual(found.map(one => [one.kic, one.filterDays, one.filename]), [20, 55, 80].map(filter => [8120608, filter, `hlsp_kepseismic_kepler_phot_kplr008120608-${filter}d_kepler_v1_cor-filt-inp.fits`]));
  assert.equal(found[1]!.uri, 'mast:HLSP/kepseismic/008100000/20608/55d-filter/hlsp_kepseismic_kepler_phot_kplr008120608-55d_kepler_v1_cor-filt-inp.fits');
  assert.throws(() => parseKepseismic({ status: 'COMPLETE', data: [{ ...row(20), target_name: 'kplr008120609' }] }), /under another target/u);
  assert.throws(() => parseKepseismic({ status: 'ERROR' }), /did not answer/u);
});

/** The header of HAT-P-11's (KIC 10748390) 20-day file as MAST serves it, with the first 16 points of its table and of
 * its marks. The two row counts are the only cards changed. */
const fixture = async () => new Uint8Array(await readFile(resolve(import.meta.dirname, 'fixtures/kepseismic-kplr010748390-20d-first-16-points.fits')));

test('a KEPSEISMIC file is read with what its header says of it, its times on the mission\'s clock', async () => {
  const series = readKepseismic(await fixture());
  assert.deepEqual([series.kic, series.filterDays, series.pipeline, series.filledGapDays], [10748390, 20, 'KADACS V5', 20]);
  // The star was not observed in quarters 7, 11 and 15.
  assert.deepEqual(series.quarters, [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 12, 13, 14, 16, 17]);
  // The file's first time, 54953.53847515769 (a barycentric Julian date less 2400000), is day 120.538475 of the mission's clock.
  assert.equal(series.time[0], 120.538475); assert.equal(series.time.length, 16); assert.ok(Math.abs(series.stepDays - 0.020434) < 1e-6);
  assert.deepEqual(series.flux.slice(0, 3), [0.0010345932999200613, -66.76477481926125, 27.738622192741147]);
  // The twelfth and the sixteenth points are filled in.
  assert.deepEqual(series.state, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1, 2]); assert.equal(series.state[11], POINT.filled);
});

test('a file of another layout is refused', async () => {
  const bytes = await fixture(), marks = bytes.length - 2880, altered = (change: (copy: Uint8Array) => void) => { const copy = bytes.slice(); change(copy); return copy; };
  // A mark that is none of the three, and an empty point that holds a flux.
  assert.throws(() => readKepseismic(altered(copy => { copy[marks + 1] = 3; })), /neither 0, 1 nor 2/u);
  assert.throws(() => readKepseismic(altered(copy => { copy[marks + 1] = 0; })), /marked empty holds a flux/u);
  // A table whose time column does not say what its clock is.
  const comment = Buffer.from(bytes).indexOf('BJD - 2400000.0');
  assert.throws(() => readKepseismic(altered(copy => { copy[comment] = 'M'.charCodeAt(0); })), /barycentric Julian dates less 2400000/u);
});
