import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { skyDisplayRaster, skyImageAxes } from './fits-sky.mts';

const tan = { CTYPE1: 'RA---TAN', CTYPE2: 'DEC--TAN', CRVAL1: 83.8, CRVAL2: 22, CDELT1: -1e-4, CDELT2: 1e-4, CUNIT1: 'deg', CUNIT2: 'deg' };

test('only axis-aligned celestial images with one zenithal projection have a display orientation', () => {
  assert.deepEqual(skyImageAxes(tan), { eastRight: false, northUp: true, scale: [1e-4, 1e-4], unit: 'deg' });
  for (const [change, message] of [
    [{ CTYPE1: 'DEC--TAN', CTYPE2: 'RA---TAN' }, /RA along columns/],
    [{ CTYPE1: 'GLON-TAN', CTYPE2: 'GLAT-TAN' }, /RA along columns/],
    [{ CTYPE2: 'DEC--SIN' }, /one projection/],
    [{ CTYPE1: 'RA---CAR', CTYPE2: 'DEC--CAR' }, /not zenithal/],
    [{ LONPOLE: 0 }, /LONPOLE/],
    [{ CRVAL2: 90 }, /pole/],
    [{ CD1_1: -1e-4, CD2_2: 1e-4 }, /more than one/],
    [{ CDELT1: undefined, CDELT2: undefined, CD1_1: -1e-4, CD2_2: 1e-4, CROTA2: 0 }, /more than one/],
    [{ PC1_1: 1, CROTA2: 0 }, /more than one/],
    [{ CROTA1: 10, CROTA2: 0 }, /CROTA1/],
    [{ CDELT1: 0 }, /rotated or skewed/],
    [{ CUNIT2: 'arcsec' }, /different units/],
    [{ CDELT2: '1e-4' }, /CDELT2/],
  ] as const) assert.throws(() => skyImageAxes({ ...tan, ...change }), message, JSON.stringify(change));
});

test('display rasters keep their sample type and refuse a size that does not match', () => {
  const values = Float32Array.from([1, 2, 3, 4, 5, 6]);
  const display = skyDisplayRaster(values, 3, 2, { eastRight: true, northUp: true });
  assert.ok(display instanceof Float32Array);
  assert.deepEqual([...display], [6, 5, 4, 3, 2, 1]);
  assert.deepEqual([...values], [1, 2, 3, 4, 5, 6]);
  assert.throws(() => skyDisplayRaster(values, 4, 2, { eastRight: false, northUp: false }), /size/);
});
