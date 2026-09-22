import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { gzipSync } from 'node:zlib';
import { sha256 as sha } from '../../../src/platform/sha256.mts';
import { card } from '../../../tests/fixtures/fits/helpers.mts';
import { encodeAsinhBands } from '../color-transfer.mts';
import { composeSkyBandPlanes, composeSkyBands, parseSkyBandComposite, skyBandUrl, SKY_BANDS, verifySkyBandRecipe } from './sky-band-composite.mts';
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
/** The cache names a hips2fits response by its request URL. */
async function withCache(run: (cache: string, place: (bytes: Buffer, hips: string) => Promise<{ bytes: number }>) => Promise<void>) {
  const cache = await mkdtemp(join(tmpdir(), 'sky-bands-'));
  try {
    await run(cache, async (bytes, hips) => {
      await mkdir(join(cache, 'hips2fits'), { recursive: true }); await writeFile(join(cache, 'hips2fits', `${sha(skyBandUrl(grid, hips))}.fits`), bytes);
      return { bytes: bytes.length };
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
  const composite = recipe([{ band: 'IRAC4', ...await place(red, 'CDS/P/SPITZER/IRAC4') }, { band: 'IRAC2', ...await place(green, 'CDS/P/SPITZER/IRAC2') }, { band: 'IRAC1', ...await place(blue, 'CDS/P/SPITZER/IRAC1') }]);
  const result = await composeSkyBands(composite, { input: noInput, cache });
  assert.deepEqual(result.wcs, { projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: [16, 16], referencePixel: [8, 8],
    referenceValueDeg: [ra, dec], scaleDeg: wcs.scaleDeg, rotationDeg: 0 });
  assert.ok(Math.abs(result.evidence.bands[0]!.backgroundMJyPerSr! - 30 * 0.74) < 1e-4 && Math.abs(result.evidence.bands[0]!.peakMJyPerSr! - 32 * 0.74) < 1e-4);
  // FITS row 0 is the bottom raster row; the top raster row is FITS row 15. IRAC4's knot is its own peak: 1.
  const expected = encodeAsinhBands(new Float32Array([1, 0, 0]), new Uint8Array(1), composite.display);
  assert.deepEqual([...result.rgb.subarray(((height - 1) * width + 3) * 3, ((height - 1) * width + 4) * 3)], [...expected]);
  assert.ok(result.rgb[1] === 0 && result.rgb[2]! > 0, 'Top raster row takes blue from the last FITS row.');
  assert.equal(result.missingPixels, 0);
  assert.equal(new URL(skyBandUrl(grid, 'CDS/P/SPITZER/IRAC4')).searchParams.get('hips'), 'CDS/P/SPITZER/IRAC4');
  const w4 = SKY_BANDS.W4!.toMJyPerSr, w1 = SKY_BANDS.W1!.toMJyPerSr;
  assert.ok(w4 !== null && w1 !== null, 'WISE atlas bands carry their own surface-brightness conversion.');
  assert.ok(Math.abs(w4 - 1.17622) < 1e-4 && Math.abs(w1 - 0.043544) < 1e-5, 'Explanatory Supplement Jy/DN over a 1.375 arcsec pixel');
}));

test('missing coverage stays black and every grid, identity, acquisition and pin mismatch refuses', () => withCache(async (cache, place) => {
  const band = hips2fits('CDS/P/SPITZER/IRAC4', (x, row) => x === 0 && row === 0 ? NaN : x === 5 ? 9 : 5);
  const mono = recipe([{ band: 'IRAC4', ...await place(band, 'CDS/P/SPITZER/IRAC4') }], { minimum: -1, stretch: 10, softening: 4 });
  const result = await composeSkyBands(mono, { input: noInput, cache });
  assert.equal(result.missingPixels, 1);
  assert.deepEqual([...result.rgb.subarray((height - 1) * width * 3, (height - 1) * width * 3 + 3)], [0, 0, 0]);
  assert.ok(result.rgb[0] === result.rgb[1] && result.rgb[1] === result.rgb[2] && result.rgb[0]! > 0, 'One band is monochrome.');
  const refuse = async (bytes: Buffer, pattern: RegExp) =>
    assert.rejects(composeSkyBands(recipe([{ band: 'IRAC4', ...await place(bytes, 'CDS/P/SPITZER/IRAC4') }]), { input: noInput, cache }), pattern);
  await refuse(hips2fits('CDS/P/SPITZER/IRAC1', () => 5), /does not name/);
  await refuse(hips2fits('CDS/P/SPITZER/IRAC4', () => 5, [card('PC1_2', '0.1')]), /rotation/);
  await refuse(hips2fits('CDS/P/SPITZER/IRAC4', () => 5), /no signal/);
  // WISE HiPS carry per-tile levels: WISE bands are refused as hips2fits inputs and need atlas tile lists.
  assert.throws(() => recipe([{ band: 'W4', bytes: 4000 }]), /Unsupported sky band or acquisition/);
  assert.throws(() => recipe([{ band: 'J', bytes: 4000 }]), /Unsupported/);
  assert.throws(() => parseSkyBandComposite({ schema: 'cssearth-sky-band-composite@1', grid, backgroundPercentile: 5, peakPercentile: 100,
    bands: [{ band: 'IRAC4', bytes: 4000 }], display: { minimum: 0, stretch: 1, softening: 8 }, gains: [1] }), /Unsupported/);
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
      tiles: tiles.map((bytes, i) => ({ coaddId: `056${4 + i}p242_ac51`, bytes: bytes.length })) }));
    for (const [i, bytes] of tiles.entries()) await writeFile(join(cache, 'wise-atlas', `056${4 + i}p242_ac51-w4-int-3.fits.gz`), bytes);
    const composite = parseSkyBandComposite({ schema: 'cssearth-sky-band-composite@1', grid, backgroundPercentile: 5, peakPercentile: 100,
      bands: [{ band: 'W4', tiles: { path: 'src/objects/m45/source/wise-atlas/w4.json' } }], display: { minimum: 0, stretch: 1, softening: 8 } });
    const listPath = 'src/objects/m45/source/wise-atlas/w4.json';
    const result = await composeSkyBands(composite, { input: async path => { assert.equal(path, listPath); return pinsList; }, cache });
    const acquisition = result.evidence.bands[0]!.acquisition as { kind: string; backgroundMatching: { medianOverlapStepDnBefore: number; medianOverlapStepDnAfter: number } };
    assert.equal(acquisition.kind, 'wise-atlas');
    assert.ok(Math.abs(Math.abs(acquisition.backgroundMatching.medianOverlapStepDnBefore) - 30) < 1e-3, JSON.stringify(acquisition.backgroundMatching));
    assert.ok(acquisition.backgroundMatching.medianOverlapStepDnAfter < 1e-6);
    await assert.rejects(composeSkyBands(composite, { input: async () => Buffer.from('{}'), cache }), /Unsupported WISE atlas tile list/);
  } finally { await rm(cache, { recursive: true, force: true }); }
});

