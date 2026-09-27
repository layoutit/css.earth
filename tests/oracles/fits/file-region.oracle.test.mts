import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resolve } from 'node:path';
import { readFitsFileHdus, readFitsFileRegion } from '@cssearth/fits/node';

// Astropy 8.0.1, fits.open(path, memmap=True)[1].section[40:160, 250:762],
// converted to big-endian float64 before hashing. The archived STIS FITS file is tracked.
const path = resolve('tests/fixtures/telescope-families/f04-europa-stis/od9l12010_x2d.fits');
const sourceSha256 = '7bc15b70d112056c4c063a9890be87be0a060232e65a2ebf674bf12963fa2e20';
const regionSha256 = 'bde996445678a066de6397fa7f61d6986a48951b4cb202ff2e92b9ee2d76fc46';

test('on-disk subregion agrees byte for byte with Astropy decoded values', async () => {
  assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), sourceSha256);
  const hdu = (await readFitsFileHdus(path))[1];
  assert.ok(hdu);
  const { values } = await readFitsFileRegion(path, hdu, { x0: 250, y0: 40, width: 512, height: 120 });
  const bytes = Buffer.alloc(values.length * 8);
  values.forEach((value, index) => bytes.writeDoubleBE(value, index * 8));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), regionSha256);
});
