import assert from 'node:assert/strict';
import test from 'node:test';
import { RASTER_DECODE_LIMIT_PIXELS, RASTER_PAGE_PIXELS, packedRasterSize, rasterPageName, rasterPagePlan } from '../../../src/preparation/raster/pages.ts';

const surfaces = (scales: readonly number[]) => scales.map((resolutionScale, index) => ({ id: `lens-${index}`, output: 'body-{id}{suffix}.webp', resolutionScale }));

test('an atlas that decodes as one image is not paged', () => {
  // Callisto's recipe: a 51 MP packed atlas at 2x, under the 64 MP decode limit.
  const recipe = { width: 4096, height: 2048, latitudeBands: 16, surfaces: surfaces([1, 1, 1]) };
  const size = packedRasterSize(recipe, 2);
  assert.deepEqual(size, { width: 8320, height: 6144, bandRows: 384 });
  assert.ok(size.width * size.height <= RASTER_DECODE_LIMIT_PIXELS);
  assert.equal(rasterPagePlan(recipe, 2), null);
});

test('an atlas past the decode limit comes as pages of whole bands, each under the page budget', () => {
  // Triton's recipe: 14560 × 10752 packed at 2x, 157 MP. One band of 672 rows is 9.8 MP, two would pass 16 MP.
  const plan = rasterPagePlan({ width: 7168, height: 3584, latitudeBands: 16, surfaces: surfaces([1, 1]) }, 2)!;
  assert.equal(plan.bandsPerPage, 1);
  assert.equal(plan.pageCount, 16);
  assert.deepEqual(plan.surfaces[0], { name: 'body-lens-0@2x.webp', width: 14560, pageRows: 672 });
  assert.ok(14560 * 672 <= RASTER_PAGE_PIXELS && 14560 * 672 * 2 > RASTER_PAGE_PIXELS);
  // A level reduced by f keeps 2 texels per CSS pixel while the silhouette is at most 7168 / (π·f) pixels across.
  assert.deepEqual(plan.levelDiameters.map(value => Math.round(value)), [0, 285, 570, 1141]);
});

test('every lens of a paged body shares the band grouping, whatever its resolution', () => {
  // Charon: four full-resolution lenses and two at 0.32 share pages of two bands.
  const plan = rasterPagePlan({ width: 6400, height: 3200, latitudeBands: 16, surfaces: surfaces([1, 0.32]) }, 2)!;
  assert.equal(plan.bandsPerPage, 2);
  assert.deepEqual(plan.surfaces.map(({ width, pageRows }) => [width, pageRows]), [[13000, 1200], [4160, 384]]);
});

test('a page is named beside its atlas, and each level by its width', () => {
  assert.equal(rasterPageName('triton-normal@2x.webp', 3), 'triton-normal-page-3.webp');
  assert.equal(rasterPageName('triton-normal@2x.webp', 3, 1820), 'triton-normal-page-3-level-1820.webp');
  assert.throws(() => rasterPageName('triton-normal@2x.jpg', 0), /must be WebP/u);
});

test('a band that alone passes the page budget is refused with its size', () => {
  assert.throws(() => rasterPagePlan({ width: 20000, height: 10000, latitudeBands: 16, surfaces: surfaces([1]) }, 2),
    /40625-pixel-wide band of 1875 rows/u);
});