test('recipe verification reads the recipe and every tile list, and composites are cached under their own hash', async () => {
  const list = Buffer.from(JSON.stringify({ schema: 'cssearth-wise-atlas-tiles@1', band: 'W4', tiles: [{ coaddId: '0564p242_ac51', bytes: 10 }] }));
  const recipe = Buffer.from(JSON.stringify({ schema: 'cssearth-sky-band-composite@1', grid, backgroundPercentile: 1, peakPercentile: 99.9,
    bands: [{ band: 'W4', tiles: { path: 'src/objects/x/w4.json' } }], display: { minimum: 0, stretch: 1, softening: 8 } }));
  const files = new Map([['src/objects/x/recipe.json', recipe], ['src/objects/x/w4.json', list]]);
  const input = async (path: string) => { const bytes = files.get(path); if (!bytes) throw new Error(`missing ${path}`); return bytes; };
  const pin = { path: 'src/objects/x/recipe.json' };
  assert.deepEqual((await verifySkyBandRecipe(pin, input)).files.map(file => file.path), ['src/objects/x/recipe.json', 'src/objects/x/w4.json']);
  files.delete('src/objects/x/w4.json');
  await assert.rejects(verifySkyBandRecipe(pin, input), /missing/);
});

test('uncalibrated plate and Herschel routes keep relative units, two bands take a mean green, and no-coverage NaN stays missing', () => withCache(async (cache, place) => {
  for (const id of ['DSS2B', 'DSS2R', 'PACS100', 'PACS160', 'SPIRE250']) assert.equal(SKY_BANDS[id]!.toMJyPerSr, null, `${id} claims no flux calibration`);
  assert.equal((SKY_BANDS.SPIRE250!.acquisition as { hips: string }).hips, 'ESAVO/P/HERSCHEL/SPIRE-250');
  assert.equal((SKY_BANDS.DSS2B!.acquisition as { hips: string }).hips, 'CDS/P/DSS2/blue');
  // Plate values: a red knot at (2, 0) and a blue knot at (9, 9); Herschel-like NaN where the survey has no footprint.
  const red = hips2fits('CDS/P/DSS2/red', (x, row) => 4000 + (x === 2 && row === 0 ? 3000 : 0) + (x === 9 && row === 9 ? 100 : 0));
  const blue = hips2fits('CDS/P/DSS2/blue', (x, row) => x > 13 ? NaN : 6000 + (x === 9 && row === 9 ? 3000 : 0));
  const composite = recipe([{ band: 'DSS2R', ...await place(red, 'CDS/P/DSS2/red') }, { band: 'DSS2B', ...await place(blue, 'CDS/P/DSS2/blue') }], { minimum: 0, stretch: 1, softening: 8 });
  const result = await composeSkyBands(composite, { input: noInput, cache });
  const band = result.evidence.bands[1]!;
  assert.ok(band.backgroundSourceUnits === 6000 && band.peakSourceUnits === 9000 && band.backgroundMJyPerSr === undefined, JSON.stringify(band));
  assert.equal(band.missingPixels, 2 * height);
  assert.equal(result.missingPixels, 2 * height, 'NaN is no coverage, never a zero-valued measurement');
  const at = (x: number, row: number) => [...result.rgb.subarray(((height - 1 - row) * width + x) * 3, ((height - 1 - row) * width + x + 1) * 3)];
  assert.deepEqual(at(15, 3), [0, 0, 0]);
  const [r, g, b] = at(2, 0) as [number, number, number], [r2, g2, b2] = at(9, 9) as [number, number, number];
  assert.ok(r > g && g > b && b === 0, `red plate knot ${[r, g, b]}`);
  assert.ok(b2 > g2 && g2 > r2, `blue plate knot ${[r2, g2, b2]}`);
  assert.deepEqual(at(2, 0), [...encodeAsinhBands(new Float32Array([1, 0]), new Uint8Array(1), composite.display)]);
  assert.match(JSON.stringify(result.evidence.display), /mean/);
}));

