import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { packProjectiveSurfaceRaster } from '@cssearth/bake/scene';
import { domeRingWarp, latitudeRasterBands } from '../giant-layers/geometry.mts';
import { compositePolarOverlay, layoutPolarAtlasForCaps, writeDomeRings } from './polar-dome.mts';
const test = sourceTest();

const projection = { edgeLatitudeDegrees: 64, scale: 1.035 };
/** A two-tile atlas (south, north) of `tile` pixels, each pixel written by `paint(poleTile, dx, dy)` at its tile coordinates. */
function atlas(tile: number, paint: (poleTile: number, dx: number, dy: number) => readonly number[]) {
  const data = new Uint8Array(tile * 2 * tile * 4);
  for (let poleTile = 0; poleTile < 2; poleTile++) for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++)
    data.set(paint(poleTile, (x + 0.5) / tile * 2 - 1, (y + 0.5) / tile * 2 - 1), (y * tile * 2 + poleTile * tile + x) * 4);
  return { data, width: tile * 2, height: tile };
}

test('the pole imagery lands on the map through its own projection and blends over it by its alpha', () => {
  // An opaque white spot in the north tile where the tile's own convention puts longitude 180° (map column one half, straight
  // up the tile) at 77° (radius one half), and a half-transparent black ring at radius 0.8 (69.2°) all round.
  const tile = 128, spot = atlas(tile, (poleTile, dx, dy) => {
    if (poleTile !== 1) return [0, 0, 0, 0];
    const radius = Math.hypot(dx, dy) / projection.scale;
    if (Math.hypot(dx, dy + 0.5 * projection.scale) < 0.06) return [255, 255, 255, 255];
    return Math.abs(radius - 0.8) < 0.05 ? [0, 0, 0, 128] : [0, 0, 0, 0];
  });
  const width = 720, height = 360, map = { data: Buffer.alloc(width * height * 3, 100), info: { width, height, channels: 3 } };
  const out = compositePolarOverlay(map, spot, projection).data;
  const at = (latitude: number, longitudeDegrees: number) => out[(Math.floor((90 - latitude) / 180 * height) * width + Math.floor(longitudeDegrees / 360 * width)) * 3]!;
  assert.equal(at(77, 180), 255);
  assert.equal(at(77, 0), 100);
  assert.equal(at(77, 90), 100);
  assert.ok(Math.abs(at(69.2, 45) - 50) <= 2, `half-transparent black over 100 gives 50, not ${at(69.2, 45)}`);
  assert.equal(at(63, 180), 100);
  assert.equal(at(-77, 180), 100);
});

test('the atlas is laid out for the caps: a tile pixel at d holds the longitude of the direction (dx, dy) at the north pole and (dx, −dy) at the south', () => {
  // Each pixel stores its map column in its own convention, (atan2(dx, −dy) + π) / 2π, as red.
  const tile = 64, own = atlas(tile, (_poleTile, dx, dy) => [Math.round(((Math.atan2(dx, -dy) + Math.PI) / (2 * Math.PI)) * 255), 0, 0, 255]);
  const laid = layoutPolarAtlasForCaps(own);
  let worst = 0;
  for (let poleTile = 0; poleTile < 2; poleTile++) for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
    const dx = (x + 0.5) / tile * 2 - 1, dy = (y + 0.5) / tile * 2 - 1;
    if (Math.hypot(dx, dy) < 0.1) continue;
    const longitude = Math.atan2(poleTile === 1 ? dy : -dy, dx), expected = ((longitude / (2 * Math.PI)) % 1 + 1) % 1 * 255;
    const held = laid[(y * tile * 2 + poleTile * tile + x) * 4]!, difference = Math.abs(held - expected);
    worst = Math.max(worst, Math.min(difference, 255 - difference));
  }
  assert.ok(worst <= 1, `a laid-out pixel holds a longitude ${worst} levels from its direction's`);
});

test('dome rings rewrite only their own packed rows', async () => {
  const recipe = JSON.parse(await readFile(new URL('../../../src/objects/jupiter/source/preparation/geometry.json', import.meta.url), 'utf8')) as {
    latitudeBoundsDegrees: number[]; surface: { width: number; height: number; gutter: number } };
  const { width, height, gutter } = recipe.surface, bounds = recipe.latitudeBoundsDegrees;
  const map = Buffer.alloc(width * height * 3);
  for (let index = 0; index < map.length; index++) map[index] = (index * 2654435761) >>> 24;
  const plain = packProjectiveSurfaceRaster(map, { width, height, channels: 3, bands: latitudeRasterBands(bounds, height), gutter });
  const before = Buffer.from(plain.data), warp = domeRingWarp(recipe);
  writeDomeRings(plain, { data: map, info: { width, height, channels: 3 } }, warp, bounds);
  const ringRows = new Set(warp.flatMap(ring => { const band = plain.bands[bounds.indexOf(ring.southDegrees)]!;
    return Array.from({ length: band.height + gutter * 2 }, (_, k) => band.packedY - gutter + k); }));
  assert.equal(warp.length, 4);
  let changedOutside = 0, changedInside = 0;
  for (let row = 0; row < plain.packedHeight; row++) {
    const a = before.subarray(row * plain.packedWidth * 3, (row + 1) * plain.packedWidth * 3), b = plain.data.subarray(row * plain.packedWidth * 3, (row + 1) * plain.packedWidth * 3);
    if (!Buffer.from(a).equals(Buffer.from(b))) ringRows.has(row) ? changedInside++ : changedOutside++;
  }
  assert.equal(changedOutside, 0);
  assert.ok(changedInside > 0);
});
