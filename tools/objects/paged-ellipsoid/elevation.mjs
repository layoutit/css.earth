import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { colorForValue, terrainBrightness } from '../terrestrial-layers/scientific-raster.mjs';

const demand = (ok, why) => { if (!ok) throw new Error(`Elevation: ${why}`); };

// DAP2 transmits Int16 arrays as sign-extended big-endian Int32 values.
// Decode the provider's grid and coordinate arrays, never infer heights from RGB.
export function decodeElevationDods(bytes, grid, { rowOffset = 0, rows = grid.height } = {}) {
  const marker = bytes.indexOf('\nData:\n');
  demand(marker > 0 && marker < 2048, 'missing DAP2 header');
  const header = bytes.toString('utf8', 0, marker);
  const { width, height, firstIndex, stride, nativeCellDegrees } = grid;
  demand(Number.isInteger(width) && Number.isInteger(height) && width === height * 2 &&
    width > 1 && width <= 86400 && Number.isInteger(firstIndex) && Number.isInteger(stride) &&
    firstIndex >= 0 && firstIndex < stride && width * stride === 86400 && height * stride === 43200 &&
    nativeCellDegrees === 1 / 240, 'invalid source grid');
  demand(Number.isInteger(rowOffset) && Number.isInteger(rows) && rowOffset >= 0 && rows > 0 && rowOffset + rows <= height, 'invalid latitude block');
  const expected = `Dataset { Grid { ARRAY: Int16 elevation[lat = ${rows}][lon = ${width}]; MAPS: Float64 lat[lat = ${rows}]; Float64 lon[lon = ${width}]; } elevation; } bodc/gebco/global/gebco_2026/ice_surface_elevation/netcdf/GEBCO_2026.nc;`;
  demand(header.replace(/\s+/g, ' ').trim() === expected, 'product or grid differs');
  let offset = marker + 7;
  demand(bytes.length === offset + 24 + width * rows * 4 + (width + rows) * 8, 'truncated or extra DAP2 data');
  const count = expectedCount => {
    demand(bytes.readUInt32BE(offset) === expectedCount && bytes.readUInt32BE(offset + 4) === expectedCount, 'array count differs');
    offset += 8;
  };
  count(width * rows);
  const values = new Int16Array(width * rows);
  for (let i = 0; i < values.length; i++, offset += 4) {
    const value = bytes.readInt32BE(offset);
    demand(value >= -11000 && value <= 9000, 'invalid height or missing value');
    values[i] = value;
  }
  const axis = (length, origin, startIndex = firstIndex) => {
    count(length);
    const values = new Float64Array(length);
    for (let i = 0; i < length; i++, offset += 8) {
      values[i] = bytes.readDoubleBE(offset);
      demand(Math.abs(values[i] - (origin + (startIndex + i * stride + .5) * nativeCellDegrees)) < 1e-9,
        'coordinate axis differs');
    }
    return values;
  };
  const latitudes = axis(rows, -90, firstIndex + rowOffset * stride), longitudes = axis(width, -180);
  return elevationSampler(values, latitudes, longitudes, stride * nativeCellDegrees);
}

function elevationSampler(values, latitudes, longitudes, step) {
  const width = longitudes.length, height = latitudes.length;
  // Latitude is south-to-north in GEBCO; renderers consume north-to-south.
  const sample = (longitude, latitude) => {
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude) > 90) return null;
    const x = ((longitude - longitudes[0]) / step % width + width) % width;
    const y = Math.max(0, Math.min(height - 1, (latitude - latitudes[0]) / step));
    const x0 = Math.floor(x), x1 = (x0 + 1) % width, y0 = Math.floor(y), y1 = Math.min(height - 1, y0 + 1);
    const dx = x - x0, dy = y - y0;
    return (values[y0 * width + x0] * (1 - dx) + values[y0 * width + x1] * dx) * (1 - dy) +
      (values[y1 * width + x0] * (1 - dx) + values[y1 * width + x1] * dx) * dy;
  };
  return { values, latitudes, longitudes, sample };
}

