import { prepareProjectiveTextureLayer } from "../../../platform/projective-surface-raster.mjs";

// The accepted 8K-source encoding layout stays fixed. Deliver each shelf as an
// independent lossless strip so zooming cannot require a 16 MP image decode.
// Density, source sampling and the four-pixel gutters remain unchanged.
export const EARTH_SURFACE_ATLAS = Object.freeze({
  pageSize: 4096, density: 8, gutter: 4,
  maximumDeliveryHeight: 1024,
  sourceWidth: 2048, sourceHeight: 1024,
});
const IDENTITY = "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1";

export function earthSurfacePageUrls(name, pageCount, suffix = "") {
  return Array.from({ length: pageCount }, (_, page) =>
    `/scenes/earth/${name}${page ? `-page-${page}` : ""}${suffix}.webp`);
}

export function createEarthSurfaceRasterPlan() {
  const cells = [];
  const pages = [];
  const encodingPages = [], pageSources = [], shelves = new Map();
  let shelfX = 0, shelfY = 0, shelfHeight = 0;
  let page = 0;
  return {
    cells,
    pages,
    encodingPages,
    pageSources,
    prepare(geometry, presentation, index) {
      const matrix = String(geometry?.matrix).split(",").map(Number);
      if (matrix.length !== 16 || matrix.some(value => !Number.isFinite(value)) ||
          matrix[3] !== 0 || matrix[15] !== 1 || geometry.leafWidth !== 32 ||
          geometry.leafHeight !== 32 || !Number.isInteger(index) || index < 0 || index >= 448) {
        throw new Error("Earth surface geometry is incompatible with its raster plan.");
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
      if (!(1 + p * 32 > 0) || p > 0) throw new Error("Earth raster projection crosses infinity.");
      const { packedRect, layout, overscan } = presentation;
      if (!packedRect || !layout || !Array.isArray(layout.bands) ||
          !Number.isFinite(overscan) || overscan < 0 || overscan > layout.gutter ||
          !Number.isFinite(layout.gutter) || layout.gutter <= 0 ||
          [packedRect.x, packedRect.y, packedRect.width, packedRect.height].some(value => !Number.isFinite(value)) ||
          packedRect.width <= 0 || packedRect.height <= 0 ||
          layout.bands.some(band => [band.y, band.height, band.packedY].some(value => !Number.isFinite(value)) ||
            band.y < 0 || band.height <= 0 || band.packedY < 0)) {
        throw new Error("Earth surface source presentation is invalid.");
      }
      const band = layout.bands.find(candidate => packedRect.y >= candidate.packedY &&
        packedRect.y < candidate.packedY + candidate.height);
      if (!band) throw new Error("Earth surface cell has no source latitude band.");
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
      const a = source.width * 4 / 32, d = source.height * 4 / 32;
      const b = a * -p * 32;
      const trace = a * a + b * b + d * d;
      const sourceStep = Math.sqrt((trace + Math.sqrt(Math.max(0,
        trace * trace - 4 * a * a * d * d))) / 2);
      const density = Math.ceil(sourceStep);
      const size = Math.ceil(32 / (1 + p * 32) * density);
      const frameMatrix = layer.frameMatrix.split(",").map(Number);
      // Share one CSS background-size for the entire atlas. Otherwise Chrome
      // can prepare a separate huge resized image for each latitude density.
      for (const i of [0, 1, 2, 4, 5, 6]) frameMatrix[i] *= EARTH_SURFACE_ATLAS.density / density;
      const facts = { index, size, density, reversed, perspectiveY: p, source,
        layer: { ...layer, frameMatrix: frameMatrix.join(","), textureMatrix: IDENTITY } };
      const existing = cells[index];
      if (existing) {
        const { x, y, page, encoding, ...previous } = existing;
        if (JSON.stringify(previous) !== JSON.stringify(facts)) {
          throw new Error("Earth cutaway and exterior surface geometry diverged.");
        }
        return existing;
      }
      if (index !== cells.length) throw new Error("Earth raster cells must be prepared in source order.");
      const stride = size + 2 * EARTH_SURFACE_ATLAS.gutter;
      if (stride > EARTH_SURFACE_ATLAS.pageSize) throw new Error("Earth raster cell exceeds its page.");
      if (shelfX + stride > EARTH_SURFACE_ATLAS.pageSize) {
        shelfX = 0;
        shelfY += shelfHeight;
        shelfHeight = 0;
      }
      if (shelfY + stride > EARTH_SURFACE_ATLAS.pageSize) {
        page++;
        shelfX = 0;
        shelfY = 0;
        shelfHeight = 0;
      }
      const encoding = { page, x: shelfX + EARTH_SURFACE_ATLAS.gutter,
        y: shelfY + EARTH_SURFACE_ATLAS.gutter };
      const shelfKey = `${page}:${shelfY}`;
      if (!shelves.has(shelfKey)) {
        shelves.set(shelfKey, pages.length);
        pages.push({ width: EARTH_SURFACE_ATLAS.pageSize, height: 0 });
        // Four-pixel alignment preserves the exact texel phase in the source
        // and canonical cutaway densities as well as the full-density surface.
        pageSources.push({ page, top: Math.floor(shelfY / 4) * 4 });
      }
      const deliveryPage = shelves.get(shelfKey);
      const cell = { ...facts, page: deliveryPage, x: encoding.x,
        y: encoding.y - pageSources[deliveryPage].top, encoding };
      shelfX += stride;
      shelfHeight = Math.max(shelfHeight, stride);
      encodingPages[page] = { width: EARTH_SURFACE_ATLAS.pageSize,
        height: Math.ceil((shelfY + shelfHeight) / 4) * 4 };
      pages[deliveryPage].height = Math.max(pages[deliveryPage].height,
        Math.ceil((cell.y + cell.size + EARTH_SURFACE_ATLAS.gutter) / 4) * 4);
      cells.push(cell);
      return cell;
    },
  };
}

// Bake the projective texture into RGBA, as in Pluto, so the browser only
// positions an affine rectangle. Pixels outside the trapezoid stay transparent
// instead of relying on Chrome to flatten a perspective-warped child.
export function bakeEarthSurfaceRaster(data, { width, height, channels }, cells, density = 8, page = 0, sampling = "bilinear") {
  if (!(channels === 3 || sampling === "nearest" && channels === 4) || !["bilinear", "nearest"].includes(sampling) || data.length !== width * height * channels ||
      ![2, 4, 8].includes(density) || width !== 1024 * density || height !== 512 * density) {
    throw new Error("Earth surface source dimensions do not match the prepared density.");
  }
  if (!Array.isArray(cells)) throw new Error("Earth raster cells are invalid.");
  const pageCells = cells.filter(cell => cell?.page === page);
  if (!Number.isInteger(page) || page < 0 || pageCells.length === 0) throw new Error("Earth raster page is missing.");
  if (pageCells.some(cell => !cell ||
      !Number.isInteger(cell.page) || cell.page < 0 ||
      !Number.isInteger(cell.x) || !Number.isInteger(cell.y) ||
      !Number.isInteger(cell.size) || cell.size <= 0 ||
      cell.x < EARTH_SURFACE_ATLAS.gutter || cell.y < EARTH_SURFACE_ATLAS.gutter ||
      cell.x + cell.size + EARTH_SURFACE_ATLAS.gutter > EARTH_SURFACE_ATLAS.pageSize ||
      cell.y + cell.size + EARTH_SURFACE_ATLAS.gutter > EARTH_SURFACE_ATLAS.pageSize ||
      !Number.isFinite(cell.density) || cell.density <= 0 ||
      !Number.isFinite(cell.perspectiveY) || cell.perspectiveY > 0 ||
      1 + cell.perspectiveY * 32 <= 0 ||
      typeof cell.reversed !== "boolean" || !cell.source ||
      [cell.source.x, cell.source.southY, cell.source.width, cell.source.height]
        .some(value => !Number.isFinite(value)) ||
      cell.source.width <= 0 || cell.source.height <= 0)) {
    throw new Error("Earth raster cells are invalid.");
  }
  const atlasScale = density / EARTH_SURFACE_ATLAS.density;
  const outputWidth = EARTH_SURFACE_ATLAS.pageSize * atlasScale;
  const outputHeight = Math.ceil(Math.max(...pageCells.map(cell =>
    cell.y + cell.size + EARTH_SURFACE_ATLAS.gutter)) / 4) * 4 * atlasScale;
  const output = Buffer.alloc(outputWidth * outputHeight * 4);
  const scale = width / EARTH_SURFACE_ATLAS.sourceWidth;
  const sample = (x, y, channel) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
    const at = (sx, sy) => data[(Math.max(0, Math.min(height - 1, sy)) * width +
      ((sx % width) + width) % width) * channels + channel];
    if (sampling === "nearest") return at(Math.round(x), Math.round(y));
    return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) +
      (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
  };
  for (const cell of pageCells) {
    const cellDensity = cell.density * atlasScale;
    const left = Math.floor(cell.x * atlasScale), top = Math.floor(cell.y * atlasScale);
    const right = Math.ceil((cell.x + cell.size) * atlasScale);
    const bottom = Math.ceil((cell.y + cell.size) * atlasScale);
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const rgb = [0, 0, 0]; let count = 0, alpha = 0;
      const offsets = sampling === "nearest" ? [0.5] : [0.25, 0.75];
      for (const dy of offsets) for (const dx of offsets) {
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
        for (let channel = 0; channel < 3; channel++) rgb[channel] += sample(sx, sy, channel);
        alpha += channels === 4 ? sample(sx, sy, 3) : 255;
        count++;
      }
      if (!count) continue;
      const target = (y * outputWidth + x) * 4;
      for (let channel = 0; channel < 3; channel++) output[target + channel] = Math.round(rgb[channel] / count);
      output[target + 3] = Math.round(alpha / offsets.length ** 2);
    }
  }
  return { data: output, width: outputWidth, height: outputHeight, channels: 4 };
}