/** A small JWST-like level-3 product: a data-less primary naming the instrument, then a rotated TAN SCI image in MJy/sr. */
function i2d(filter: string, pupil: string, value: (eastArcsec: number, northArcsec: number) => number, hole?: [number, number]) {
  const size = 96, scaleDeg = 1 / 3600, rotation = 30 * Math.PI / 180;
  const block = (cards: string[]) => Buffer.from([...cards, 'END'.padEnd(80)].join('').padEnd(Math.ceil((cards.length + 1) * 80 / 2880) * 2880));
  const primary = block([card('SIMPLE', 'T'), card('BITPIX', '8'), card('NAXIS', '0'), card('EXTEND', 'T'), card('TELESCOP', "'JWST'"),
    card('INSTRUME', "'NIRCAM'"), card('FILTER', `'${filter}'`), card('PUPIL', `'${pupil}'`), card('PROGRAM', "'02733'")]);
  // East-left, north-up turned by 30 degrees: intermediate x (east) = -s cos r * dx - s sin r * dy, y (north) = -s sin r * dx + s cos r * dy.
  const pc = [-Math.cos(rotation), -Math.sin(rotation), -Math.sin(rotation), Math.cos(rotation)];
  const sci = block([card('XTENSION', "'IMAGE'"), card('BITPIX', '-32'), card('NAXIS', '2'), card('NAXIS1', String(size)), card('NAXIS2', String(size)),
    card('PCOUNT', '0'), card('GCOUNT', '1'), card('EXTNAME', "'SCI'"), card('BUNIT', "'MJy/sr'"), card('RADESYS', "'ICRS'"),
    card('CTYPE1', "'RA---TAN'"), card('CTYPE2', "'DEC--TAN'"), card('CUNIT1', "'deg'"), card('CUNIT2', "'deg'"),
    card('CRPIX1', String((size + 1) / 2)), card('CRPIX2', String((size + 1) / 2)), card('CRVAL1', String(ra)), card('CRVAL2', String(dec)),
    card('CDELT1', String(scaleDeg)), card('CDELT2', String(scaleDeg)),
    card('PC1_1', String(pc[0])), card('PC1_2', String(pc[1])), card('PC2_1', String(pc[2])), card('PC2_2', String(pc[3]))]);
  const data = Buffer.alloc(Math.ceil(size * size * 4 / 2880) * 2880);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x + 1 - (size + 1) / 2, dy = y + 1 - (size + 1) / 2;
    const east = (pc[0]! * dx + pc[1]! * dy) * 3600 * scaleDeg, north = (pc[2]! * dx + pc[3]! * dy) * 3600 * scaleDeg;
    const inHole = hole && Math.hypot(east - hole[0], north - hole[1]) < 6;
    data.writeFloatBE(inHole ? NaN : value(east, north), (y * size + x) * 4);
  }
  return Buffer.concat([primary, sci, data]);
}
async function withMast(bytes: Buffer, run: (cache: string, input: { bytes: number }) => Promise<void>) {
  const cache = await mkdtemp(join(tmpdir(), 'sky-bands-mast-'));
  try {
    await mkdir(join(cache, 'mast'), { recursive: true }); await writeFile(join(cache, 'mast', product), bytes);
    await run(cache, { bytes: bytes.length });
  } finally { await rm(cache, { recursive: true, force: true }); }
}
const product = 'jw02733-o001_t001_nircam_clear-f187n_i2d.fits';

