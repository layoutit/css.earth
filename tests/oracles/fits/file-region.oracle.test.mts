import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { readFitsFileHdus, readFitsFileRegion } from '@cssearth/fits/node';

// Astropy 8.0.1, fits.open(path, memmap=True)[1].section[40:160, 250:762]. The archived STIS FITS file is tracked.
// The values below are Astropy's: the reader matched its whole region as big-endian float64 bytes when they were
// recorded, and they are the extrema and a spread of samples across the region's rows and columns.
const path = resolve('tests/fixtures/telescope-families/f04-europa-stis/od9l12010_x2d.fits');
const samples: readonly (readonly [number, number])[] = [
  [0, 0], [511, 0], [12345, 0], [30976, 5.078860797230094e-15], [40000, 2.037976856500076e-13],
  [60928, -3.68545288959108e-14], [61439, 6.594913400510783e-15],
  [26131, -2.1617677266327906e-12], [44534, 4.84030610731212e-12],
];

test('on-disk subregion agrees with Astropy decoded values', async () => {
  const hdu = (await readFitsFileHdus(path))[1];
  assert.ok(hdu);
  const { values } = await readFitsFileRegion(path, hdu, { x0: 250, y0: 40, width: 512, height: 120 });
  assert.equal(values.length, 512 * 120);
  assert.ok(values.every(Number.isFinite));
  for (const [index, value] of samples) assert.equal(values[index], value, `region value ${index}`);
  let minimum = Infinity, maximum = -Infinity;
  for (const value of values) { minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); }
  assert.deepEqual([minimum, maximum], [-2.1617677266327906e-12, 4.84030610731212e-12]);
});
