import { isArray, isRecord } from '@cssearth/core';
import type {ProjectiveGeometry} from '@cssearth/bake/scene';
import type {RasterInfo} from '../observation/raster.mts';
export interface PagedRasterConfiguration {publicBase: string; geometry: {BODY_LONGITUDE_SEGMENTS: number};
  atlas: {density: number; gutter: number; pageSize: number; pageCells: number; sourceWidth: number};}
export interface PagedSurfacePresentation {packedRect: {x: number; y: number; width: number; height: number}; overscan: number;
  layout: {gutter: number; bands: readonly {y: number; height: number; packedY: number}[]};}
export interface PagedSurfaceRasterCell {
  index: number; size: number; density: number; reversed: boolean; perspectiveY: number; page: number; x: number; y: number;
  source: {x: number; southY: number; width: number; height: number}; layer: ReturnType<typeof prepareProjectiveTextureLayer>;
}
export interface PagedSurfaceRasterBakeCell {
  size: number; density: number; reversed: boolean; perspectiveY: number; page: number; x: number; y: number;
  source: {x: number; southY: number; width: number; height: number};
}
export interface PagedSurfaceRasterPlan {
  atlas: {pageSize: number; density: number; gutter: number; sourceWidth: number; sourceHeight?: number};
  cells: readonly PagedSurfaceRasterBakeCell[];
  pages: readonly {width: number; height: number}[];
}
export interface NativeDeepOceanFill {
  data: Uint8Array;
  /** Replacement weight, 0 to 255, on the same grid as the plain source. */
  weight: Uint8Array;
  width: number;
  height: number;
  channels: 3;
}
export interface NativePhotographicCloudComposite {
  data: Uint8Array;
  width: number;
  height: number;
  channels: 3;
  maximumAlpha: number;
  threshold: number;
  scale: number;
  color: readonly number[];
}
import { prepareProjectiveTextureLayer } from "@cssearth/bake/scene";

