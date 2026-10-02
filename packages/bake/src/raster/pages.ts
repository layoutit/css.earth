import { outputName } from './io.ts';

/** Chromium refuses to decode one image of more than 64 MP (256 MB of RGBA). Measured in headless Chromium on
 * 2026-09-24: a 14336 × 4000 WebP decodes and a 14336 × 5000 one fails, as do Triton's 157 MP and Charon's 125 MP
 * atlases, whose pages then never became ready. A packed atlas over this limit is published as pages. */
export const RASTER_DECODE_LIMIT_PIXELS = 64 * 2 ** 20;
/** A packed atlas over this is published as pages with levels even though it decodes whole: an arrival waits for the
 * surface its view needs, and without levels a phone waits for a desktop's pixels. On the live site at 4 Mbps the Moon's
 * 51 MP atlas (9.4 MB) held its arrival for 21.5 s (2026-10-02). Nineteen bodies exceed it, at 12.8 MP and up; the other
 * 3,494 raster bodies are 3.2 MP, where a 267-pixel phone silhouette already takes the full level. */
export const RASTER_LEVEL_LIMIT_PIXELS = 8 * 2 ** 20;
/** One page holds whole latitude bands and at most a quarter of the decode limit: the images of one page share a
 * decode budget of about the same 64 MP (the same run: a fifth 16 MP page failed until the first was evicted). */
export const RASTER_PAGE_PIXELS = 16 * 2 ** 20;
/** Each page is also published reduced by these factors, smallest first, so a small silhouette decodes a small level;
 * a level is chosen while it still gives the canonical density of texels per CSS pixel at the silhouette's centre. A
 * body publishes the ones that divide its pages: Miranda's 6500 × 2400 page reduces by 4, not by 8. */
export const RASTER_LEVEL_FACTORS = [8, 4, 2, 1] as const;
/** The share of a threshold a silhouette must cross back before the level changes again: Earth's texture levels' value. */
export const RASTER_LEVEL_HYSTERESIS = 0.2;

export interface RasterPageRecipe {
  width: number; height: number; latitudeBands: number;
  surfaces: readonly { id: string; output: string; resolutionScale?: number }[];
}
export interface RasterPagePlan {
  bandsPerPage: number; pageCount: number;
  /** The reductions every page of this body is published at, smallest image first; the last is 1, the page itself. */
  reductions: readonly number[];
  /** The levels a silhouette steps through, smallest first: how far each reduces a scale-1 surface. A surface drawn at
   * `resolutionScale` 2 or 4 carries that many more texels, so the list goes on below 1 (0.5, 0.25) until such a
   * surface shows its full pages. */
  levelFactors: readonly number[];
  /** Silhouette diameters in CSS pixels from which each level (same order as `levelFactors`) is chosen. */
  levelDiameters: readonly number[];
  /** Each surface's full atlas file, the size of one of its full-resolution pages, and the reduction (one of
   * `reductions`) it shows at each level. */
  surfaces: readonly { name: string; width: number; pageRows: number; levelReductions: readonly number[] }[];
}

/** The packed atlas of one surface: its map at `density` and `scale`, each band with a gutter of a quarter band above
 * and below (surfaces.ts packs it this way on both of its routes). */
export function packedRasterSize(recipe: Pick<RasterPageRecipe, 'width' | 'height' | 'latitudeBands'>, density: number, scale = 1) {
  const width = recipe.width * density * scale, height = recipe.height * density * scale;
  const gutter = Math.max(2, height / recipe.latitudeBands / 4);
  return { width: width + 2 * gutter, height: height + 2 * gutter * recipe.latitudeBands, bandRows: height / recipe.latitudeBands + 2 * gutter };
}

/** Pages for a recipe whose largest surface is over the level limit, or null. Every surface of the body shares the
 * plan, so one leaf reads the same page of whichever dataset is shown. */
export function rasterPagePlan(recipe: RasterPageRecipe, density: number): RasterPagePlan | null {
  const scales = recipe.surfaces.map(surface => surface.resolutionScale ?? 1);
  if (!scales.length) return null;
  const largest = packedRasterSize(recipe, density, Math.max(...scales));
  if (largest.width * largest.height <= RASTER_LEVEL_LIMIT_PIXELS) return null;
  const bands = recipe.latitudeBands;
  const bandsPerPage = [...Array(bands).keys()].map(index => bands - index)
    .find(count => bands % count === 0 && largest.width * largest.bandRows * count <= RASTER_PAGE_PIXELS);
  if (!bandsPerPage) throw new RangeError(`A ${largest.width}-pixel-wide band of ${largest.bandRows} rows exceeds the ${RASTER_PAGE_PIXELS}-pixel page.`);
  const sizes = scales.map(scale => packedRasterSize(recipe, density, scale));
  const reductions = RASTER_LEVEL_FACTORS.filter(factor => sizes.every(size => size.width % factor === 0 && size.bandRows * bandsPerPage % factor === 0));
  // The map's equator is recipe.width × density texels at scale 1; at silhouette diameter D it spans π·D CSS pixels
  // at the centre of the disc. A level reduced by f keeps `density` texels per CSS pixel while D ≤ recipe.width / (π·f),
  // so the next level is chosen from there. A surface at scale 2 has twice the texels: at the level a scale-1 surface
  // shows whole it shows its half-size pages, and its full pages only from twice that diameter. Without this the Moon's
  // 267-pixel phone silhouette took 4160-pixel-wide pages, 2.5 MB, where 2080 pixels (0.66 MB) already give 2.4 texels
  // per CSS pixel (2026-10-02).
  // A surface at half scale has half the texels, so it shows a reduction one step finer than a scale-1 surface does:
  // Titan's and Iapetus's default datasets, at scale 0.25, took 520-pixel pages at a phone's 267 pixels, 0.6 texels per
  // CSS pixel, and were visibly soft (2026-10-02). Each surface shows the coarsest published reduction that still
  // gives the level's density: the largest one no greater than factor × scale.
  const smallest = reductions[0]!, finest = Math.min(1, 1 / 2 ** Math.floor(Math.log2(Math.max(...scales))));
  const levelFactors: number[] = [];
  for (let factor: number = smallest; factor >= finest; factor /= 2) levelFactors.push(factor);
  const levelDiameters = levelFactors.map((_factor, index) => index === 0 ? 0 : recipe.width / (Math.PI * levelFactors[index - 1]!));
  const surfaces = recipe.surfaces.map(surface => {
    const scale = surface.resolutionScale ?? 1, size = packedRasterSize(recipe, density, scale);
    return { name: outputName(surface.output, density, surface.id), width: size.width, pageRows: size.bandRows * bandsPerPage,
      levelReductions: levelFactors.map(factor => reductions.find(reduction => reduction <= factor * scale) ?? 1) };
  });
  return { bandsPerPage, pageCount: bands / bandsPerPage, reductions, levelFactors, levelDiameters, surfaces };
}

/** A page file (and its reduced level) beside the surface's full atlas: `<name>-page-<p>[-level-<width>].webp`. */
export function rasterPageName(fullName: string, page: number, levelWidth?: number): string {
  const match = /^(.*?)(?:@2x)?\.webp$/u.exec(fullName);
  if (!match) throw new TypeError(`A paged surface must be WebP: ${fullName}.`);
  return `${match[1]}-page-${page}${levelWidth === undefined ? '' : `-level-${levelWidth}`}.webp`;
}

export function rasterPageOutput(template: string, density: number, id: string, page: number, levelWidth?: number): string {
  return rasterPageName(outputName(template, density, id), page, levelWidth);
}
