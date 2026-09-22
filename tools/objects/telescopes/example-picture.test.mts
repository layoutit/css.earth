import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';
import sharp from 'sharp';
import { binEventCounts, colourOf, displayOrder, examplePixels, northAndEastOnScreen, parseExampleRecipe, parseExampleRecipes, renderExamplePicture, stretchSample } from './example-picture.mts';

const base = {
  id: 'probe', telescope: 'Test', instrument: 'Test camera', title: 'A probe', target: 'Nothing', date: '2026-01-01',
  source: { kind: 'fits-image', path: 'probe.fits', extension: 0, plane: 1 },
  unit: 'K', window: { x: 1, y: 1, width: 3, height: 2 },
  orientation: { mode: 'first-row-bottom', note: 'The first stored row at the bottom.' },
  stretch: { kind: 'linear', black: 0, white: 1 }, colour: { kind: 'greys' }, enlarge: 2,
  product: { command: 'node tools/objects/probe.mts', definition: 'tools/objects/probe/programs/probe.json' },
  note: 'A probe.',
};
const recipe = parseExampleRecipe(base);
const window = (values: readonly number[], width = 3, height = 2, header = undefined as Record<string, unknown> | undefined) =>
  ({ values: Float64Array.from(values), width, height, header: header as never });

test('a recipe states everything a picture needs, and a malformed one is refused', () => {
  assert.equal(recipe.id, 'probe');
  assert.deepEqual(recipe.enlarge, [2, 2]);
  assert.equal(recipe.channels.length, 1);
  assert.deepEqual(parseExampleRecipe({ ...base, enlarge: [7, 3] }).enlarge, [7, 3]);
  assert.equal(recipe.producedIn, undefined);
  assert.equal(parseExampleRecipe({ ...base, producedIn: 'css.earth-probe' }).producedIn, 'css.earth-probe');
  for (const bad of [null, {}, { ...base, id: 'Probe' }, { ...base, enlarge: 0 }, { ...base, enlarge: 1.5 },
    { ...base, window: { x: 0, y: 1, width: 3, height: 2 } }, { ...base, window: { x: 1, y: 1, width: 2000, height: 2 }, enlarge: 4 },
    { ...base, stretch: { kind: 'linear', black: 1, white: 1 } }, { ...base, stretch: { kind: 'linear', black: 0, white: 1, softening: 1 } },
    { ...base, stretch: { kind: 'asinh', black: 0, white: 1 } }, { ...base, stretch: { kind: 'asinh', black: 0, white: 1, softening: 0 } },
    { ...base, orientation: { mode: 'sideways', note: 'n' } }, { ...base, source: { kind: 'jpeg', path: 'p' } },
    { ...base, colour: { kind: 'ramp', stops: [[0.2, '#000000'], [1, '#ffffff']] } },
    { ...base, colour: { kind: 'ramp', stops: [[0, '#000000'], [1, 'white']] } }, { ...base, enlarge: [2] }, { ...base, enlarge: [2, 0] },
    { ...base, product: { ...base.product, command: '' } }])
    assert.throws(() => parseExampleRecipe(bad), JSON.stringify(bad)?.slice(0, 120));
  assert.throws(() => parseExampleRecipes({ schema: 'other', examples: [base] }), /cssearth-telescope-examples@1/u);
  assert.throws(() => parseExampleRecipes({ schema: 'cssearth-telescope-examples@1', examples: [base, base] }), /ids repeat/u);
});

test('a linear stretch clips outside its range and an asinh one lifts the faint end, both in the image unit', () => {
  assert.deepEqual([-1, 0, 0.5, 1, 2].map(value => stretchSample(value, recipe.channels[0]!.stretch)), [0, 0, 0.5, 1, 1]);
  const asinh = parseExampleRecipe({ ...base, stretch: { kind: 'asinh', black: 0, white: 100, softening: 1 } }).channels[0]!.stretch;
  assert.deepEqual([0, 100].map(value => stretchSample(value, asinh)), [0, 1]);
  // asinh(1)/asinh(100) lifts a sample at one hundredth of the range to about a fifth of the way to white.
  assert.ok(Math.abs(stretchSample(1, asinh) - Math.asinh(1) / Math.asinh(100)) < 1e-12);
  assert.ok(stretchSample(1, asinh) > 0.16 && stretchSample(1, asinh) < 0.17);
  assert.ok(Number.isNaN(stretchSample(NaN, recipe.channels[0]!.stretch)));
});