// One canonical 8K-source atlas. These are prepared pixels, not display-DPR
// choices. The shelf layout avoids allocating a largest-size tile for every
// latitude. Four transparent pixels separate all covered polygons.
export function createPagedSurfaceRaster(config: PagedRasterConfiguration) {
const SURFACE_ATLAS = config.atlas;
/** Earth's smallest texture level is 1/16 of the canonical width (512 of 8192), and the cutaway rasters its pages at a
 * quarter of the surface's size: a side divisible by 64 keeps every level of both whole pixels. */
const PAGE_SIDE_STEP = 64;
const IDENTITY = "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1";

function surfacePageUrls(name: string, pageCount: number, suffix = "") {
  return Array.from({ length: pageCount }, (_, page) =>
    `${config.publicBase}${name}${page ? `-page-${page}` : ""}${suffix}.webp`);
}

/** Neighbouring cells of one latitude row share a page, `pageCells` of them. Chrome decodes a whole image to draw any
 * part of it and never draws a face turned away, so a view decodes only the pages it shows. Latitude-band pages each
 * ran round the globe, so every view decoded all of them: 109 MP at Earth's closest level, decoded again after each
 * zoom because the set outgrew Chrome's decode cache. A page is square: its cells sit in a grid of ceil(√pageCells)
 * columns, sized to the block's largest cell. Widths picked from halvings of 8192 left strips such as 8192 × 688 whose
 * last third was empty (Earth: 17.9% of the atlas outside any cell, 2026-09-26). The side is a multiple of
 * PAGE_SIDE_STEP so every texture level halves a page to whole pixels. */
function layoutBlockPages(sizes: readonly number[]) {
  const { pageSize, gutter, pageCells } = SURFACE_ATLAS, row = config.geometry.BODY_LONGITUDE_SEGMENTS;
  if (!Number.isInteger(pageCells) || pageCells < 1 || row % pageCells)
    throw new Error(`${config.publicBase}: atlas.pageCells ${pageCells} must divide ${row} longitude cells.`);
  const blocks = new Map<number, number[]>();
  sizes.forEach((_, index) => {
    const block = Math.floor(index / row) * (row / pageCells) + Math.floor(index % row / pageCells);
    blocks.set(block, [...blocks.get(block) ?? [], index]);
  });
  const columns = Math.ceil(Math.sqrt(pageCells));
  const positions: {page: number; x: number; y: number}[] = [], pages: {width: number; height: number}[] = [];
  for (const [block, members] of [...blocks].sort((a, b) => a[0] - b[0])) {
    const stride = Math.max(...members.map(index => sizes[index]! + 2 * gutter));
    const side = Math.ceil(columns * stride / PAGE_SIDE_STEP) * PAGE_SIDE_STEP;
    if (side > pageSize) throw new Error(`${config.publicBase}: raster page block ${block} (cells ${members.join(',')}) needs a ${side} px page, over ${pageSize} px.`);
    const page = pages.length;
    pages.push({ width: side, height: side });
    members.forEach((index, slot) => { positions[index] = { page, x: slot % columns * stride + gutter, y: Math.floor(slot / columns) * stride + gutter }; });
  }
  return { positions, pages };
}

/** Without `sizes` the plan only measures: every cell sits on one provisional page, and the scene that names those
 * pages is discarded. With the measured sizes it lays out the block pages before any face names its page. */
function createSurfaceRasterPlan(sizes?: readonly number[]) {
  const cells: PagedSurfaceRasterCell[] = [];
  const blocks = sizes ? layoutBlockPages(sizes) : null;
  const pages: {width: number; height: number}[] = blocks ? blocks.pages : [{ width: SURFACE_ATLAS.pageSize, height: SURFACE_ATLAS.pageSize }];
  return {
    cells,
    pages,
    prepare(geometry: Pick<ProjectiveGeometry,"matrix"|"leafWidth"|"leafHeight">, presentation: PagedSurfacePresentation, index: number) {
      const matrix = String(geometry?.matrix).split(",").map(Number);
      if (matrix.length !== 16 || matrix.some(value => !Number.isFinite(value)) ||
          matrix[3] !== 0 || matrix[15] !== 1 || geometry.leafWidth !== 32 ||
          geometry.leafHeight !== 32 || !Number.isInteger(index) || index < 0 || index >= 448) {
        throw new Error("Paged ellipsoid surface geometry is incompatible with its raster plan.");
      }
      // Reverse both coordinates in northern trapezoids. Normalizing their
      // homogeneous matrix makes the residual warp expand, never compress,
      // the source cell; the finest source edge keeps its 256-pixel span.
      const reversed = matrix[7] > 0;
      if (reversed) {
        for (let row = 0; row < 4; row++) {
          matrix[12 + row] += 32 * (matrix[row] + matrix[4 + row]);
          matrix[row] *= -1;
          matrix[4 + row] *= -1;
        }
        const w = matrix[15];
        for (let i = 0; i < 16; i++) matrix[i] /= w;
      }
      const layer = prepareProjectiveTextureLayer(matrix.join(","));
      const p = matrix[7];
      if (!(1 + p * 32 > 0) || p > 0) throw new Error("Paged ellipsoid raster projection crosses infinity.");
      const { packedRect, layout, overscan } = presentation;
      if (!packedRect || !layout || !isArray(layout.bands) ||
          !Number.isFinite(overscan) || overscan < 0 || overscan > layout.gutter ||
          !Number.isFinite(layout.gutter) || layout.gutter <= 0 ||
          [packedRect.x, packedRect.y, packedRect.width, packedRect.height].some(value => !Number.isFinite(value)) ||
          packedRect.width <= 0 || packedRect.height <= 0 ||
          layout.bands.some(band => [band.y, band.height, band.packedY].some(value => !Number.isFinite(value)) ||
            band.y < 0 || band.height <= 0 || band.packedY < 0)) {
        throw new Error("Paged ellipsoid surface source presentation is invalid.");
      }
      const band = layout.bands.find(candidate => packedRect.y >= candidate.packedY &&
        packedRect.y < candidate.packedY + candidate.height);
      if (!band) throw new Error("Paged ellipsoid surface cell has no source latitude band.");
      const source = {
        x: packedRect.x - layout.gutter - overscan,
        southY: band.y + band.height - (packedRect.y - band.packedY - overscan),
        width: packedRect.width + 2 * overscan,
        height: packedRect.height + 2 * overscan,
      };
      // Bound the inverse warp's largest directional source step, including
      // shear and overscan. Its maximum occurs at the unexpanded far corner.
      // These per-latitude densities are baked together in ONE atlas; runtime
      // never chooses a density or changes banks in response to device DPR.
      // Cells take half the atlas density in texels per source-grid unit along their finest edge (4 at density 8).
      const a = source.width * (SURFACE_ATLAS.density / 2) / 32, d = source.height * (SURFACE_ATLAS.density / 2) / 32;
      const b = a * -p * 32;
      const trace = a * a + b * b + d * d;
      const sourceStep = Math.sqrt((trace + Math.sqrt(Math.max(0,
        trace * trace - 4 * a * a * d * d))) / 2);
      const density = Math.ceil(sourceStep);
      const size = Math.ceil(32 / (1 + p * 32) * density);
      const frameMatrix = layer.frameMatrix.split(",").map(Number);
      // Share one CSS background-size for the entire atlas. Otherwise Chrome
      // can prepare a separate huge resized image for each latitude density.
      for (const i of [0, 1, 2, 4, 5, 6]) frameMatrix[i] *= SURFACE_ATLAS.density / density;
      const facts = { index, size, density, reversed, perspectiveY: p, source,
        layer: { ...layer, frameMatrix: frameMatrix.join(","), textureMatrix: IDENTITY } };
      const existing = cells[index];
      if (existing) {
        const { x, y, page, ...previous } = existing;
        if (JSON.stringify(previous) !== JSON.stringify(facts)) {
          throw new Error("Paged ellipsoid cutaway and exterior surface geometry diverged.");
        }
        return existing;
      }
      if (index !== cells.length) throw new Error("Paged ellipsoid raster cells must be prepared in source order.");
      if (size + 2 * SURFACE_ATLAS.gutter > SURFACE_ATLAS.pageSize)
        throw new Error(`${config.publicBase}: raster cell ${index} (${size} px) exceeds the ${SURFACE_ATLAS.pageSize} px page.`);
      const position = blocks ? blocks.positions[index] : { page: 0, x: SURFACE_ATLAS.gutter, y: SURFACE_ATLAS.gutter };
      if (!position || (blocks && sizes?.[index] !== size))
        throw new Error(`${config.publicBase}: raster cell ${index} measured ${sizes?.[index]} px but prepared ${size} px.`);
      const cell = { ...facts, ...position };
      cells.push(cell);
      return cell;
    },
  };
}

// Bake the projective texture into RGBA, as in Pluto, so the browser only
// positions an affine rectangle. Pixels outside the trapezoid stay transparent
// instead of relying on Chrome to flatten a perspective-warped child.
function bakeSurfaceRaster(data: Uint8Array, { width, height, channels }: RasterInfo, plan: Pick<PagedSurfaceRasterPlan, 'cells' | 'pages'>, density = 8, page = 0,
  nativeClouds?: NativePhotographicCloudComposite, nativeDisplayGamma = 1, nativeOcean?: NativeDeepOceanFill) {
  if (channels !== 3 || !(height > 0) || data.length !== width * height * channels ||
      ![2, 4, 8, 16].includes(density) || width !== height * 2 ||
      (nativeClouds && (nativeClouds.channels !== 3 || nativeClouds.width !== nativeClouds.height * 2 ||
        nativeClouds.data.length !== nativeClouds.width * nativeClouds.height * nativeClouds.channels))) {
    throw new Error("Paged ellipsoid surface source dimensions do not match the prepared density.");
  }
  // The replacement is read on the plain grid, so it shares that grid exactly.
  if (nativeOcean && (nativeOcean.width !== width || nativeOcean.height !== height ||
      nativeOcean.data.length !== width * height * 3 || nativeOcean.weight.length !== width * height)) {
    throw new Error("Paged ellipsoid deep ocean fill replacement does not share the plain source grid.");
  }
  const { cells } = plan, pageWidth = plan.pages[page]?.width;
  if (!isArray(cells)) throw new Error("Paged ellipsoid raster cells are invalid.");
  const pageCells = cells.filter(cell => cell?.page === page);
  if (!Number.isInteger(page) || page < 0 || pageCells.length === 0 || !Number.isInteger(pageWidth) || !(pageWidth > 0))
    throw new Error(`Paged ellipsoid raster page ${page} is missing (width ${pageWidth}).`);
  if (pageCells.some(cell => !cell ||
      !Number.isInteger(cell.page) || cell.page < 0 ||
      !Number.isInteger(cell.x) || !Number.isInteger(cell.y) ||
      !Number.isInteger(cell.size) || cell.size <= 0 ||
      cell.x < SURFACE_ATLAS.gutter || cell.y < SURFACE_ATLAS.gutter ||
      cell.x + cell.size + SURFACE_ATLAS.gutter > pageWidth ||
      cell.y + cell.size + SURFACE_ATLAS.gutter > SURFACE_ATLAS.pageSize ||
      !Number.isFinite(cell.density) || cell.density <= 0 ||
      !Number.isFinite(cell.perspectiveY) || cell.perspectiveY > 0 ||
      1 + cell.perspectiveY * 32 <= 0 ||
      typeof cell.reversed !== "boolean" || !cell.source ||
      [cell.source.x, cell.source.southY, cell.source.width, cell.source.height]
        .some(value => !Number.isFinite(value)) ||
      cell.source.width <= 0 || cell.source.height <= 0)) {
    throw new Error("Paged ellipsoid raster cells are invalid.");
  }
  const atlasScale = density / SURFACE_ATLAS.density;
  const outputWidth = pageWidth * atlasScale;
  // A page is square (layoutBlockPages); its side is a multiple of PAGE_SIDE_STEP, so every level scales it to whole pixels.
  const outputHeight = plan.pages[page]!.height * atlasScale;
  const output = Buffer.alloc(outputWidth * outputHeight * 4);
  const scale = width / SURFACE_ATLAS.sourceWidth;
  const sourceSample = (raster: Uint8Array, rasterWidth: number, rasterHeight: number, rasterChannels: number,
    x: number, y: number, channel: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
    const at = (sx: number, sy: number) => raster[(Math.max(0, Math.min(rasterHeight - 1, sy)) * rasterWidth +
      ((sx % rasterWidth) + rasterWidth) % rasterWidth) * rasterChannels + channel];
    return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) +
      (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
  };
  const displaySample = (value: number) => nativeDisplayGamma === 1 ? value :
    Math.round(255 * (Math.round(value) / 255) ** (1 / nativeDisplayGamma));
  for (const cell of pageCells) {
    const cellDensity = cell.density * atlasScale;
    const left = Math.floor(cell.x * atlasScale), top = Math.floor(cell.y * atlasScale);
    const right = Math.ceil((cell.x + cell.size) * atlasScale);
    const bottom = Math.ceil((cell.y + cell.size) * atlasScale);
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const rgb = [0, 0, 0]; let count = 0;
      for (const dy of [0.25, 0.75]) for (const dx of [0.25, 0.75]) {
        const py = (y + dy - cell.y * atlasScale) / cellDensity;
        const denominator = 1 - cell.perspectiveY * py;
        let u = (x + dx - cell.x * atlasScale) / cellDensity / denominator;
        let v = py / denominator;
        if (u < 0 || v < 0 || u > 32 || v > 32) continue;
        if (cell.reversed) { u = 32 - u; v = 32 - v; }
        const sx = (cell.source.x + u / 32 * cell.source.width) * scale - 0.5;
        // Sample continuous original north-to-south rows, including adjacent
        // latitudes at boundaries. Do not reverse or clamp individual bands.
        const sy = (cell.source.southY - v / 32 * cell.source.height) * scale - 0.5;
        // Replace only what the plain edition invented, with a weight that is
        // already nothing at the edge of that region, then compose clouds.
        const oceanWeight = nativeOcean
          ? sourceSample(nativeOcean.weight, width, height, 1, sx, sy, 0) / 255 : 0;
        const baseSample = (channel: number) => {
          const plain = displaySample(sourceSample(data, width, height, channels, sx, sy, channel));
          if (oceanWeight <= 0) return plain;
          const replacement = sourceSample(nativeOcean!.data, width, height, 3, sx, sy, channel);
          return plain * (1 - oceanWeight) + replacement * oceanWeight;
        };
        if (nativeClouds) {
          const cloudX = (sx + .5) / width * nativeClouds.width - .5;
          const cloudY = (sy + .5) / height * nativeClouds.height - .5;
          const red = sourceSample(nativeClouds.data, nativeClouds.width, nativeClouds.height, nativeClouds.channels, cloudX, cloudY, 0);
          const green = sourceSample(nativeClouds.data, nativeClouds.width, nativeClouds.height, nativeClouds.channels, cloudX, cloudY, 1);
          const blue = sourceSample(nativeClouds.data, nativeClouds.width, nativeClouds.height, nativeClouds.channels, cloudX, cloudY, 2);
          const luminance = red * .2126 + green * .7152 + blue * .0722;
          const alpha = Math.max(0, Math.min(nativeClouds.maximumAlpha,
            (luminance - nativeClouds.threshold) / 255 * nativeClouds.scale));
          for (let channel = 0; channel < 3; channel++) rgb[channel] +=
            baseSample(channel) * (1 - alpha) + nativeClouds.color[channel] * alpha;
        } else for (let channel = 0; channel < 3; channel++) rgb[channel] += baseSample(channel);
        count++;
      }
      if (!count) continue;
      const target = (y * outputWidth + x) * 4;
      for (let channel = 0; channel < 3; channel++) output[target + channel] = Math.round(rgb[channel] / count);
      output[target + 3] = Math.round(count / 4 * 255);
    }
  }
  return { data: output, width: outputWidth, height: outputHeight, channels: 4 as const };
}

