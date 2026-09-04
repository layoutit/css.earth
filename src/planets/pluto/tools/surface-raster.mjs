import { prepareProjectiveTextureLayer } from "../../../platform/projective-surface-raster.mjs";

export const PLUTO_SURFACE_ATLAS = Object.freeze({ columns: 32, rows: 14, cellSize: 66, gutter: 1, width: 2112, height: 924 });
const IDENTITY = "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1";

// Bake the homography into RGBA pixels, retaining the existing affine scene
// frame. Chrome never has to flatten a perspective-warped child texture.
export function prepareSurfaceRasterCell(geometry, index) {
  const layer = prepareProjectiveTextureLayer(geometry.matrix, 2);
  const matrix = layer.textureMatrix.split(",").map(Number);
  const corners = [[0, 0], [geometry.leafWidth * 2, 0], [geometry.leafWidth * 2, geometry.leafHeight * 2], [0, geometry.leafHeight * 2]];
  const points = corners.map(([x, y]) => {
    const w = matrix[3] * x + matrix[7] * y + matrix[15];
    if (!(w > 0)) throw new Error("Pluto raster projection crosses infinity.");
    return [x / w, y / w];
  });
  const width = Math.ceil(Math.max(...points.map(p => p[0]))) / 2;
  const height = Math.ceil(Math.max(...points.map(p => p[1]))) / 2;
  if (width > 64 || height > 64 || index < 0 || index >= 448) throw new Error("Pluto projected texture exceeds its atlas cell.");
  const x = index % 32 * PLUTO_SURFACE_ATLAS.cellSize + PLUTO_SURFACE_ATLAS.gutter;
  const y = Math.floor(index / 32) * PLUTO_SURFACE_ATLAS.cellSize + PLUTO_SURFACE_ATLAS.gutter;
  return {
    width, height, x, y,
    source: { width: geometry.leafWidth, height: geometry.leafHeight, backgroundPosition: geometry.backgroundPosition, backgroundSize: geometry.backgroundSize, perspectiveX: matrix[3], perspectiveY: matrix[7], w: matrix[15] },
    layer: { ...layer, textureMatrix: IDENTITY },
  };
}

export function bakeSurfaceRaster(data, { width, height, channels }, cells, density) {
  if (channels !== 3 || data.length !== width * height * channels || ![1, 2].includes(density)) throw new Error("Invalid Pluto source raster.");
  const outputWidth = PLUTO_SURFACE_ATLAS.width * density;
  const outputHeight = PLUTO_SURFACE_ATLAS.height * density;
  const output = Buffer.alloc(outputWidth * outputHeight * 4);
  const sample = (x, y, channel) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
    const at = (sx, sy) => data[(Math.max(0, Math.min(height - 1, sy)) * width + ((sx % width) + width) % width) * channels + channel];
    return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
  };
  for (const cell of cells) {
    const source = cell.source;
    const scaleX = width / source.backgroundSize[0], scaleY = height / source.backgroundSize[1];
    for (let y = 0; y < Math.ceil(cell.height * density); y++) for (let x = 0; x < Math.ceil(cell.width * density); x++) {
      const rgb = [0, 0, 0]; let count = 0;
      // Four subpixel samples retain coverage at the slanted polygon boundary.
      for (const dy of [0.25, 0.75]) for (const dx of [0.25, 0.75]) {
        const px = (x + dx) * 2 / density, py = (y + dy) * 2 / density;
        const denominator = 1 - source.perspectiveX * px - source.perspectiveY * py;
        if (!(denominator > 0)) continue;
        const u = px * source.w / denominator / 2, v = py * source.w / denominator / 2;
        if (u < 0 || v < 0 || u > source.width || v > source.height) continue;
        const sx = (u - source.backgroundPosition[0]) * scaleX - 0.5;
        // Each full-band leaf runs south-to-north; the source image runs
        // north-to-south. Reverse the coordinate before interpolation so edge
        // taps still read adjacent latitudes, not separately reversed bands.
        const sy = (source.height - v - source.backgroundPosition[1]) * scaleY - 0.5;
        for (let c = 0; c < 3; c++) rgb[c] += sample(sx, sy, c);
        count++;
      }
      if (!count) continue;
      const target = ((cell.y * density + y) * outputWidth + cell.x * density + x) * 4;
      for (let c = 0; c < 3; c++) output[target + c] = Math.round(rgb[c] / count);
      output[target + 3] = Math.round(count / 4 * 255);
    }
  }
  return { data: output, width: outputWidth, height: outputHeight, channels: 4 };
}
