import assert from 'node:assert/strict';
import test from 'node:test';
import { readFitsHdus } from '@cssearth/fits';
import { binSpectrum, extractPreview } from './extract.mts';
import { numericColumn, previewTable } from './fits-table.mts';
import { continuum, cube, esoSpectrum, hstSpectrum, image, spectrumTable } from './test-support.mts';

// Grids keep three decimals, as the approved panels were drawn from.
const r3 = (value: number) => Math.round(value * 1000) / 1000;

test('ESO vector WAVE/FLUX_REDUCED and HST NELEM arrays retain paired data and units', () => {
  assert.deepEqual(extractPreview(esoSpectrum(), 'eso', 'spectrum'), { kind: 'spectrum', x: [300, 310, 320, 330], y: [4, -2, 6, 3], xunit: 'nm', yunit: 'adu' });
  const hst = extractPreview(hstSpectrum(), 'hst', 'spectrum');
  assert.equal(hst.kind, 'spectrum');
  if (hst.kind !== 'spectrum') throw new Error('Expected spectrum.');
  assert.deepEqual(hst.x, [200, 210, 220]); assert.equal(hst.y.length, 3); assert.equal(hst.yunit, 'erg/s/cm²/Å');
  assert.ok(Math.abs(hst.y[0]! - 1e-11) < 1e-18);
});

test('fixed-width numeric tables apply integer scaling and nulls and skip unrelated columns', () => {
  const bytes = spectrumTable([{ name: 'WAVE', form: '4J', unit: 'nm' }, { name: 'FLUX_REDUCED', form: '4I', unit: 'adu' }],
    [[[1, 2, 3, 4], [1, -32768, 3, 4]]], [['TSCAL1', 10], ['TZERO1', 300], ['TSCAL2', 2], ['TZERO2', 100], ['TNULL2', -32768]], [['PRODCATG', 'SCIENCE.SPECTRUM']]);
  const table = previewTable(readFitsHdus(bytes)[1]!);
  assert.deepEqual(numericColumn(bytes, table, 'WAVE', 0).values, [310, 320, 330, 340]);
  assert.ok(Number.isNaN(numericColumn(bytes, table, 'FLUX_REDUCED', 0).values[1]));
  assert.deepEqual(extractPreview(bytes, 'eso', 'spectrum'), { kind: 'spectrum', x: [310, 330, 340], y: [102, 106, 108], xunit: 'nm', yunit: 'adu' });
  assert.throws(() => numericColumn(bytes, table, 'WAVE', 1), /out of bounds/u);
});

test('8192D arrays and scalar rows are read; malformed/variable tables are refused', () => {
  const values = Array.from({ length: 8192 }, (_, i) => i + 1);
  const bytes = spectrumTable([{ name: 'WAVE', form: '8192D', unit: 'nm' }, { name: 'FLUX_REDUCED', form: '8192D', unit: 'adu' }], [[values, values]], [], [['PRODCATG', 'SCIENCE.SPECTRUM']]);
  const preview = extractPreview(bytes, 'eso', 'spectrum'); assert.equal(preview.kind, 'spectrum');
  if (preview.kind === 'spectrum') assert.equal(preview.x.length, 90);
  const changed = Buffer.from(bytes), at = changed.indexOf('8192D'); changed.write('1PD  ', at);
  assert.throws(() => extractPreview(changed, 'eso', 'spectrum'), /variable-length/u);
  assert.throws(() => extractPreview(bytes.subarray(0, bytes.length - 2880), 'eso', 'spectrum'), /Truncated/u);
  const scalar = spectrumTable([{ name: 'WAVE', form: '1D', unit: 'nm' }, { name: 'FLUX_REDUCED', form: '1D', unit: 'adu' }], [[[300], [4]], [[310], [7]]], [], [['PRODCATG', 'SCIENCE.SPECTRUM']]);
  assert.deepEqual(extractPreview(scalar, 'eso', 'spectrum'), { kind: 'spectrum', x: [300, 310], y: [4, 7], xunit: 'nm', yunit: 'adu' });
});

test('median bins reject unpaired/nonfinite data and preserve negative samples', () => {
  const x = Array.from({ length: 180 }, (_, i) => i), y = x.map(i => i % 2 ? i : -i);
  const binned = binSpectrum(x, y, 'nm', 'adu');
  assert.equal(binned.x.length, 90); assert.equal(binned.x[0], 0.5); assert.equal(binned.y[1], 0.5);
  assert.deepEqual(binSpectrum([1, 2, 3], [-5, NaN, -3], 'nm', 'adu').y, [-5, -3]);
  assert.throws(() => binSpectrum([1, 2], [1], '', ''), /differ/u);
});

