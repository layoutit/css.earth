import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { gzipSync } from 'node:zlib';
import { sha256 as sha } from '../../../src/platform/sha256.mts';
import { card } from '../../../tests/fixtures/fits/helpers.mts';
import { encodeAsinhBands } from '../color-transfer.mts';
import { composeSkyBands, parseSkyBandComposite, skyBandCompositeFile, skyBandUrl, SKY_BANDS, verifySkyBandRecipe } from './sky-band-composite.mts';
import { gridWcs } from './wise-atlas-mosaic.mts';

const width = 16, height = 16, ra = 56.477, dec = 24.17, grid = { width, height, fovDeg: 0.016, centerIcrsDegrees: [ra, dec] as [number, number] };
const wcs = gridWcs(grid);
function hips2fits(hips: string, sample: (x: number, fitsRow: number) => number, extra: readonly string[] = []) {
  const cards = [card('SIMPLE', 'T'), card('BITPIX', '-32'), card('NAXIS', '2'), card('NAXIS1', String(width)), card('NAXIS2', String(height)),
    card('WCSAXES', '2'), card('CRPIX1', '8.0'), card('CRPIX2', '8.0'), card('CDELT1', String(wcs.scaleDeg[0])), card('CDELT2', String(wcs.scaleDeg[1])),
    card('CUNIT1', "'deg'"), card('CUNIT2', "'deg'"), card('CTYPE1', "'RA---TAN'"), card('CTYPE2', "'DEC--TAN'"),
    card('CRVAL1', String(ra)), card('CRVAL2', String(dec)), card('LONPOLE', '180.0'), card('RADESYS', "'ICRS'"), ...extra,
    `HISTORY From HiPS ${hips} (fixture)`.padEnd(80), 'END'.padEnd(80)];
  const header = Buffer.from(cards.join('').padEnd(Math.ceil(cards.length * 80 / 2880) * 2880));
  const data = Buffer.alloc(Math.ceil(width * height * 4 / 2880) * 2880);
  for (let row = 0; row < height; row++) for (let x = 0; x < width; x++) data.writeFloatBE(sample(x, row), (row * width + x) * 4);
  return Buffer.concat([header, data]);
}
async function withCache(run: (cache: string, place: (bytes: Buffer) => Promise<{ sha256: string; bytes: number }>) => Promise<void>) {
  const cache = await mkdtemp(join(tmpdir(), 'sky-bands-'));
  try {
    await run(cache, async bytes => {
      await mkdir(join(cache, 'hips2fits'), { recursive: true }); await writeFile(join(cache, 'hips2fits', `${sha(bytes)}.fits`), bytes);
      return { sha256: sha(bytes), bytes: bytes.length };
    });
  } finally { await rm(cache, { recursive: true, force: true }); }
}
const noInput = async (): Promise<Buffer> => { throw new Error('No repository input expected.'); };
const recipe = (bands: unknown[], display = { minimum: 0, stretch: 2, softening: 8 }) => parseSkyBandComposite({
  schema: 'cssearth-sky-band-composite@1', grid, bands, backgroundPercentile: 5, peakPercentile: 100, display });

test('hips2fits bands are calibrated by the route, divided by their own measured range and flipped into top-down rows', () => withCache(async (cache, place) => {
  const red = hips2fits('CDS/P/SPITZER/IRAC4', (x, row) => 30 + (x === 3 && row === 0 ? 2 : 0));
  const green = hips2fits('CDS/P/SPITZER/IRAC2', (x, row) => x === 7 && row === 7 ? 1 : 0);
  const blue = hips2fits('CDS/P/SPITZER/IRAC1', (x, row) => row === height - 1 ? 40 : 0);
  const composite = recipe([{ band: 'IRAC4', ...await place(red) }, { band: 'IRAC2', ...await place(green) }, { band: 'IRAC1', ...await place(blue) }]);
  const result = await composeSkyBands(composite, { input: noInput, cache });
  assert.deepEqual(result.wcs, { projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: [16, 16], referencePixel: [8, 8],
    referenceValueDeg: [ra, dec], scaleDeg: wcs.scaleDeg, rotationDeg: 0 });
  assert.ok(Math.abs(result.evidence.bands[0]!.backgroundMJyPerSr - 30 * 0.74) < 1e-4 && Math.abs(result.evidence.bands[0]!.peakMJyPerSr - 32 * 0.74) < 1e-4);
  // FITS row 0 is the bottom raster row; the top raster row is FITS row 15. IRAC4's knot is its own peak: 1.
  const expected = encodeAsinhBands(new Float32Array([1, 0, 0]), new Uint8Array(1), composite.display);
  assert.deepEqual([...result.rgb.subarray(((height - 1) * width + 3) * 3, ((height - 1) * width + 4) * 3)], [...expected]);
  assert.ok(result.rgb[1] === 0 && result.rgb[2]! > 0, 'Top raster row takes blue from the last FITS row.');
  assert.equal(result.missingPixels, 0);
  assert.equal(new URL(skyBandUrl(grid, 'CDS/P/SPITZER/IRAC4')).searchParams.get('hips'), 'CDS/P/SPITZER/IRAC4');
  const w4 = SKY_BANDS.W4!.toMJyPerSr, w1 = SKY_BANDS.W1!.toMJyPerSr;
  assert.ok(Math.abs(w4 - 1.17622) < 1e-4 && Math.abs(w1 - 0.043544) < 1e-5, 'Explanatory Supplement Jy/DN over a 1.375 arcsec pixel');
}));