test('greys and a stated ramp are interpolated in sRGB, and a missing sample needs a stated colour', () => {
  assert.deepEqual(colourOf(0.5, { kind: 'greys' }), [128, 128, 128]);
  const ramp = parseExampleRecipe({ ...base, colour: { kind: 'ramp', stops: [[0, '#000000'], [0.5, '#ff0000'], [1, '#ffffff']], missing: '#4a4a4a' } }).colour;
  assert.deepEqual(colourOf(0, ramp), [0, 0, 0]);
  assert.deepEqual(colourOf(0.25, ramp), [128, 0, 0]);
  assert.deepEqual(colourOf(0.5, ramp), [255, 0, 0]);
  assert.deepEqual(colourOf(0.75, ramp), [255, 128, 128]);
  assert.deepEqual(colourOf(NaN, ramp), [74, 74, 74]);
  assert.throws(() => colourOf(NaN, { kind: 'greys' }), /no value/u);
});

test('the stored rows are turned the way the recipe states, and a sky image by its own world coordinates', () => {
  const stored = [1, 2, 3, 4, 5, 6];
  assert.deepEqual([...displayOrder(window(stored), recipe)], [4, 5, 6, 1, 2, 3]);
  assert.deepEqual([...displayOrder(window(stored), parseExampleRecipe({ ...base, orientation: { mode: 'first-row-top', note: 'n' } }))], stored);
  // Right ascension falls with the column and declination rises with the row, so only the rows turn over.
  const sky = { CTYPE1: 'RA---SIN', CTYPE2: 'DEC--SIN', CRVAL1: 10, CRVAL2: 20, CDELT1: -1e-5, CDELT2: 1e-5 };
  assert.deepEqual([...displayOrder(window(stored, 3, 2, sky), parseExampleRecipe({ ...base, orientation: { mode: 'sky', note: 'n' } }))], [4, 5, 6, 1, 2, 3]);
  // A rotated image cannot be turned by flipping, so `sky` is refused and the picture must state the stored rows instead.
  const rotated = { CTYPE1: sky.CTYPE1, CTYPE2: sky.CTYPE2, CRVAL1: 10, CRVAL2: 20, CD1_1: 7e-6, CD1_2: 7e-6, CD2_1: 7e-6, CD2_2: -7e-6 };
  assert.throws(() => displayOrder(window(stored, 3, 2, rotated), parseExampleRecipe({ ...base, orientation: { mode: 'sky', note: 'n' } })), /rotated or skewed/u);
});

test('north and east on screen are measured from the gnomonic world coordinates, not asserted', () => {
  const close = (degrees: number, expected: number) => Math.abs((degrees - expected + 540) % 360 - 180) < 0.01;
  const north = { CTYPE1: 'RA---TAN', CTYPE2: 'DEC--TAN', CRVAL1: 10, CRVAL2: 20, CRPIX1: 1, CRPIX2: 1, CDELT1: -1e-4, CDELT2: 1e-4 };
  const bottom = northAndEastOnScreen(north, 'first-row-bottom', [10, 10]);
  assert.ok(close(bottom.northDegrees, 0) && close(bottom.eastDegrees, 270), JSON.stringify(bottom));
  // Drawn with its first row at the top the same image is upside down, so north points down; east, which is level, stays left.
  const top = northAndEastOnScreen(north, 'first-row-top', [10, 10]);
  assert.ok(close(top.northDegrees, 180) && close(top.eastDegrees, 270), JSON.stringify(top));
  // With the axes swapped, right ascension runs up the rows and declination across the columns: north points right and east up.
  const turned = { CTYPE1: north.CTYPE1, CTYPE2: north.CTYPE2, CRVAL1: 10, CRVAL2: 20, CRPIX1: 1, CRPIX2: 1, CD1_1: 0, CD1_2: 1e-4, CD2_1: 1e-4, CD2_2: 0 };
  const quarter = northAndEastOnScreen(turned, 'first-row-bottom', [10, 10]);
  assert.ok(close(quarter.northDegrees, 90) && close(quarter.eastDegrees, 0), JSON.stringify(quarter));
  assert.deepEqual(northAndEastOnScreen(north, 'sky', [10, 10]), { northDegrees: 0, eastDegrees: 270 });
});

