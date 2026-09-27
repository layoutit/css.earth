import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import sharp from 'sharp';
import { fitsGalleryGreys, parseFitsGalleryImageRecipe, renderFitsGalleryImage } from './fits-gallery-image.mts';

const card = (key: string, value: string) => `${key.padEnd(8)}= ${value.padStart(20)}`.padEnd(80);
/** A 3 x 2 float image as the ALMA archive writes one: four axes, RA falling and Dec rising with the stored order. */
function skyFits(samples: readonly number[], unit = 'Jy/beam') {
  const cards = [card('SIMPLE', 'T'), card('BITPIX', '-32'), card('NAXIS', '4'), card('NAXIS1', '3'), card('NAXIS2', '2'), card('NAXIS3', '1'), card('NAXIS4', '1'),
    card('BUNIT', `'${unit.padEnd(8)}'`), card('CTYPE1', "'RA---SIN'"), card('CTYPE2', "'DEC--SIN'"), card('CRVAL1', '216.69'), card('CRVAL2', '15.53'),
    card('CDELT1', '-8.888888888889E-7'), card('CDELT2', '8.888888888889E-7'), 'END'.padEnd(80)];
  const header = Buffer.from(cards.join('').padEnd(2880), 'ascii'), data = Buffer.alloc(2880);
  samples.forEach((sample, index) => data.writeFloatBE(sample, index * 4));
  return Buffer.concat([header, data]);
}
const recipe = parseFitsGalleryImageRecipe({ window: { x: 1, y: 1, width: 3, height: 2 }, unit: 'Jy/beam', range: [0, 1], enlarge: 2 });

test('a window is drawn north up and east left, linear between the stated black and white, and clipped outside them', () => {
  // Stored rows run south to north; columns already run east to west.
  const { greys, width, height } = fitsGalleryGreys(skyFits([0, 0.5, 1, -3, 0.25, 9]), recipe);
  assert.deepEqual([width, height], [3, 2]);
  assert.deepEqual([...greys], [0, 64, 255, 0, 128, 255]);
});

test('each source pixel becomes a square of equal pixels in a lossless picture', async () => {
  const picture = await renderFitsGalleryImage(skyFits([0, 0.5, 1, 1, 0.5, 0]), recipe);
  assert.deepEqual([picture.width, picture.height], [6, 4]);
  const { data, info } = await sharp(picture.bytes).greyscale().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height, info.channels], [6, 4, 1]);
  assert.deepEqual([...data.subarray(0, 6)], [255, 255, 128, 128, 0, 0]);
  assert.deepEqual([...data.subarray(6, 12)], [255, 255, 128, 128, 0, 0]);
  assert.deepEqual([...data.subarray(12, 18)], [0, 0, 128, 128, 255, 255]);
});

test('a recipe for another unit, a window off the image, missing samples and malformed recipes are refused', () => {
  assert.throws(() => fitsGalleryGreys(skyFits([0, 0, 0, 0, 0, 0], 'K'), recipe), /unit changed/u);
  assert.throws(() => fitsGalleryGreys(skyFits([0, 0, 0, 0, 0, 0]), { ...recipe, window: { x: 2, y: 1, width: 3, height: 2 } }), /leaves the image/u);
  assert.throws(() => fitsGalleryGreys(skyFits([0, NaN, 0, 0, 0, 0]), recipe), /without a value/u);
  for (const bad of [null, {}, { ...recipe, enlarge: 0 }, { ...recipe, enlarge: 1.5 }, { ...recipe, unit: '' }, { ...recipe, range: [1, 1] }, { ...recipe, range: [0, Infinity] },
    { ...recipe, window: { x: 0, y: 1, width: 3, height: 2 } }, { ...recipe, window: { x: 1, y: 1, width: 1000, height: 2 }, enlarge: 8 }])
    assert.throws(() => parseFitsGalleryImageRecipe(bad), JSON.stringify(bad));
});

test("Haumea's recipe centres its window on the brightest pixel of the archive cutout and spans the noise to that peak", async () => {
  const object = resolve(import.meta.dirname, '../../../src/objects/haumea/source');
  const gallery = JSON.parse(await readFile(resolve(object, 'alma/gallery.json'), 'utf8')) as { items: { sourcePath: string; fits: unknown; width: number; height: number }[] };
  const item = gallery.items[0]!, haumea = parseFitsGalleryImageRecipe(item.fits);
  const { greys, width, height } = fitsGalleryGreys(await readFile(resolve(object, item.sourcePath)), haumea);
  assert.deepEqual([width * haumea.enlarge, height * haumea.enlarge], [item.width, item.height]);
  const brightest = greys.indexOf(255);
  assert.equal(greys.filter(grey => grey === 255).length, 1, 'only the peak reaches white');
  // The peak is on the 49th stored row and 49th column of the 96-pixel window, so 47 rows below the top once north is up.
  assert.deepEqual([brightest % width, Math.floor(brightest / width)], [48, 47]);
  assert.ok(greys.filter(grey => grey === 0).length < greys.length * 0.05, 'black sits below nearly all of the background');
});
