import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { discBandColor, parseDiscBandColorRecord } from './disc-band-color.mts';

const record = async (letter: string) => JSON.parse(await readFile(new URL(`../../../src/objects/hr-8799-${letter}/source/photometry/jwst-nircam-band-color.json`, import.meta.url), 'utf8')) as Record<string, any>;

test('the HR 8799 planets take their colour from Balmer et al. (2025) Table 2 on one shared range', async () => {
  const hex = async (letter: string) => '#' + discBandColor(parseDiscBandColorRecord(await record(letter))).srgb.map(value => value.toString(16).padStart(2, '0')).join('');
  // Each channel is the flux density over 410.5 µJy (planet d in F410M), sRGB-encoded once: b's 64.5, 72.6 and 164.6 µJy.
  assert.deepEqual(await Promise.all(['b', 'c', 'd', 'e'].map(hex)), ['#6e75aa', '#9ea8c8', '#e4efff', '#a8a6cf']);
  const ranges = await Promise.all(['b', 'c', 'd', 'e'].map(async letter => (await record(letter)).displayRange.join()));
  assert.equal(new Set(ranges).size, 1, 'one range for the four planets');
});

test('a band colour refuses an unordered, out-of-range or unanchored record and names what it refused', async () => {
  const b = await record('b');
  assert.throws(() => parseDiscBandColorRecord({ ...b, bands: [...b.bands].reverse() }), /longest wavelength.*F410M 4.084 µm/u);
  assert.throws(() => parseDiscBandColorRecord({ ...b, displayRange: [0, 100] }), /F410M 164.6 is above the common range's top 100/u);
  assert.throws(() => parseDiscBandColorRecord({ ...b, displayRange: [10, 410.5] }), /from zero flux/u);
  assert.throws(() => parseDiscBandColorRecord({ ...b, bands: b.bands.slice(0, 2) }), /three bands, not 2/u);
  assert.throws(() => parseDiscBandColorRecord({ ...b, schema: 'other' }), /cssearth-disc-band-color@1/u);
});
