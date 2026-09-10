import type { RasterInfo, RasterAtlas } from "./contracts.mts";
import type { ProjectiveGeometry } from "../../../src/platform/projective-surface-raster.mts";
import { prepareProjectiveTextureLayer } from "../../../src/platform/projective-surface-raster.mts";

const IDENTITY = "1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1";

// Bake the homography into RGBA pixels, retaining the existing affine scene
// frame. Chrome never has to flatten a perspective-warped child texture.
export function prepareSurfaceRasterCell(geometry: ProjectiveGeometry, index: number, atlas: RasterAtlas) {
  const layer = prepareProjectiveTextureLayer(geometry.matrix, 2);
  const matrix = layer.textureMatrix.split(",").map(Number);
  const corners = [[0, 0], [geometry.leafWidth * 2, 0], [geometry.leafWidth * 2, geometry.leafHeight * 2], [0, geometry.leafHeight * 2]];
  const points = corners.map(([x, y]) => {
    const w = matrix[3] * x + matrix[7] * y + matrix[15];
    if (!(w > 0)) throw new Error("Prepared surface raster projection crosses infinity.");
    return [x / w, y / w];
  });
  // Use the reserved gutter as a source-sampled apron. Fractional coverage
  // belongs outside the nominal face, so adjacent faces overlap opaque pixels.
  const padding = atlas.gutter;
  const width = Math.ceil(Math.max(...points.map(p => p[0]))) / 2 + 2 * padding;
  const height = Math.ceil(Math.max(...points.map(p => p[1]))) / 2 + 2 * padding;
  if (width > atlas.cellSize || height > atlas.cellSize || index < 0 || index >= atlas.columns * atlas.rows) throw new Error("Prepared surface projected texture exceeds its atlas cell.");
  const x = index % atlas.columns * atlas.cellSize;
  const y = Math.floor(index / atlas.columns) * atlas.cellSize;
  const frame = layer.frameMatrix.split(',').map(Number);
  for (let axis = 0; axis < 3; axis++) frame[12 + axis] -= 2 * padding * (frame[axis] + frame[4 + axis]);
  const boundary = points.map(point => point.map(value => value / 2));
  return {
    width, height, x, y,
    source: { width: geometry.leafWidth, height: geometry.leafHeight, backgroundPosition: geometry.backgroundPosition, backgroundSize: geometry.backgroundSize, perspectiveX: matrix[3], perspectiveY: matrix[7], w: matrix[15], padding, boundary },
    layer: { ...layer, frameMatrix: frame.join(','), textureMatrix: IDENTITY },
  };
}

export function bakeSurfaceRaster(data: Uint8Array, { width, height, channels }: RasterInfo, cells: readonly ReturnType<typeof prepareSurfaceRasterCell>[], density: number, atlas: RasterAtlas) {
  if (channels !== 3 || data.length !== width * height * channels || ![1, 2].includes(density)) throw new Error("Invalid Prepared surface source raster.");
  const outputWidth = atlas.width * density;
  const outputHeight = atlas.height * density;
  const output = Buffer.alloc(outputWidth * outputHeight * 4);
  const sample = (x: number, y: number, channel: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
    const at = (sx: number, sy: number) => data[(Math.max(0, Math.min(height - 1, sy)) * width + ((sx % width) + width) % width) * channels + channel];
    return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
  };
  for (const cell of cells) {
    const source = cell.source;
    const padding = source.padding ?? 0;
    const edges = source.boundary?.map(([ax, ay], i, points) => {
      const [bx, by] = points[(i + 1) % points.length];
      const length = Math.hypot(bx - ax, by - ay);
      return { ax, ay, dx: (bx - ax) / length, dy: (by - ay) / length };
    });
    const scaleX = width / source.backgroundSize[0], scaleY = height / source.backgroundSize[1];
    for (let y = 0; y < Math.ceil(cell.height * density); y++) for (let x = 0; x < Math.ceil(cell.width * density); x++) {
      const rgb = [0, 0, 0]; let count = 0;
      // Four subpixel samples retain coverage at the slanted polygon boundary.
      for (const dy of [0.25, 0.75]) for (const dx of [0.25, 0.75]) {
        const px = ((x + dx) / density - padding) * 2, py = ((y + dy) / density - padding) * 2;
        const denominator = 1 - source.perspectiveX * px - source.perspectiveY * py;
        if (!(denominator > 0)) continue;
        const u = px * source.w / denominator / 2, v = py * source.w / denominator / 2;
        if (edges
          ? edges.some(edge => edge.dx * (py / 2 - edge.ay) - edge.dy * (px / 2 - edge.ax) < -padding)
          : u < 0 || v < 0 || u > source.width || v > source.height) continue;
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
  return { data: output, width: outputWidth, height: outputHeight, channels: 4 as const };
}
