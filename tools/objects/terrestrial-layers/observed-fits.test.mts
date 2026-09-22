import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFitsPrimary } from '../observation/fits.mts';
import { mapFitsObservation } from './observed-fits.mts';

function fitsBytes(bitpix: number, values: readonly number[], extra: readonly string[] = []) {
  const bytes = Buffer.alloc(5760, 32), cards = ['SIMPLE  = T', `BITPIX  = ${bitpix}`, 'NAXIS   = 2',
    'NAXIS1  = 4', 'NAXIS2  = 2', ...extra, 'END'];
  cards.forEach((card, i) => bytes.write(card.padEnd(80), i * 80, 'ascii'));
  values.forEach((v: number, i: number) => bitpix === 8 ? bytes.writeUInt8(v, 2880 + i) : bytes.writeFloatBE(v, 2880 + i * 4));
  return bytes;
}
const entry = { width: 4, height: 2 };
const policy = { bitpix: 8, longitudeDirection: 'east', rowOrder: 'south-to-north',
  centerLongitude: 0, noData: 0, displayRange: [0, 255] };

test('FITS preserves unsigned byte samples and existing big endian float values', () => {
  assert.deepEqual([...readFitsPrimary(fitsBytes(8, [1,2,3,255,5,6,7,8])).values], [1,2,3,255,5,6,7,8]);
  assert.deepEqual([...readFitsPrimary(fitsBytes(-32, [1,-2,3.5,4,5,6,7,8])).values], [1,-2,3.5,4,5,6,7,8]);
  assert.equal(readFitsPrimary(fitsBytes(-32, [1,2,3,4,5,6,7,8], ['BSCALE  = 2', 'BZERO   = 10'])).values[0], 12);
  assert.throws(() => readFitsPrimary(fitsBytes(8, [1]).subarray(0, 2885)), /truncated/i);
});

test('source FITS rows and east/west longitudes map to the same north-up eastern grid', () => {
  const fits = readFitsPrimary(fitsBytes(8, [1,2,3,4,10,20,30,40]));
  const gray = (p: unknown) => [...mapFitsObservation(fits, entry, p, 4, 2).rgb].filter((_, i) => i % 3 === 0);
  assert.deepEqual(gray(policy), [30,40,10,20,3,4,1,2]);
  assert.deepEqual(gray({ ...policy, longitudeDirection: 'west' }), [20,10,40,30,2,1,4,3]);
  assert.deepEqual(gray({ ...policy, rowOrder: 'north-to-south' }), [3,4,1,2,30,40,10,20]);
  assert.throws(() => mapFitsObservation(fits, { ...entry, width: 5 }, policy, 4, 2), /grid/);
});

test('missing FITS footprints are withheld before brightness interpolation; dark valid data remain', () => {
  const fits = readFitsPrimary(fitsBytes(8, [0,1,20,30,40,50,60,70]));
  const result = mapFitsObservation(fits, entry, { ...policy, centerLongitude: 180, rowOrder: 'north-to-south' }, 8, 4);
  assert.equal(result.sourceMissingPixels, 1);
  assert.equal(result.missing[0], 1);
  assert.ok(result.missing.some(v => v === 0));
  assert.equal(result.rgb[0], 0);
});
