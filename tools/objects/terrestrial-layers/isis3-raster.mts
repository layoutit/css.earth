import {parseIsis3Grid} from './source-records.mts';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';

/** Decode mapped ISIS3 Real cubes; preserve numeric values and special pixels. */
export function decodeIsis3Raster(input: Buffer, sourceGrid: unknown) {
  const grid=parseIsis3Grid(sourceGrid);
  const bytes = input[0] === 0x1f && input[1] === 0x8b ? gunzipSync(input) : input;
  const label = bytes.subarray(0, 65536).toString('ascii').split('\0')[0];
  const group = (name: string) => {
    const text = label.match(new RegExp(`Group\\s*=\\s*${name}\\s+([\\s\\S]*?)End_Group`))?.[1];
    if (!text) throw new Error(`ISIS3 ${name} group is missing.`);
    return text;
  };
  const value = (text: string, key: string) => text.match(new RegExp(`^\\s*${key}\\s*=\\s*([^\\s]+)`, 'm'))?.[1];
  const number = (text: string, key: string) => Number(value(text, key));
  const dimensions = group('Dimensions'), pixels = group('Pixels'), mapping = group('Mapping');
  const width = number(dimensions, 'Samples'), height = number(dimensions, 'Lines');
  const origin = [number(mapping, 'UpperLeftCornerX'), number(mapping, 'UpperLeftCornerY')];
  const resolution = number(mapping, 'PixelResolution');
  // Some published global cubes omit both longitude keywords. This explicit
  // opt-in verifies their native pixel footprint, including sub-pixel padding;
  // longitudeRange still denotes the geographic sampling domain, not a crop.
  if (grid.allowMissingLongitudeBounds !== undefined && typeof grid.allowMissingLongitudeBounds !== 'boolean') {
    throw new TypeError('ISIS3 allowMissingLongitudeBounds must be boolean.');
  }
  const minimumLongitude = value(mapping, 'MinimumLongitude');
  const maximumLongitude = value(mapping, 'MaximumLongitude');
  let longitudeBoundsMatch = Number(minimumLongitude) === grid.longitudeRange?.[0] &&
    Number(maximumLongitude) === grid.longitudeRange?.[1];
  if (grid.allowMissingLongitudeBounds === true && minimumLongitude === undefined && maximumLongitude === undefined) {
    const degreesPerMeter = 180 / (Math.PI * number(mapping, 'EquatorialRadius'));
    const left = number(mapping, 'CenterLongitude') + origin[0] * degreesPerMeter;
    const right = number(mapping, 'CenterLongitude') + (origin[0] + width * resolution) * degreesPerMeter;
    const pixelDegrees = resolution * degreesPerMeter;
    // Only demonstrated global 0..360 products: no missing partial-map bounds,
    // uncovered edge, extra full pixel, or broad inferred longitude convention.
    const epsilon = 1e-9;
    longitudeBoundsMatch = grid.longitudeRange?.[0] === 0 && grid.longitudeRange?.[1] === 360 &&
      Number.isFinite(pixelDegrees) && pixelDegrees > 0 && pixelDegrees <= 1 + epsilon &&
      left <= epsilon && left > -pixelDegrees - epsilon &&
      right >= 360 - epsilon && right < 360 + pixelDegrees + epsilon;
  }
  if (width !== grid.width || height !== grid.height || number(dimensions, 'Bands') !== 1 ||
      value(pixels, 'Type') !== 'Real' || value(pixels, 'ByteOrder') !== 'Lsb' ||
      number(pixels, 'Base') !== 0 || number(pixels, 'Multiplier') !== 1 ||
      value(mapping, 'ProjectionName') !== 'SimpleCylindrical' ||
      value(mapping, 'LatitudeType') !== 'Planetocentric' || value(mapping, 'LongitudeDirection') !== 'PositiveEast' ||
      value(mapping, 'TargetName') !== grid.targetName ||
      number(mapping, 'LongitudeDomain') !== 360 ||
      !longitudeBoundsMatch ||
      number(mapping, 'CenterLongitude') !== grid.centerLongitude ||
      number(mapping, 'EquatorialRadius') !== grid.referenceRadiusMeters ||
      number(mapping, 'PolarRadius') !== grid.polarRadiusMeters ||
      origin.some((n, i) => n !== grid.origin[i]) || resolution !== grid.resolutionMeters) {
    throw new Error('ISIS3 source grid or encoding differs from the authored recipe.');
  }
  const start = number(label, 'StartByte') - 1;
  const tiled = value(label, 'Format') === 'Tile';
  if (!tiled && value(label, 'Format') !== 'BandSequential') throw new Error('Unsupported ISIS3 storage.');
  const tileWidth = tiled ? number(label, 'TileSamples') : width;
  const tileHeight = tiled ? number(label, 'TileLines') : 1;
  if (![width, height, tileWidth, tileHeight].every(n => Number.isSafeInteger(n) && n > 0) ||
      !Number.isSafeInteger(start) || start < 0) throw new Error('Invalid ISIS3 dimensions or data offset.');
  const columns = Math.ceil(width / tileWidth), rows = Math.ceil(height / tileHeight);
  if (start + columns * rows * tileWidth * tileHeight * 4 > bytes.length) throw new Error('Truncated ISIS3 raster.');
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const tile = Math.floor(y / tileHeight) * columns + Math.floor(x / tileWidth);
    const index = tile * tileWidth * tileHeight + (y % tileHeight) * tileWidth + x % tileWidth;
    data[y * width + x] = bytes.readFloatLE(start + index * 4);
  }
  return {data, origin, resolution: [resolution, -resolution]};
}

export async function loadIsis3Raster(path: string, grid: unknown) {
  return decodeIsis3Raster(await readFile(path), grid);
}
