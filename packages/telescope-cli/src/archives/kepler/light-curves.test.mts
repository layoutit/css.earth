import assert from 'node:assert/strict';
import test from 'node:test';
import { parseLightCurves } from './light-curves.mts';

test('MAST\'s answer for a place is read as the K2 mission\'s long-cadence light curves there', () => {
  const found = parseLightCurves({ status: 'COMPLETE', data: [
    { obs_id: 'ktwo247589423-c13_lc', obs_collection: 'K2', target_name: 'ktwo247589423', t_exptime: 1800, s_ra: 67.41246, s_dec: 22.882721 },
    { obs_id: 'ktwo247589423-c13_sc', obs_collection: 'K2', target_name: 'ktwo247589423', t_exptime: 60, s_ra: 67.41246, s_dec: 22.882721 },
    { obs_id: 'ktwo201403360-c01_lc', obs_collection: 'K2', target_name: 'ktwo201403360', t_exptime: 1800, s_ra: 170.1, s_dec: -0.9 },
    { obs_id: 'ktwo201425594-c10_lc', obs_collection: 'K2', target_name: 'ktwo201425594', t_exptime: 1800, s_ra: 185.6, s_dec: -0.57 },
    { obs_id: 'kplr005772710_lc_Q111100111011101110', obs_collection: 'Kepler', target_name: 'kplr005772710', t_exptime: 1800, s_ra: 285.1, s_dec: 41.06 }] });
  // Oldest campaign first; a one-digit campaign's folder has no leading zero; campaign 10 was filed in two parts and the second is read.
  assert.deepEqual(found.map(one => [one.campaign, one.uri]), [
    [1, 'mast:K2/url/missions/k2/lightcurves/c1/201400000/03000/ktwo201403360-c01_llc.fits'],
    [10, 'mast:K2/url/missions/k2/lightcurves/c102/201400000/25000/ktwo201425594-c102_llc.fits'],
    [13, 'mast:K2/url/missions/k2/lightcurves/c13/247500000/89000/ktwo247589423-c13_llc.fits']]);
  assert.throws(() => parseLightCurves({ status: 'ERROR' }), /did not answer with a list of observations/u);
});