test('a recipe for another unit is refused, so a picture cannot be drawn to the wrong scale', () => {
  assert.throws(() => examplePixels([window([0, 0, 0, 0, 0, 0], 3, 2, { BUNIT: 'MJy/sr' })], recipe), /BUNIT MJy\/sr; the recipe states K/u);
});

test('a sample may be drawn as a rectangle where the instrument samples are not square on the sky', async () => {
  const picture = await renderExamplePicture([window([0, 0.5, 1, 1, 0.5, 0])], parseExampleRecipe({ ...base, enlarge: [3, 1] }));
  assert.deepEqual([picture.width, picture.height], [9, 2]);
  const { data } = await sharp(picture.bytes).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.subarray(0, 27)].filter((_, index) => index % 3 === 0), [255, 255, 255, 128, 128, 128, 0, 0, 0]);
});

test('every source sample becomes a square of equal pixels in a lossless picture', async () => {
  const picture = await renderExamplePicture([window([0, 0.5, 1, 1, 0.5, 0])], recipe);
  assert.deepEqual([picture.width, picture.height], [6, 4]);
  const { data, info } = await sharp(picture.bytes).raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height, info.channels], [6, 4, 3]);
  const greys = (row: number) => [...data.subarray(row * 18, row * 18 + 18)].filter((_, index) => index % 3 === 0);
  assert.deepEqual(greys(0), [255, 255, 128, 128, 0, 0]);
  assert.deepEqual(greys(1), [255, 255, 128, 128, 0, 0]);
  assert.deepEqual(greys(2), [0, 0, 128, 128, 255, 255]);
});

test('three channels go straight into red, green and blue, each on its own stretch, and only on one grid', async () => {
  const channel = (unit: string, white: number) => ({ label: unit, source: base.source, unit, stretch: { kind: 'linear', black: 0, white } });
  const three = parseExampleRecipe({ ...base, source: undefined, unit: undefined, stretch: undefined,
    product: { command: base.product.command, definition: base.product.definition },
    channels: [channel('keV-soft', 10), channel('keV-medium', 4), channel('keV-hard', 2)],
    colour: { kind: 'channels', missing: '#4a4a4a' } });
  assert.deepEqual(three.channels.map(each => each.unit), ['keV-soft', 'keV-medium', 'keV-hard']);
  // The same stored value reads differently in each channel because each has its own limits: 5, 2 and 1 are all halfway.
  const grid = { NAXIS1: 3, NAXIS2: 2, CRVAL1: 10 };
  const { pixels } = examplePixels([window([5, 0, 10, 0, 0, 0], 3, 2, { ...grid, BUNIT: 'keV-soft' }),
    window([2, 0, 4, 0, 0, 0], 3, 2, { ...grid, BUNIT: 'keV-medium' }), window([1, 0, 2, 0, 0, 0], 3, 2, { ...grid, BUNIT: 'keV-hard' })], three);
  // The first stored row is drawn last, so the halfway samples land at the start of the second display row.
  assert.deepEqual([...pixels.subarray(9, 15)], [128, 128, 128, 0, 0, 0]);
  assert.deepEqual([...pixels.subarray(15, 18)], [255, 255, 255]);
  // A sample missing from any one channel takes the stated neutral grey.
  const { pixels: holed } = examplePixels([window([NaN, 0, 10, 0, 0, 0], 3, 2, { ...grid, BUNIT: 'keV-soft' }),
    window([2, 0, 4, 0, 0, 0], 3, 2, { ...grid, BUNIT: 'keV-medium' }), window([1, 0, 2, 0, 0, 0], 3, 2, { ...grid, BUNIT: 'keV-hard' })], three);
  assert.deepEqual([...holed.subarray(9, 12)], [74, 74, 74]);
  // Channels on different grids are refused rather than resampled onto one another.
  assert.throws(() => examplePixels([window([1, 1, 1, 1, 1, 1], 3, 2, { ...grid, BUNIT: 'keV-soft' }),
    window([1, 1, 1, 1, 1, 1], 3, 2, { ...grid, CRVAL1: 11, BUNIT: 'keV-medium' }), window([1, 1, 1, 1, 1, 1], 3, 2, { ...grid, BUNIT: 'keV-hard' })], three),
    /different grids: CRVAL1/u);
  // A recipe cannot state three channels and a grey scale, or two channels, or channels binned differently.
  assert.throws(() => parseExampleRecipe({ ...base, source: undefined, unit: undefined, stretch: undefined,
    product: { command: base.product.command, definition: base.product.definition },
    channels: [channel('a', 1), channel('b', 1), channel('c', 1)], colour: { kind: 'greys' } }), /draws them as channels/u);
  assert.throws(() => parseExampleRecipe({ ...base, source: undefined, unit: undefined, stretch: undefined,
    product: { command: base.product.command, definition: base.product.definition },
    channels: [channel('a', 1), channel('b', 1)], colour: { kind: 'channels', missing: '#4a4a4a' } }), /exactly three channels/u);
  const events = (limits: readonly [number, number], binPixels = 2) => ({ label: 'band', unit: 'counts per bin', stretch: { kind: 'linear', black: 0, white: 1 },
    source: { kind: 'fits-events', path: 'e.fits', columns: ['x', 'y'], binPixels, origin: [0, 0], size: [4, 4], band: { column: 'energy', limits } } });
  assert.throws(() => parseExampleRecipe({ ...base, source: undefined, unit: undefined, stretch: undefined,
    product: { command: base.product.command, definition: base.product.definition },
    channels: [events([1, 2]), events([2, 3]), events([3, 4], 4)], colour: { kind: 'channels', missing: '#4a4a4a' } }), /one set of bins/u);
});