test('missing coverage stays black and every grid, identity, acquisition and pin mismatch refuses', () => withCache(async (cache, place) => {
  const band = hips2fits('CDS/P/SPITZER/IRAC4', (x, row) => x === 0 && row === 0 ? NaN : x === 5 ? 9 : 5);
  const mono = recipe([{ band: 'IRAC4', ...await place(band) }], { minimum: -1, stretch: 10, softening: 4 });
  const result = await composeSkyBands(mono, { input: noInput, cache });
  assert.equal(result.missingPixels, 1);
  assert.deepEqual([...result.rgb.subarray((height - 1) * width * 3, (height - 1) * width * 3 + 3)], [0, 0, 0]);
  assert.ok(result.rgb[0] === result.rgb[1] && result.rgb[1] === result.rgb[2] && result.rgb[0]! > 0, 'One band is monochrome.');
  const refuse = async (bytes: Buffer, pattern: RegExp) =>
    assert.rejects(composeSkyBands(recipe([{ band: 'IRAC4', ...await place(bytes) }]), { input: noInput, cache }), pattern);
  await refuse(hips2fits('CDS/P/SPITZER/IRAC1', () => 5), /does not name/);
  await refuse(hips2fits('CDS/P/SPITZER/IRAC4', () => 5, [card('PC1_2', '0.1')]), /rotation/);
  await refuse(hips2fits('CDS/P/SPITZER/IRAC4', () => 5), /no signal/);
  // WISE HiPS carry per-tile levels: WISE bands are refused as hips2fits inputs and need atlas tile lists.
  assert.throws(() => recipe([{ band: 'W4', sha256: 'a'.repeat(64), bytes: 4000 }]), /Unsupported sky band or acquisition/);
  assert.throws(() => recipe([{ band: 'J', sha256: 'a'.repeat(64), bytes: 4000 }]), /Unsupported/);
  assert.throws(() => parseSkyBandComposite({ schema: 'cssearth-sky-band-composite@1', grid, backgroundPercentile: 5, peakPercentile: 100,
    bands: [{ band: 'IRAC4', sha256: 'a'.repeat(64), bytes: 4000 }], display: { minimum: 0, stretch: 1, softening: 8 }, gains: [1] }), /Unsupported/);
}));