export async function readElevationGrid(sourceDirectory, map) {
  const metadata = await readFile(resolve(sourceDirectory, map.scientific.metadata), 'utf8');
  demand(metadata.includes('String standard_name "height_above_mean_sea_level";') &&
    metadata.includes('String units "m";') && metadata.includes('String date_created "2026-04-17";') &&
    metadata.includes('10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa'), 'units or source identity differs');
  const { grid, blocks } = map.scientific;
  if (!blocks) return decodeElevationDods(gunzipSync(await readFile(resolve(sourceDirectory, map.path))), grid);
  demand(blocks.length > 0 && map.path === blocks[0].path, 'source binding differs');
  const values = new Int16Array(grid.width * grid.height), latitudes = new Float64Array(grid.height);
  let nextRow = 0, longitudes;
  for (const block of blocks) {
    demand(block.rowOffset === nextRow, 'missing or overlapping latitude blocks');
    const decoded = decodeElevationDods(gunzipSync(await readFile(resolve(sourceDirectory, block.path))), grid, block);
    values.set(decoded.values, block.rowOffset * grid.width); latitudes.set(decoded.latitudes, block.rowOffset);
    longitudes = decoded.longitudes; nextRow += block.rows;
  }
  demand(nextRow === grid.height, 'incomplete global coverage');
  return elevationSampler(values, latitudes, longitudes, grid.stride * grid.nativeCellDegrees);
}

export function elevationColor(value, recipe) {
  const stops = recipe.palette;
  demand(Number.isFinite(value) && stops.length >= 2 && stops.every((stop, i) =>
    Number.isFinite(stop.meters) && /^#[0-9a-f]{6}$/i.test(stop.color) && (!i || stop.meters > stops[i - 1].meters)), 'invalid palette');
  const i = Math.max(1, stops.findIndex(stop => stop.meters >= value));
  const index = value > stops.at(-1).meters ? stops.length - 1 : i;
  return colorForValue(value, { minimum: stops[index - 1].meters, maximum: stops[index].meters,
    colors: [stops[index - 1].color, stops[index].color] });
}

export async function prepareElevationMap({ sourceDirectory, map, width, height }) {
  demand(width === 2 * height && Number.isInteger(height) && height > 1, 'invalid output dimensions');
  const source = await readElevationGrid(sourceDirectory, map), recipe = map.scientific;
  const step = 360 / width, values = new Float32Array(width * height);
  // Interpolate the scalar before mapping colors. The sample spacing and the
  // output texel density remain separate from GEBCO's native 15 arc-second grid.
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++)
    values[y * width + x] = source.sample(-180 + (x + .5) * step, 90 - (y + .5) * step);
  const sample = (longitude, latitude) => {
    const y = Math.floor((90 - latitude) / step);
    if (y < 0 || y >= height) return null;
    const x = ((Math.floor((longitude + 180) / step) % width) + width) % width;
    return values[y * width + x];
  };
  const lookup = Array.from({ length: 20001 }, (_, i) => elevationColor(i - 11000, recipe));
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x, latitude = 90 - (y + .5) * step, longitude = -180 + (x + .5) * step;
    const color = lookup[Math.round(values[i]) + 11000];
    const brightness = recipe.relief ? terrainBrightness({ sample }, longitude, latitude, step, recipe.relief) : 1;
    for (let c = 0; c < 3; c++) data[i * 3 + c] = Math.max(0, Math.min(255, Math.round(color[c] * brightness)));
  }
  return { data, info: { width, height, channels: 3 } };
}

export async function writeElevationLegend(recipe, path) {
  const { width, height, minimum, maximum } = recipe.legend;
  const data = Buffer.alloc(width * height * 3);
  for (let x = 0; x < width; x++) {
    const color = elevationColor(minimum + (maximum - minimum) * x / (width - 1), recipe);
    for (let y = 0; y < height; y++) data.set(color, (y * width + x) * 3);
  }
  await sharp(data, { raw: { width, height, channels: 3 } }).png().toFile(path);
}
