import assert from 'node:assert/strict';
import test from 'node:test';
import { RASTER_DECODE_LIMIT_PIXELS, RASTER_LEVEL_LIMIT_PIXELS, RASTER_PAGE_PIXELS, packedRasterSize, rasterPageName, rasterPagePlan } from '@cssearth/bake/raster';

const surfaces = (scales: readonly number[]) => scales.map((resolutionScale, index) => ({ id: `dataset-${index}`, output: 'body-{id}{suffix}.webp', resolutionScale }));

test('an atlas at or under the level limit is one image; a larger one is paged with levels though it would decode whole', () => {
  // The 3,494 small recipes: 2176 × 1472 packed at 2x, 3.2 MP.
  assert.equal(rasterPagePlan({ width: 1024, height: 512, latitudeBands: 16, surfaces: surfaces([1]) }, 2), null);
  // Mars: 4160 × 3072, 12.8 MP. One page of every band, with levels: a phone no longer waits for the full map.
  const mars = rasterPagePlan({ width: 2048, height: 1024, latitudeBands: 16, surfaces: surfaces([1, 1]) }, 2)!;
  assert.ok(4160 * 3072 > RASTER_LEVEL_LIMIT_PIXELS && 4160 * 3072 <= RASTER_PAGE_PIXELS);
  assert.deepEqual([mars.bandsPerPage, mars.pageCount], [16, 1]);
  assert.deepEqual(mars.reductions, [8, 4, 2, 1]);
  assert.deepEqual(mars.levelDiameters.map(value => Math.round(value)), [0, 81, 163, 326]);
  assert.deepEqual(mars.surfaces[0]!.levelReductions, [8, 4, 2, 1]);
  // Callisto: an 8320 × 6144 atlas, 51 MP, under the 64 MP decode limit and over the level limit: four pages of four bands.
  const recipe = { width: 4096, height: 2048, latitudeBands: 16, surfaces: surfaces([1, 1, 1]) };
  const size = packedRasterSize(recipe, 2);
  assert.deepEqual(size, { width: 8320, height: 6144, bandRows: 384 });
  assert.ok(size.width * size.height <= RASTER_DECODE_LIMIT_PIXELS);
  const callisto = rasterPagePlan(recipe, 2)!;
  assert.deepEqual([callisto.bandsPerPage, callisto.pageCount], [4, 4]);
});

test('a surface at resolution scale 2 or 4 steps that many reductions behind, and shows its full pages last', () => {
  // The Moon: Callisto's atlas from a 2048-wide recipe at scale 2, beside scale-1 datasets.
  const moon = rasterPagePlan({ width: 2048, height: 1024, latitudeBands: 16, surfaces: surfaces([2, 1]) }, 2)!;
  assert.deepEqual(moon.surfaces.map(({ width, pageRows }) => [width, pageRows]), [[8320, 1536], [4160, 768]]);
  assert.deepEqual(moon.levelFactors, [8, 4, 2, 1, 0.5]);
  assert.deepEqual(moon.levelDiameters.map(value => Math.round(value)), [0, 81, 163, 326, 652]);
  assert.deepEqual(moon.surfaces.map(surface => surface.levelReductions), [[8, 8, 4, 2, 1], [8, 4, 2, 1, 1]]);
  // Venus: a 1024-wide recipe at scale 4.
  assert.deepEqual(rasterPagePlan({ width: 1024, height: 512, latitudeBands: 16, surfaces: surfaces([4]) }, 2)!.surfaces[0]!.levelReductions, [8, 8, 8, 4, 2, 1]);
  // Titan: its default dataset is at scale 0.25, so it shows a reduction two steps finer and its own full pages from 163 pixels.
  const titan = rasterPagePlan({ width: 4096, height: 2048, latitudeBands: 16, surfaces: surfaces([1, 0.25]) }, 2)!;
  assert.deepEqual(titan.levelDiameters.map(value => Math.round(value)), [0, 163, 326, 652]);
  assert.deepEqual(titan.surfaces.map(surface => surface.levelReductions), [[8, 4, 2, 1], [2, 1, 1, 1]]);
  // Charon's 0.32 datasets fall between two reductions and take the finer one.
  assert.deepEqual(rasterPagePlan({ width: 6400, height: 3200, latitudeBands: 16, surfaces: surfaces([1, 0.32]) }, 2)!.surfaces.map(surface => surface.levelReductions),
    [[8, 4, 2, 1], [2, 1, 1, 1]]);
});

test('a body publishes the reductions that divide its pages', () => {
  // Miranda: a 6500 × 2400 page reduces by 4 and not by 8, so its smallest level is a quarter.
  const miranda = rasterPagePlan({ width: 3200, height: 1600, latitudeBands: 16, surfaces: surfaces([1, 1]) }, 2)!;
  assert.deepEqual([miranda.surfaces[0]!.width, miranda.surfaces[0]!.pageRows], [6500, 2400]);
  assert.deepEqual(miranda.reductions, [4, 2, 1]);
  assert.deepEqual(miranda.levelFactors, [4, 2, 1]);
  assert.deepEqual(miranda.levelDiameters.map(value => Math.round(value)), [0, 255, 509]);
  assert.deepEqual(miranda.surfaces[0]!.levelReductions, [4, 2, 1]);
});

test('an atlas past the decode limit comes as pages of whole bands, each under the page budget', () => {
  // Triton's recipe: 14560 × 10752 packed at 2x, 157 MP. One band of 672 rows is 9.8 MP, two would pass 16 MP.
  const plan = rasterPagePlan({ width: 7168, height: 3584, latitudeBands: 16, surfaces: surfaces([1, 1]) }, 2)!;
  assert.equal(plan.bandsPerPage, 1);
  assert.equal(plan.pageCount, 16);
  assert.deepEqual(plan.surfaces[0], { name: 'body-dataset-0@2x.webp', width: 14560, pageRows: 672, levelReductions: [8, 4, 2, 1] });
  assert.ok(14560 * 672 <= RASTER_PAGE_PIXELS && 14560 * 672 * 2 > RASTER_PAGE_PIXELS);
  // A level reduced by f keeps 2 texels per CSS pixel while the silhouette is at most 7168 / (π·f) pixels across.
  assert.deepEqual(plan.levelDiameters.map(value => Math.round(value)), [0, 285, 570, 1141]);
});

test('every dataset of a paged body shares the band grouping, whatever its resolution', () => {
  // Charon: four full-resolution datasets and two at 0.32 share pages of two bands.
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