test('a JWST level-3 mosaic is resampled onto the grid east-left and north-up, with its holes missing', () =>
  withMast(i2d('F187N', 'CLEAR', east => 100 + 10 * east, [20, 20]), async (cache, pin) => {
    const composed = await composeSkyBands(parseSkyBandComposite({ schema: 'cssearth-sky-band-composite@1', grid, coverage: 'alpha',
      bands: [{ band: 'NIRCAM-F187N', product, ...pin }], backgroundPercentile: 5, peakPercentile: 100, display: { minimum: 0, stretch: 2, softening: 8 } }),
    { input: noInput, cache });
    const band = composed.evidence.bands[0]!;
    assert.equal(band.acquisition.kind, 'mast-product');
    assert.equal(band.toMJyPerSr, 1);
    const red = (x: number, y: number) => composed.rgb[(y * width + x) * 4]!, covered = (x: number, y: number) => composed.rgb[(y * width + x) * 4 + 3] === 255;
    // The value rises to the east, and east is the left of the display grid.
    assert.ok(red(1, 12) > red(8, 12), `east-left: ${red(1, 12)} vs ${red(8, 12)}`);
    // The hole 20 arcsec east and 20 arcsec north of centre is missing, upper left on 3.6 arcsec pixels; its mirror images are not.
    assert.equal(covered(2, 2), false);
    for (const [x, y] of [[13, 2], [2, 13], [13, 13]] as const) assert.equal(covered(x, y), true, `${x}, ${y} is covered`);
    assert.ok(composed.missingPixels > 0 && composed.missingPixels < 20, `missing ${composed.missingPixels}`);
  }));

test('a JWST product for another filter, or changed bytes, is refused', async () => {
  await withMast(i2d('F212N', 'CLEAR', () => 1), (cache, pin) =>
    assert.rejects(composeSkyBands(recipe([{ band: 'NIRCAM-F187N', product, ...pin }]), { input: noInput, cache }), /not a NIRCAM F187N\/CLEAR product/u));
  await withMast(i2d('F187N', 'CLEAR', () => 1), async (cache, pin) => {
    await writeFile(join(cache, 'mast', product), Buffer.alloc(pin.bytes + 1));
    await assert.rejects(composeSkyBands(recipe([{ band: 'NIRCAM-F187N', product, ...pin }]), { input: noInput, cache }), /Changed sky band input/u);
  });
  assert.throws(() => recipe([{ band: 'NIRCAM-F187N', product: 'not-a-product.fits', bytes: 5760 }]), /level-3 i2d/u);
});

test('the planes a volume reads are each band divided by its own measured range, before any display', () =>
  withMast(i2d('F187N', 'CLEAR', east => 100 + 10 * east), async (cache, pin) => {
    const planes = await composeSkyBandPlanes(recipe([{ band: 'NIRCAM-F187N', product, ...pin }]), { input: noInput, cache });
    const finite = Array.from(planes.values).filter((_, p) => !planes.missing[p]).sort((a, b) => a - b);
    assert.ok(Math.abs(finite[Math.floor(0.05 * (finite.length - 1))]!) < 1e-6, 'the background percentile maps to 0');
    assert.ok(Math.abs(finite.at(-1)! - 1) < 1e-6, 'the peak percentile maps to 1');
  }));
