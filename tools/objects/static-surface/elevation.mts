import type { ElevationRecipe, RasterImage } from "./contracts.mts";
import { terrainBrightness } from '../terrestrial-layers/scientific-raster.mts';

// USGS's pinned GeoTIFF is uncompressed, signed 16-bit, one strip per row.
// Reading these samples directly avoids image-library conversion of negative
// elevations into unsigned display luminance. No-data is not terrain at zero.
export function decodeElevationGrid(bytes: Buffer, recipe: ElevationRecipe) {
  if (bytes.toString("ascii", 0, 2) !== "II" || bytes.readUInt16LE(2) !== 42) throw new Error("Unsupported Signed elevation TIFF header.");
  const ifd = bytes.readUInt32LE(4);
  const tags = new Map<number, {type: number; count: number; start: number; value(): number}>();
  for (let i = 0; i < bytes.readUInt16LE(ifd); i++) {
    const offset = ifd + 2 + i * 12;
    const tag = bytes.readUInt16LE(offset), type = bytes.readUInt16LE(offset + 2), count = bytes.readUInt32LE(offset + 4);
    const size = type === 3 ? 2 : type === 4 ? 4 : 1;
    const start = count * size <= 4 ? offset + 8 : bytes.readUInt32LE(offset + 8);
    tags.set(tag, { type, count, start, value: () => type === 3 ? bytes.readUInt16LE(start) : bytes.readUInt32LE(start) });
  }
  const get = (tag: number) => tags.get(tag)?.value();
  if (get(258) !== 16 || get(259) !== 1 || get(277) !== 1 || get(278) !== 1 || get(339) !== 2) throw new Error("Unsupported Signed elevation elevation encoding.");
  const width = get(256), height = get(257), strips = tags.get(273), counts = tags.get(279), missing = tags.get(42113);
  if (width === undefined || height === undefined || !strips || !counts || strips.type !== 4 || counts.type !== 4 || strips.count !== height || counts.count !== height || !missing || bytes.toString("ascii", missing.start, missing.start + missing.count).replace(/\0/gu, "") !== String(recipe.noData)) throw new Error("Signed elevation elevation strip/no-data metadata drifted.");
  const offsets = Array.from({ length: height }, (_, y) => {
    const offset = bytes.readUInt32LE(strips.start + y * 4);
    if (bytes.readUInt32LE(counts.start + y * 4) !== width * 2 || offset + width * 2 > bytes.length) throw new Error("Invalid Signed elevation elevation strip.");
    return offset;
  });
  return { width, height, recipe, sample: (x: number, y: number) => bytes.readInt16LE(offsets[y] + x * 2) };
}

export function elevationColor(metres: number, recipe: ElevationRecipe) {
  if (metres === recipe.noData) return [0, 0, 0];
  const [low, middle, high] = recipe.palette;
  const t = Math.max(-1, Math.min(1, metres / recipe.rangeMetres));
  const a = t < 0 ? low : middle, b = t < 0 ? middle : high;
  const f = t < 0 ? t + 1 : t;
  return a.map((v, i) => Math.round(v + (b[i] - v) * f));
}

export function elevationRaster(grid: ReturnType<typeof decodeElevationGrid>, width: number, height: number): RasterImage & {missing: Uint8Array} {
  const { recipe } = grid;
  const data = Buffer.alloc(width * height * 3);
  const missing = new Uint8Array(width * height);
  const terrain = { sample(longitude: number, latitude: number) {
    if (latitude < -90 || latitude >= 90) return null;
    const x = Math.floor(((longitude % 360 + 360) % 360) / 360 * grid.width);
    const y = Math.min(grid.height - 1, Math.floor((90 - latitude) / 180 * grid.height));
    const value = grid.sample(x, y);
    return value === recipe.noData ? null : value;
  } };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sourceX = Math.min(grid.width - 1, Math.floor((x + 0.5) * grid.width / width));
    const sourceY = Math.min(grid.height - 1, Math.floor((y + 0.5) * grid.height / height));
    const metres = grid.sample(sourceX, sourceY);
    missing[y * width + x] = Number(metres === recipe.noData);
    const brightness = recipe.relief && metres !== recipe.noData
      ? terrainBrightness(terrain, (x + .5) / width * 360, 90 - (y + .5) / height * 180, 360 / width, recipe.relief) : 1;
    data.set(elevationColor(metres, recipe).map(value => Math.max(0, Math.min(255, Math.round(value * brightness)))), (y * width + x) * 3);
  }
  return { data, info: { width, height, channels: 3 }, missing };
}