test('events are counted into square bins, and events outside the grid are dropped', () => {
  const source = { kind: 'fits-events' as const, path: 'p', columns: ['x', 'y'] as const, binPixels: 10, origin: [100, 200] as const, size: [2, 2] as const, band: undefined };
  const x = Float64Array.from([100, 105, 109.9, 110, 100, 99, 300]);
  const y = Float64Array.from([200, 200, 200, 200, 215, 200, 200]);
  const counts = binEventCounts(x, y, source);
  assert.deepEqual([counts.width, counts.height], [2, 2]);
  // Three events in the first bin, one in the bin to its right, one in the bin above; one below the origin and one off the grid.
  assert.deepEqual([...counts.values], [3, 1, 1, 0]);
  assert.throws(() => binEventCounts(x, Float64Array.from([1]), source), /differ in length/u);
  // A stated band keeps only the events inside it: here the first bin loses the two events outside 1000 to 2000.
  const banded = { ...source, band: { column: 'energy', limits: [1000, 2000] as const } };
  const energy = Float64Array.from([1500, 500, 2500, 1200, 1800, 1500, 1500]);
  assert.deepEqual([...binEventCounts(x, y, banded, energy).values], [1, 1, 1, 0]);
});

test('every checked-in example states a product, a command and a pinned definition, and fits the documented picture', async () => {
  const examples = parseExampleRecipes(JSON.parse(await readFile(resolve(import.meta.dirname, 'examples.json'), 'utf8')));
  assert.ok(examples.length >= 10, 'one example for each telescope with a finished product');
  const telescopes = new Set(examples.map(example => example.telescope));
  for (const telescope of ['JWST', 'Hubble', 'ALMA', 'VLTI', 'VLT', 'Chandra', 'Spitzer', 'Keck II', 'Gemini South', 'Juno']) assert.ok(telescopes.has(telescope), telescope);
  for (const example of examples) {
    assert.ok(example.product.command.startsWith('node tools/objects/'), `${example.id} states the command that makes the product`);
    assert.ok(example.note.length > 20, `${example.id} says what the picture shows and does not show`);
    assert.ok(!/[—–]/u.test(`${example.title}${example.note}${example.orientation.note}`), `${example.id} uses plain punctuation`);
    assert.ok(example.window.width * example.enlarge[0] <= 900 && example.window.height * example.enlarge[1] <= 900, `${example.id} fits in 900 pixels`);
    // A sample with no value is drawn in a neutral grey, never in a colour that could be read as a measurement.
    if (example.colour.missing) assert.match(example.colour.missing, /^#(\w\w)\1\1$/u, `${example.id} draws missing samples in a neutral grey`);
  }
});