return { atlas: SURFACE_ATLAS, surfacePageUrls, layoutBlockPages, createSurfaceRasterPlan, bakeSurfaceRaster };
}

/** Parse a checked-in raster layout for a selective asset refresh without rebuilding geometry. */
export function parsePreparedSurfaceRasterPlan(input: unknown): PagedSurfaceRasterPlan {
  const finite=(value: unknown): value is number => typeof value==='number'&&Number.isFinite(value);
  const integer=(value: unknown): value is number => finite(value)&&Number.isInteger(value);
  const value=isRecord(input)?input:null,atlas=isRecord(value?.atlas)?value.atlas:null,cells=isArray(value?.cells)?value.cells:null,pages=isArray(value?.pages)?value.pages:null;
  const pageSize=atlas?.pageSize,density=atlas?.density,gutter=atlas?.gutter,sourceWidth=atlas?.sourceWidth,sourceHeight=atlas?.sourceHeight;
  if(!atlas||!cells?.length||!pages?.length||!integer(pageSize)||!integer(density)||!integer(gutter)||!integer(sourceWidth)||!integer(sourceHeight)||
    pageSize<=0||density<=0||gutter<0||sourceWidth<=0||sourceHeight<=0)throw new TypeError('Prepared surface raster plan is invalid.');
  const preparedPages=pages.map(page=>{const candidate=isRecord(page)?page:null,width=candidate?.width,height=candidate?.height;if(!candidate||!integer(width)||!integer(height)||width<=0||height<=0)throw new TypeError('Prepared surface raster page is invalid.');return {width,height};});
  const preparedCells=cells.map(cell=>{const candidate=isRecord(cell)?cell:null,source=isRecord(candidate?.source)?candidate.source:null;
    const size=candidate?.size,cellDensity=candidate?.density,perspectiveY=candidate?.perspectiveY,page=candidate?.page,x=candidate?.x,y=candidate?.y,reversed=candidate?.reversed;
    const sourceX=source?.x,southY=source?.southY,width=source?.width,height=source?.height;
    if(!candidate||!source||!finite(size)||!finite(cellDensity)||!finite(perspectiveY)||!finite(sourceX)||!finite(southY)||!finite(width)||!finite(height)||
      !integer(page)||!integer(x)||!integer(y)||typeof reversed!=='boolean'||size<=0||cellDensity<=0||width<=0||height<=0||page<0||page>=preparedPages.length||x<gutter||y<gutter)throw new TypeError('Prepared surface raster cell is invalid.');
    return {size,density:cellDensity,reversed,perspectiveY,page,x,y,source:{x:sourceX,southY,width,height}};
  });
  if(new Set(preparedCells.map(cell=>cell.page)).size!==preparedPages.length)throw new TypeError('Prepared surface raster page has no cells.');
  return {atlas:{pageSize,density,gutter,sourceWidth,sourceHeight},cells:preparedCells,pages:preparedPages};
}
