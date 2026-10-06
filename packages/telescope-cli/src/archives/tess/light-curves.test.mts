import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSectorLightCurves } from './light-curves.mts';

test('MAST\'s answer for a place is read as the mission\'s 2-minute light curves there', () => {
  const row = (sector: number, exposure: number, file: string, provenance = 'SPOC') => ({ obs_collection: 'TESS', provenance_name: provenance, target_name: '441420236', t_exptime: exposure, sequence_number: sector, s_ra: 311.2897, s_dec: -31.3409, dataURL: `mast:TESS/product/${file}` });
  // AU Mic: sectors 1, 27 and 95 at two minutes; the 20-second light curve, the transit search's file and another pipeline's are left out.
  const found = parseSectorLightCurves({ status: 'COMPLETE', data: [row(95, 120, 'tess2025206162959-s0095-0000000441420236-0292-s_lc.fits'), row(27, 20, 'tess2020186164531-s0027-0000000441420236-0189-a_fast-lc.fits'),
    row(96, 120, 'tess2018206190142-s0001-s0096-0000000441420236-01071_dvt.fits'), row(1, 120, 'tess2018206045859-s0001-0000000441420236-0120-s_lc.fits'), row(27, 120, 'tess2020186164531-s0027-0000000441420236-0189-s_lc.fits'),
    row(27, 120, 'tess2020186164531-s0027-0000000441420236-0189-s_lc.fits', 'QLP')] });
  assert.deepEqual(found.map(one => [one.sector, one.filename]), [[1, 'tess2018206045859-s0001-0000000441420236-0120-s_lc.fits'], [27, 'tess2020186164531-s0027-0000000441420236-0189-s_lc.fits'], [95, 'tess2025206162959-s0095-0000000441420236-0292-s_lc.fits']]);
  assert.equal(found[0]!.uri, 'mast:TESS/product/tess2018206045859-s0001-0000000441420236-0120-s_lc.fits'); assert.throws(() => parseSectorLightCurves({ status: 'ERROR' }), /did not answer/u);
});