test('ALMA cubes sum finite pixels and use 1-based CRPIX3 in GHz, with mock mJy units', () => {
  const preview = extractPreview(cube(), 'alma', 'cube');
  assert.deepEqual(preview, { kind: 'spectrum', x: [210, 211, 212], y: [10000, 7000, -10000], xunit: 'GHz', yunit: 'mJy/beam' });
  const invalid = image([2, 2, 2], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.throws(() => extractPreview(invalid, 'alma', 'cube'), /frequency axis/u);
  assert.throws(() => extractPreview(invalid, 'alma', 'image'), /multi-plane/u);
});

test('ALMA peak-crops, max-pools to 30 by 60, replaces NaN and stretches after pooling', () => {
  const preview = extractPreview(continuum(), 'alma', 'image');
  assert.equal(preview.kind, 'image');
  if (preview.kind !== 'image') throw new Error('Expected image.');
  assert.equal(preview.grid.length, 30); assert.ok(preview.grid.every(row => row.length === 60));
  assert.equal(preview.grid[15]![30], 1); assert.equal(preview.grid[0]![0], 0.25);
  const nan = extractPreview(image([3, 3], [NaN, 0, 0, 0, 1, 0, 0, 0, 16]), 'alma', 'image');
  assert.deepEqual(nan, preview);
  assert.throws(() => extractPreview(image([2, 2], [4, 3, 2, 1]), 'alma', 'image'), /crop is empty/u);
});

test('ALMA limits the peak crop to half-size 60 and takes the maximum of each pooling cell', () => {
  const pixels = Array<number>(123 * 123).fill(0);
  pixels[61 * 123 + 61] = 100; pixels[0] = 99; pixels[123 + 1] = 4; pixels[8 * 123 + 6] = 9;
  const preview = extractPreview(image([123, 123], pixels), 'alma', 'image');
  if (preview.kind !== 'image') throw new Error('Expected image.');
  assert.equal(preview.grid[0]![0], 0.2); assert.equal(preview.grid[1]![2], 0.3); assert.equal(preview.grid[15]![30], 1);
});

test('ESO uses linear percentiles and an asinh stretch, retaining FITS scaling and signed pixels', () => {
  const base = image([2, 2], [0, 2, 4, 8], [['PRODCATG', 'SCIENCE.IMAGE']], 16);
  const scaled = image([2, 2], [0, 2, 4, 8], [['PRODCATG', 'SCIENCE.IMAGE'], ['BZERO', -4], ['BSCALE', 2]], 16);
  const a = extractPreview(base, 'eso', 'image', 'SPHERE'), b = extractPreview(scaled, 'eso', 'image', 'SPHERE');
  assert.equal(a.kind, 'image'); assert.equal(b.kind, 'image');
  if (a.kind === 'image' && b.kind === 'image') {
    for (let row = 0; row < 30; row++) for (let column = 0; column < 60; column++) assert.ok(Math.abs(a.grid[row]![column]! - b.grid[row]![column]!) < 1e-14);
    assert.equal(a.caption, 'SPHERE image · ESO data');
  }
  const negative = extractPreview(image([2, 2], [-8, -4, -2, -1], [['PRODCATG', 'SCIENCE.IMAGE']]), 'eso', 'image');
  if (negative.kind !== 'image') throw new Error('Expected signed image.');
  assert.equal(negative.grid[0]![0], 0); assert.equal(negative.grid[29]![59], 1);
  assert.equal(negative.grid[0]![30], r3(Math.asinh((-4 + 7.4) / (7.4 - 1.009) * 10) / Math.asinh(10)));
  assert.throws(() => extractPreview(image([2, 2], [1, 2, 3, 4]), 'eso', 'image'), /category/u);
});

test('ESO stretches the whole image before its centred square crop, sampling the nearest pixel unless it divides evenly', () => {
  const cropped = extractPreview(image([6, 2], [-100, -50, 0, 10, 50, 100, -100, -50, 0, 10, 50, 100], [['PRODCATG', 'SCIENCE.IMAGE']]), 'eso', 'image');
  if (cropped.kind !== 'image') throw new Error('Expected image.');
  assert.equal(cropped.grid[0]![0], r3(Math.asinh(5) / Math.asinh(10)));
  assert.equal(cropped.grid[0]![30], r3(Math.asinh(5.5) / Math.asinh(10)));
  const pooled = extractPreview(image([60, 60], Array.from({ length: 3600 }, (_, i) => Math.floor(i / 60) % 2 * 10), [['PRODCATG', 'SCIENCE.IMAGE']]), 'eso', 'image');
  if (pooled.kind !== 'image') throw new Error('Expected image.');
  assert.ok(pooled.grid.every(row => row.every(value => value === 0.5)));
});
