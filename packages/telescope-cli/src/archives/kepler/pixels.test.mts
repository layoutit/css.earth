import assert from 'node:assert/strict';
import test from 'node:test';
import { campaignFile, parseObservations, pickFile, quarterFiles, quarterFolder } from './pixels.mts';

test('MAST\'s answer for a place is read as the long-cadence pixel files of Kepler and K2', () => {
  // Kepler-93 has a 30-minute and a one-minute observation; only the first is kept.
  const observations = parseObservations({ status: 'COMPLETE', data: [
    { obs_id: 'kplr005772710_lc_Q111100111011101110', obs_collection: 'Kepler', target_name: 'kplr005772710', t_exptime: 1800, t_min: 54953.0375, t_max: 56390.4597, s_ra: 285.1429, s_dec: 41.06201 },
    { obs_id: 'kplr005772710_sc_Q000000000000000010', obs_collection: 'Kepler', target_name: 'kplr005772710', t_exptime: 60, t_min: 1, t_max: 2, s_ra: 285.1429, s_dec: 41.06201 },
    { obs_id: 'ktwo247589423-c13_lc', obs_collection: 'K2', target_name: 'ktwo247589423', t_exptime: 1800, t_min: 57820.066, t_max: 57900.656, s_ra: 67.41246, s_dec: 22.882721 },
    { obs_id: 'x', obs_collection: 'TESS', target_name: 'x', t_exptime: 1800, s_ra: 1, s_dec: 1 }] });
  assert.deepEqual(observations.map(one => [one.mission, one.id, one.days]), [['Kepler', 'kplr005772710_lc_Q111100111011101110', 1437.4], ['K2', 'ktwo247589423-c13_lc', 80.6]]);
  // A K2 campaign's file is at the address the mission files it under.
  assert.deepEqual(campaignFile(observations[1]!), { mission: 'K2', target: 'ktwo247589423', window: 13, filename: 'ktwo247589423-c13_lpd-targ.fits.gz', days: 80.6, uri: 'mast:K2/url/missions/k2/target_pixel_files/c13/247500000/89000/ktwo247589423-c13_lpd-targ.fits.gz' });
  assert.equal(campaignFile(observations[0]!), undefined);
  // A one-digit campaign's folder has no leading zero; campaign 10 was filed in two parts, and the second is read.
  assert.equal(campaignFile({ ...observations[1]!, id: 'ktwo201403360-c01_lc' })!.uri, 'mast:K2/url/missions/k2/target_pixel_files/c1/201400000/03000/ktwo201403360-c01_lpd-targ.fits.gz');
  const split = campaignFile({ ...observations[1]!, id: 'ktwo201425594-c10_lc' })!; assert.deepEqual([split.window, split.uri], [10, 'mast:K2/url/missions/k2/target_pixel_files/c102/201400000/25000/ktwo201425594-c102_lpd-targ.fits.gz']);
  // A Kepler target's folder lists one file for each quarter its observation flags, in the order of time.
  assert.equal(quarterFolder('005772710'), 'https://archive.stsci.edu/missions/kepler/target_pixel_files/0057/005772710/');
  const stamps = ['2009131105131', '2009166043257', '2009259160929', '2009350155506', '2010265121752', '2010355172524', '2011073133259', '2011271113734', '2012004120508', '2012088054726', '2012277125453', '2013011073258', '2013098041711'];
  const listing = stamps.map(stamp => `<li><a href="kplr005772710-${stamp}_lpd-targ.fits.gz"> kplr005772710-${stamp}_lpd-targ.fits.gz</a></li>`).join('\n');
  const quarters = quarterFiles(observations[0]!, listing);
  assert.deepEqual(quarters.map(file => file.window), [0, 1, 2, 3, 6, 7, 8, 10, 11, 12, 14, 15, 16]); assert.equal(quarters[4]!.uri, 'mast:Kepler/url/missions/kepler/target_pixel_files/0057/005772710/kplr005772710-2010265121752_lpd-targ.fits.gz');
  // The full-length quarter nearest the middle of the mission is read; a folder that does not match the flags gives none.
  assert.equal(pickFile(quarters)!.window, 8); assert.deepEqual(quarterFiles(observations[0]!, listing.split('\n').slice(1).join('\n')), []);
  // Of two K2 campaigns the longer is read, and of equals the newer.
  const campaigns = [{ ...campaignFile(observations[1]!)!, window: 5, days: 74.8 }, campaignFile(observations[1]!)!, { ...campaignFile(observations[1]!)!, window: 18, days: 80.6 }];
  assert.equal(pickFile(campaigns)!.window, 18); assert.equal(pickFile([]), undefined);
  assert.throws(() => parseObservations({ status: 'ERROR' }), /did not answer with a list of observations/u);
});
