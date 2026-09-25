import { cross3 as cross, dotN as dot } from '@cssearth/core';
import sharp from 'sharp';
import { leafRasterScale } from '../../../src/platform/projective-surface-raster.mts';

const SAMPLE_OFFSETS = [[.25, .25], [.75, .25], [.25, .75], [.75, .75]];
// Four premultiplied RGBA float samples per pixel: bound preparation memory.
const MAX_PIXELS = 8 * 1024 * 1024;
function normalize(vector: readonly number[]) {
  const length = Math.hypot(...vector);
  if (!(length > 0)) throw new Error('Degenerate prepared plane');
  return vector.map(value => value / length);
}
function contains(points: readonly (readonly number[])[], x: number, y: number) {
  let inside = false;
  for (let a = 0, b = points.length - 1; a < points.length; b = a++) {
    const [ax, ay] = points[a], [bx, by] = points[b];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
function bounds(points: readonly (readonly number[])[]) {
  const result = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const [x, y] of points) {
    result.left = Math.min(result.left, x); result.right = Math.max(result.right, x);
    result.top = Math.min(result.top, y); result.bottom = Math.max(result.bottom, y);
  }
  return result;
}

/** Compile ordered, coplanar constant-color faces into retained image tiles.
 * Source polygons own coverage, including holes between faces. Only preparation
 * derives the raster; runtime transports the final image and affine leaves. */
export async function prepareCoplanarColorRaster({ faces, pixelsPerUnit, tilePixels = 512 }: {faces: {vertices: [number, number, number][]; color: [number, number, number, number]}[]; pixelsPerUnit: number; tilePixels?: number}) {
  if (!Array.isArray(faces) || !faces.length || !Number.isFinite(pixelsPerUnit) ||
      !(pixelsPerUnit > 0) || !Number.isInteger(tilePixels) || tilePixels < 1) {
    throw new TypeError('Invalid coplanar raster budget.');
  }
  for (const face of faces) {
    if (!Array.isArray(face?.vertices) || face.vertices.length < 3 ||
        face.vertices.some(vertex => !Array.isArray(vertex) || vertex.length !== 3 || vertex.some(value => !Number.isFinite(value))) ||
        !Array.isArray(face.color) || face.color.length !== 4 ||
        face.color.some(value => !Number.isFinite(value) || value < 0 || value > 255)) {
      throw new TypeError('Invalid prepared color face');
    }
  }
  const origin = faces[0].vertices[0];
  const right = normalize(faces[0].vertices[1].map((value, index) => value - origin[index]));
  const normal = normalize(cross(right, faces[0].vertices[2].map((value, index) => value - origin[index])));
  const down = cross(normal, right);
  const polygons = faces.map(face => {
    const points = face.vertices.map(vertex => {
      const delta = vertex.map((value, index) => value - origin[index]);
      if (Math.abs(dot(delta, normal)) > 1e-8 * (1 + Math.hypot(...delta))) throw new Error('Faces do not share one plane');
      return [dot(delta, right) * pixelsPerUnit, dot(delta, down) * pixelsPerUnit];
    });
    return { points, color: face.color, bounds: bounds(points) };
  });
  const extent = bounds(polygons.flatMap(polygon => polygon.points));
  const left = Math.floor(extent.left) - 1, top = Math.floor(extent.top) - 1;
  const width = Math.ceil(extent.right) - left + 1, height = Math.ceil(extent.bottom) - top + 1;
  if (!Number.isSafeInteger(width * height) || width * height > MAX_PIXELS) {
    throw new Error('Prepared coplanar raster exceeds its budget');
  }
  // Ordered supersampled source-over coverage. Each face scans only its bounds.
  const coverage = new Float32Array(width * height * 4 * 4);
  for (const { points, color, bounds: box } of polygons) {
    const x0 = Math.max(0, Math.floor(box.left - left)), x1 = Math.min(width, Math.ceil(box.right - left));
    const y0 = Math.max(0, Math.floor(box.top - top)), y1 = Math.min(height, Math.ceil(box.bottom - top));
    const alpha = color[3] / 255;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) for (let sample = 0; sample < 4; sample++) {
      if (!contains(points, x + left + SAMPLE_OFFSETS[sample][0], y + top + SAMPLE_OFFSETS[sample][1])) continue;
      const offset = ((y * width + x) * 4 + sample) * 4;
      for (let channel = 0; channel < 3; channel++) {
        coverage[offset + channel] = color[channel] * alpha + coverage[offset + channel] * (1 - alpha);
      }
      coverage[offset + 3] = alpha + coverage[offset + 3] * (1 - alpha);
    }
  }
  const pixels = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index++) {
    const sum = [0, 0, 0, 0];
    for (let sample = 0; sample < 4; sample++) for (let channel = 0; channel < 4; channel++) {
      sum[channel] += coverage[(index * 4 + sample) * 4 + channel];
    }
    if (!sum[3]) continue;
    for (let channel = 0; channel < 3; channel++) pixels[index * 4 + channel] = Math.round(sum[channel] / sum[3]);
    pixels[index * 4 + 3] = Math.round(sum[3] / 4 * 255);
  }
  const tiles = [];
  for (let y = 0; y < height; y += tilePixels) for (let x = 0; x < width; x += tilePixels) {
    const w = Math.min(tilePixels, width - x), h = Math.min(tilePixels, height - y);
    let painted = false;
    for (let j = y; j < y + h && !painted; j++) for (let i = x; i < x + w; i++) {
      if (pixels[(j * width + i) * 4 + 3]) { painted = true; break; }
    }
    if (!painted) continue;
    const translation = origin.map((value, index) => value + right[index] * (left + x) / pixelsPerUnit + down[index] * (top + y) / pixelsPerUnit);
    const matrix = [...right.map(value => value / pixelsPerUnit), 0, ...down.map(value => value / pixelsPerUnit), 0, ...normal, 0, ...translation, 1];
    tiles.push({ x, y, width: w, height: h, matrix });
  }
  return { width, height, tiles, sourceFaceCount: faces.length,
    bytes: await sharp(pixels, { raw: { width, height, channels: 4 } }).webp({ lossless: true, effort: 4 }).toBuffer() };
}

/** A tile's box, texture address and matrix. A tile's matrix maps one raster texel to one CSS pixel of its box; the box
 * shows `imagePixels`, the published image's width, at two texels per CSS pixel instead (leafRasterScale), and the matrix's
 * first two columns grow by the same factor, so each tile still covers its plane rectangle (transform-origin 0 0). WebKit
 * backs a leaf at its box size times the device pixel ratio whatever its transform: a full 512-texel tile is modelled at
 * 9 MB at DPR 3 and 2.25 MB at 256 CSS px. */
export function coplanarTileLayout(tile: {x: number; y: number; width: number; height: number; matrix: readonly number[]},
  raster: {width: number; height: number}, imagePixels: number) {
  const scale = leafRasterScale(imagePixels, raster.width, 1), px = (value: number) => `${value * scale}px`;
  return { matrix: tile.matrix.map((value, index) => index < 8 ? value / scale : value), width: px(tile.width), height: px(tile.height),
    backgroundPosition: `${px(-tile.x)} ${px(-tile.y)}`, backgroundSize: `${px(raster.width)} ${px(raster.height)}` };
}
