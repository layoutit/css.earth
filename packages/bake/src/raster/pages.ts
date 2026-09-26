import { outputName } from './io.ts';

/** Chromium refuses to decode one image of more than 64 MP (256 MB of RGBA). Measured in headless Chromium on
 * 2026-09-24: a 14336 × 4000 WebP decodes and a 14336 × 5000 one fails, as do Triton's 157 MP and Charon's 125 MP
 * atlases, whose pages then never became ready. A packed atlas over this limit is published as pages. */
export const RASTER_DECODE_LIMIT_PIXELS = 64 * 2 ** 20;
/** One page holds whole latitude bands and at most a quarter of the decode limit: the images of one page share a
 * decode budget of about the same 64 MP (the same run: a fifth 16 MP page failed until the first was evicted). */
export const RASTER_PAGE_PIXELS = 16 * 2 ** 20;
/** Each page is also published reduced by these factors, smallest first, so a small silhouette decodes a small level;
 * a level is chosen while it still gives the canonical density of texels per CSS pixel at the silhouette's centre. */
export const RASTER_LEVEL_FACTORS = [8, 4, 2, 1] as const;
/** The share of a threshold a silhouette must cross back before the level changes again: Earth's texture levels' value. */
export const RASTER_LEVEL_HYSTERESIS = 0.2;

export interface RasterPageRecipe {
  width: number; height: number; latitudeBands: number;
  surfaces: readonly { id: string; output: string; resolutionScale?: number }[];
}
export interface RasterPagePlan {
  bandsPerPage: number; pageCount: number;
  /** Silhouette diameters in CSS pixels from which each level (same order as RASTER_LEVEL_FACTORS) is chosen. */
  levelDiameters: readonly number[];
  /** Each surface's full atlas file and the size of one of its full-resolution pages. */
  surfaces: readonly { name: string; width: number; pageRows: number }[];
}

/** The packed atlas of one surface: its map at `density` and `scale`, each band with a gutter of a quarter band above
 * and below (surfaces.ts packs it this way on both of its routes). */
export function packedRasterSize(recipe: Pick<RasterPageRecipe, 'width' | 'height' | 'latitudeBands'>, density: number, scale = 1) {
  const width = recipe.width * density * scale, height = recipe.height * density * scale;
  const gutter = Math.max(2, height / recipe.latitudeBands / 4);
  return { width: width + 2 * gutter, height: height + 2 * gutter * recipe.latitudeBands, bandRows: height / recipe.latitudeBands + 2 * gutter };
}

/** Pages for a recipe whose largest surface would not decode as one image, or null. Every surface of the body shares
 * the plan, so one leaf reads the same page of whichever lens is shown. */
export function rasterPagePlan(recipe: RasterPageRecipe, density: number): RasterPagePlan | null {
  const scales = recipe.surfaces.map(surface => surface.resolutionScale ?? 1);
  if (!scales.length) return null;
  const largest = packedRasterSize(recipe, density, Math.max(...scales));
  if (largest.width * largest.height <= RASTER_DECODE_LIMIT_PIXELS) return null;
  const bands = recipe.latitudeBands;
  const bandsPerPage = [...Array(bands).keys()].map(index => bands - index)
    .find(count => bands % count === 0 && largest.width * largest.bandRows * count <= RASTER_PAGE_PIXELS);
  if (!bandsPerPage) throw new RangeError(`A ${largest.width}-pixel-wide band of ${largest.bandRows} rows exceeds the ${RASTER_PAGE_PIXELS}-pixel page.`);
  for (const scale of scales) for (const factor of RASTER_LEVEL_FACTORS) {
    const size = packedRasterSize(recipe, density, scale);
    if (size.width % factor || size.bandRows * bandsPerPage % factor) {
      throw new RangeError(`A ${size.width} × ${size.bandRows * bandsPerPage} page (scale ${scale}) does not reduce by ${factor}.`);
    }
  }
  // The map's equator is recipe.width × density texels at scale 1; at silhouette diameter D it spans π·D CSS pixels
  // at the centre of the disc. A level reduced by f keeps `density` texels per CSS pixel while D ≤ recipe.width / (π·f),
  // so the next level is chosen from there.
  const levelDiameters = RASTER_LEVEL_FACTORS.map((_factor, index) => index === 0 ? 0
    : recipe.width / (Math.PI * RASTER_LEVEL_FACTORS[index - 1]!));
  const surfaces = recipe.surfaces.map(surface => {
    const size = packedRasterSize(recipe, density, surface.resolutionScale ?? 1);
    return { name: outputName(surface.output, density, surface.id), width: size.width, pageRows: size.bandRows * bandsPerPage };
  });
  return { bandsPerPage, pageCount: bands / bandsPerPage, levelDiameters, surfaces };
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