test('WISE bands mosaic pinned atlas tiles through a pinned tile list', async () => {
  const cache = await mkdtemp(join(tmpdir(), 'sky-bands-'));
  try {
    const size = 64, scale = 0.0005;
    const tile = (coaddId: string, tileRa: number, level: number) => {
      const cards = [card('SIMPLE', 'T'), card('BITPIX', '-32'), card('NAXIS', '2'), card('NAXIS1', String(size)), card('NAXIS2', String(size)),
        card('BUNIT', "'DN      '"), card('CRVAL1', String(tileRa)), card('CRVAL2', String(dec)), card('EQUINOX', '2000.0'), card('CTYPE1', "'RA---SIN'"),
        card('CTYPE2', "'DEC--SIN'"), card('CRPIX1', '32'), card('CRPIX2', '32'), card('CDELT1', String(-scale)), card('CDELT2', String(scale)),
        card('CROTA2', '0.000000'), card('COADDID', `'${coaddId}'`), card('MAGZP', '13.'), 'END'.padEnd(80)];
      const header = Buffer.from(cards.join('').padEnd(Math.ceil(cards.length * 80 / 2880) * 2880)), data = Buffer.alloc(Math.ceil(size * size * 4 / 2880) * 2880);
      for (let i = 0; i < size * size; i++) data.writeFloatBE(level + (i % 97 === 0 ? 50 : 0), i * 4);
      return gzipSync(Buffer.concat([header, data]));
    };
    const tiles = [tile('0564p242_ac51', ra - 0.004, 100), tile('0565p242_ac51', ra + 0.004, 130)];
    await mkdir(join(cache, 'wise-atlas'), { recursive: true });
    const pinsList = Buffer.from(JSON.stringify({ schema: 'cssearth-wise-atlas-tiles@1', band: 'W4',
      tiles: tiles.map((bytes, i) => ({ coaddId: `056${4 + i}p242_ac51`, sha256: sha(bytes), bytes: bytes.length })) }));
    for (const [i, bytes] of tiles.entries()) await writeFile(join(cache, 'wise-atlas', `056${4 + i}p242_ac51-w4-int-3.fits.gz`), bytes);
    const composite = parseSkyBandComposite({ schema: 'cssearth-sky-band-composite@1', grid, backgroundPercentile: 5, peakPercentile: 100,
      bands: [{ band: 'W4', tiles: { path: 'src/objects/m45/source/wise-atlas/w4.json', sha256: sha(pinsList) } }], display: { minimum: 0, stretch: 1, softening: 8 } });
    const listPath = 'src/objects/m45/source/wise-atlas/w4.json';
    const result = await composeSkyBands(composite, { input: async path => { assert.equal(path, listPath); return pinsList; }, cache });
    const acquisition = result.evidence.bands[0]!.acquisition as { kind: string; backgroundMatching: { medianOverlapStepDnBefore: number; medianOverlapStepDnAfter: number } };
    assert.equal(acquisition.kind, 'wise-atlas');
    assert.ok(Math.abs(Math.abs(acquisition.backgroundMatching.medianOverlapStepDnBefore) - 30) < 1e-3, JSON.stringify(acquisition.backgroundMatching));
    assert.ok(acquisition.backgroundMatching.medianOverlapStepDnAfter < 1e-6);
    await assert.rejects(composeSkyBands(composite, { input: async () => Buffer.from('{}'), cache }), /Changed WISE atlas tile list/);
  } finally { await rm(cache, { recursive: true, force: true }); }
});

test('recipe verification reads the recipe and every tile list, and composites are cached under their own hash', async () => {
  const list = Buffer.from(JSON.stringify({ schema: 'cssearth-wise-atlas-tiles@1', band: 'W4', tiles: [{ coaddId: '0564p242_ac51', sha256: 'c'.repeat(64), bytes: 10 }] }));
  const recipe = Buffer.from(JSON.stringify({ schema: 'cssearth-sky-band-composite@1', grid, backgroundPercentile: 1, peakPercentile: 99.9,
    bands: [{ band: 'W4', tiles: { path: 'src/objects/x/w4.json', sha256: sha(list) } }], display: { minimum: 0, stretch: 1, softening: 8 } }));
  const files = new Map([['src/objects/x/recipe.json', recipe], ['src/objects/x/w4.json', list]]);
  const input = async (path: string) => { const bytes = files.get(path); if (!bytes) throw new Error(`missing ${path}`); return bytes; };
  const pin = { path: 'src/objects/x/recipe.json', sha256: sha(recipe) };
  assert.deepEqual((await verifySkyBandRecipe(pin, input)).files.map(file => file.path), ['src/objects/x/recipe.json', 'src/objects/x/w4.json']);
  await assert.rejects(verifySkyBandRecipe({ ...pin, sha256: 'd'.repeat(64) }, input), /Changed sky band recipe/);
  files.set('src/objects/x/w4.json', Buffer.from('{}'));
  await assert.rejects(verifySkyBandRecipe(pin, input), /Changed WISE atlas tile list/);
  files.delete('src/objects/x/w4.json');
  await assert.rejects(verifySkyBandRecipe(pin, input), /missing/);
  assert.equal(skyBandCompositeFile('spitzer-mid-infrared', 'e'.repeat(64)), `spitzer-mid-infrared.${'e'.repeat(64)}.png`);
  assert.throws(() => skyBandCompositeFile('../x', 'e'.repeat(64)), /identity/);
});
