import assert from 'node:assert/strict';
import test from 'node:test';
import { fromArrayBuffer } from 'geotiff';
import { equirectangularGeoTiff, equirectangularTiles } from './place.mts';

const grid = (columns: number, rows: number, filled: (x: number, y: number) => boolean) => {
  const full = new Float32Array(columns * rows).fill(NaN);
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) if (filled(x, y)) full[y * columns + x] = x + y / 1000;
  return full;
};

test('a footprint inside the grid becomes one tile cropped to its extent', () => {
  const tiles = equirectangularTiles(grid(36, 18, (x, y) => x >= 10 && x <= 20 && y >= 4 && y <= 9), 36, 18);
  assert.equal(tiles.length, 1);
  assert.deepEqual([tiles[0]!.firstColumn, tiles[0]!.firstRow, tiles[0]!.width, tiles[0]!.height], [10, 4, 11, 6]);
  assert.equal(tiles[0]!.data[0], Math.fround(10 + 4 / 1000));
});

test('a footprint across 0 degrees longitude becomes two tiles, one on each side of the seam', () => {
  const tiles = equirectangularTiles(grid(36, 18, (x, y) => (x >= 30 || x <= 3) && y >= 6 && y <= 8), 36, 18);
  assert.deepEqual(tiles.map(tile => [tile.firstColumn, tile.width]), [[30, 6], [0, 4]]);
  assert.ok(tiles.every(tile => tile.firstRow === 6 && tile.height === 3));
  assert.equal(tiles[1]!.data[3], Math.fround(3 + 6 / 1000), 'the second tile starts at column 0 of the grid');
});

test('a footprint that rings the globe is one full-width tile, and an empty grid has none', () => {
  const ring = equirectangularTiles(grid(36, 18, (_, y) => y >= 15), 36, 18);
  assert.deepEqual(ring.map(tile => [tile.firstColumn, tile.width, tile.firstRow, tile.height]), [[0, 36, 15, 3]]);
  assert.deepEqual(equirectangularTiles(grid(36, 18, () => false), 36, 18), []);
});

test('the per-frame GeoTIFF places the tile by its grid position and names the filter', async () => {
  const [tile] = equirectangularTiles(grid(360, 180, (x, y) => x >= 100 && x < 110 && y >= 50 && y < 55), 360, 180);
  const radiusMeters = 1352600, cellDegrees = 1, metresPerDegree = radiusMeters * Math.PI / 180;
  const bytes = equirectangularGeoTiff(tile!, { radiusMeters, filter: 'VIOLET', wavelengthMicrometers: 0.4, cellDegrees });
  const image = await (await fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))).getImage();
  assert.deepEqual([image.getWidth(), image.getHeight()], [10, 5]);
  assert.equal(image.getGDALNoData(), -9999);
  assert.deepEqual((await image.getGDALMetadata(0)), { WAVELENGTH: '0.4', DESCRIPTION: 'VIOLET' });
  const [x0, y0] = image.getOrigin();
  assert.ok(Math.abs(x0! - 100 * metresPerDegree) < 1e-3 && Math.abs(y0! - 40 * metresPerDegree) < 1e-3, 'origin at column 100, latitude 40 N');
  assert.equal(image.getGeoKeys()?.GeogSemiMajorAxisGeoKey, radiusMeters);
});
