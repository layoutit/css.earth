import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeFitsImageMap } from './fits-image-map.mts';
import { loadScienceSurface } from './scientific-raster.mts';

function header(fields: Record<string, string | number | boolean>) {
  const cards = Object.entries(fields).map(([key, value]) => `${key.padEnd(8)}= ${typeof value === 'string' ? `'${value}'` : typeof value === 'boolean' ? value ? 'T' : 'F' : value}`.padEnd(80));
  const text = cards.join('') + 'END'.padEnd(80);
  return Buffer.from(text.padEnd(Math.ceil(text.length / 2880) * 2880), 'ascii');
}
function file(values = [0, 25, 50, 100, 25, 75, NaN, 5], flags = [1, 1, 1, 1, -1, 1, 1, 1]) {
  const hdus = [header({ SIMPLE: true, BITPIX: 8, NAXIS: 0, EXTEND: true, MODEL: 'published v1' })];
  for (const [i, data] of [values, flags].entries()) {
    hdus.push(header({ XTENSION: 'IMAGE', BITPIX: -32, NAXIS: 2, NAXIS1: 4, NAXIS2: 2, PCOUNT: 0, GCOUNT: 1, EXTNAME: i === 0 ? 'FRACTION' : 'FIT', UNITS: '%' }));
    const bytes = Buffer.alloc(2880); data.forEach((v, j) => bytes.writeFloatBE(v, j * 4)); hdus.push(bytes);
  }
  return Buffer.concat(hdus);
}
const recipe = { path: 'map.fits', sampling: 'nearest', extension: 1, name: 'FRACTION', units: '%', primary: { MODEL: 'published v1' },
  grid: { width: 4, height: 2, longitudeOrigin: 0, rowOrder: 'north-to-south' },
  missingTuple: [{ extension: 1, name: 'FRACTION', units: '%', value: 25 }, { extension: 2, name: 'FIT', units: '%', value: -1 }] };

test('FITS scalar maps distinguish real 0% and 25% from the complete missing-fit tuple', () => {
  const map = decodeFitsImageMap(file(), recipe);
  assert.equal(map.sample(45, 45), 0);
  assert.equal(map.sample(135, 45), 25);
  assert.equal(map.sample(45, -45), null);
  assert.equal(map.sample(225, -45), null);
  assert.equal(map.sampleCell(-1, 0), null);
  assert.equal(map.sampleCell(0, 0), 0);
});

test('FITS scalar maps honor the source longitude origin, row order and polar cells', () => {
  const map = decodeFitsImageMap(file(), recipe);
  assert.equal(map.sample(-45, 45), 100);
  assert.equal(map.sample(675, 90), 100);
  assert.equal(map.sample(315, -90), 5);
  assert.equal(map.sample(0, 91), null);
  assert.equal(map.sample(NaN, 0), null);
  const shifted = decodeFitsImageMap(file(), { ...recipe, grid: { ...recipe.grid, longitudeOrigin: -180, rowOrder: 'south-to-north' } });
  assert.equal(shifted.sample(135, -45), 100);
  assert.equal(shifted.sample(-45, 45), 75);
});

test('FITS scalar maps refuse wrong quantities, units, solution identities and incomplete HDUs', () => {
  for (const change of [{ name: 'TEMPERATURE' }, { units: 'K' }, { primary: { MODEL: 'different fit' } },
    { extension: 3 }, { sampling: 'bilinear' }, { grid: { ...recipe.grid, width: 5 } }]) {
    assert.throws(() => decodeFitsImageMap(file(), { ...recipe, ...change }));
  }
  assert.throws(() => decodeFitsImageMap(file().subarray(0, -1), recipe), /truncated/i);
  const scaled = file(); Buffer.from('BSCALE  = 2'.padEnd(80)).copy(scaled, 2880 + 9 * 80);
  Buffer.from('END'.padEnd(80)).copy(scaled, 2880 + 10 * 80);
  assert.throws(() => decodeFitsImageMap(scaled, recipe), /layout/);
});

test('FITS uncertainty masks reject invalid or uninformative errors at the same source cell', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fits-science-'));
  try {
    await writeFile(join(root, 'map.fits'), file());
    await writeFile(join(root, 'errors.fits'), file([1, 101, -1, 4, 1, 1, 1, 1]));
    const source = await loadScienceSurface(root, { ...recipe, format: 'fits-image-map',
      qualityMasks: [{ ...recipe, missingTuple: undefined, path: 'errors.fits', format: 'fits-image-map', minimum: 0, maximum: 100 }] });
    assert.equal(source.sample(45, 45), 0);
    assert.equal(source.sample(135, 45), null);
    assert.equal(source.sample(225, 45), null);
    assert.equal(source.sample(315, 45), 100);
    assert.equal(source.sample(45, -45), null);
  } finally { await rm(root, { recursive: true, force: true }); }
});
