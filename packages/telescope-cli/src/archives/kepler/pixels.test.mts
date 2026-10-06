import assert from 'node:assert/strict';
import test from 'node:test';
import { parseObservations, parseProducts, pickFile } from './pixels.mts';

test('MAST\'s answers are read as the long-cadence pixel files of Kepler and K2', () => {
  // Kepler-93 has a 30-minute and a one-minute observation; only the first is kept.
  const observations = parseObservations({ status: 'COMPLETE', data: [{ obsid: 526507, obs_collection: 'Kepler', target_name: 'kplr003544595', t_exptime: 1800 }, { obsid: 600965, obs_collection: 'Kepler', target_name: 'kplr003544595', t_exptime: 60 },
    { obsid: 7, obs_collection: 'TESS', target_name: 'x', t_exptime: 1800 }] });
  assert.deepEqual(observations, [{ obsid: 526507, mission: 'Kepler', target: 'kplr003544595' }]);
  const k2 = { obsid: 735180, mission: 'K2' as const, target: 'ktwo247589423' };
  const files = parseProducts({ status: 'COMPLETE', data: [{ productFilename: 'ktwo247589423-c13_llc.fits', dataURI: 'mast:K2/url/x_llc.fits', size: 423360, productSubGroupDescription: 'LLC', description: 'Lightcurve Long Cadence (KLC) - C13' },
    { productFilename: 'ktwo247589423-c13_lpd-targ.fits.gz', dataURI: 'mast:K2/url/missions/k2/target_pixel_files/c13/247500000/89000/ktwo247589423-c13_lpd-targ.fits.gz', size: 8877975, productSubGroupDescription: 'LPD-TARG', description: 'Target Pixel Long Cadence (KTL) - C13' },
    { productFilename: 'ktwo247589423-c05_lpd-targ.fits.gz', dataURI: 'mast:K2/url/c05', size: 6000000, productSubGroupDescription: 'LPD-TARG', description: 'Target Pixel Long Cadence (KTL) - C5' }] }, k2);
  assert.deepEqual(files.map(file => [file.window, file.bytes]), [[5, 6000000], [13, 8877975]]); assert.equal(pickFile(files)!.window, 13); assert.equal(pickFile([]), undefined);
  assert.throws(() => parseObservations({ status: 'ERROR' }), /did not answer with a list of observations/u);
});
