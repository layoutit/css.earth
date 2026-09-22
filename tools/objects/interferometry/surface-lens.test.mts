import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readFitsImage } from '../../fits/fits.mts';
import { controlledShapeCamera } from '../terrestrial-layers/shape-camera-mosaic.mts';
import { decodeFitsImageMap } from '../terrestrial-layers/fits-image-map.mts';
import { paintScienceSurface } from '../terrestrial-layers/scientific-raster.mts';
import { readSurfaceGrid, surfaceLensMap, writeFitsImageMap } from './surface-lens.mts';

// ROTIR on the Polaris April 2021 file (3.16 mas sphere, linear limb darkening 0.12, pole North in the sky plane), written by
// surface.jl at a small size: the surface grid, and the sky image ROTIR projects from the same map with its own code.
const fixtures = resolve(import.meta.dirname, 'fixtures');
const MAS = Math.PI / 180 / 3.6e6, DEGREE = Math.PI / 180, LIMB = 0.12, RADIUS_MAS = 1.58, SKY_PIXEL_MAS = 0.04;

const correlation = (a: readonly number[], b: readonly number[]) => {
  const mean = (x: readonly number[]) => x.reduce((sum, value) => sum + value, 0) / x.length, ma = mean(a), mb = mean(b);
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { ab += (a[i]! - ma) * (b[i]! - mb); aa += (a[i]! - ma) ** 2; bb += (b[i]! - mb) ** 2; }
  return ab / Math.sqrt(aa * bb);
};

test('a sphere map cast onto the lens matches ROTIR\'s own sky projection through the production camera, and the mirror does not', async () => {
  const grid = readSurfaceGrid(await readFile(resolve(fixtures, 'polaris-rotir-grid.fits'))), sky = readFitsImage(await readFile(resolve(fixtures, 'polaris-rotir-sky.fits')));
  assert.equal(sky.header.CDELT1, -SKY_PIXEL_MAS, 'the sky image is east-left like an interferometric reconstruction');
  const width = sky.width, height = sky.height, topDown = (x: number, y: number) => sky.values[(height - 1 - y) * width + x]!;
  let sx = 0, sy = 0, sw = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const v = topDown(x, y); if (v > 0) { sx += x * v; sy += y * v; sw += v; } }
  // The camera a display-orientation star gets: observer on body +x, pole North, the sky image's own scale and centre.
  const rangeKm = 1e9, radiusMeters = RADIUS_MAS * MAS * rangeKm * 1000;
  const camera = controlledShapeCamera({ observerLatitude: 0, observerWestLongitude: 0, sunLatitude: 0, sunWestLongitude: 0, rangeKm, northAzimuthDegrees: 0,
    pixelAngleMicroradians: SKY_PIXEL_MAS * MAS * 1e6, center: [sx / sw, sy / sw] });
  const fit = (mirror: boolean) => {
    const w = 180, h = 90, map = surfaceLensMap(grid, { width: w, height: h, maximumEmissionDegrees: 70, mirror }), onSky: number[] = [], cast: number[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const value = map[y * w + x]!;
      if (!Number.isFinite(value)) continue;
      const latitude = (90 - (y + 0.5) * 180 / h) * DEGREE, longitude = (x + 0.5) * 360 / w * DEGREE, mu = Math.cos(latitude) * Math.cos(longitude);
      const pixel = camera.project([radiusMeters * Math.cos(latitude) * Math.cos(longitude), radiusMeters * Math.cos(latitude) * Math.sin(longitude), radiusMeters * Math.sin(latitude)]);
      if (!pixel) continue;
      const px = Math.round(pixel[0]), py = Math.round(pixel[1]);
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      onSky.push(topDown(px, py)); cast.push(value * (1 - LIMB * (1 - mu)));
    }
    return { r: correlation(onSky, cast), cells: onSky.length };
  };
  const derived = fit(false), mirrored = fit(true);
  // Measured: 0.978 against 0.238 over 4212 cells within 70 degrees of the sub-observer point.
  assert.ok(derived.cells > 4000);
  assert.ok(derived.r > 0.95, `the derived cast correlates ${derived.r.toFixed(3)} with ROTIR's sky`);
  assert.ok(mirrored.r < 0.5, `the mirrored cast correlates only ${mirrored.r.toFixed(3)}`);
});

test('the written map is the image map the scientific lens reads, with body longitude 0 in the column a camera-cast lens uses', async () => {
  const grid = readSurfaceGrid(await readFile(resolve(fixtures, 'polaris-rotir-grid.fits')));
  const width = 72, height = 36, map = surfaceLensMap(grid, { width, height, maximumEmissionDegrees: 70 });
  const identity = { ORIGIN: 'cssEarth surface-lens.mts', CONTENT: 'ROTIR surface map' };
  const decoded = decodeFitsImageMap(writeFitsImageMap(map, width, height, { name: 'SURFACE BRIGHTNESS', units: 'relative', identity }), {
    path: 'map.fits', sampling: 'nearest', extension: 1, name: 'SURFACE BRIGHTNESS', units: 'relative', primary: identity,
    grid: { width, height, longitudeOrigin: 0, rowOrder: 'north-to-south' } });
  assert.equal(decoded.sample(5, 0), map[17 * width + 1], 'body longitude 5, latitude 0 reads the written cell');
  assert.equal(decoded.sample(180, 0), null, 'the far side is no data');
  // A camera-cast lens puts longitude (x + 1/2) * 360 / width in column x, as the mesh places every atlas; the scientific painter
  // with outputLongitudeOrigin 0 asks for the same longitude at every column.
  const asked: number[] = [];
  paintScienceSurface({ sample: (longitude: number, latitude: number) => { if (latitude > 0 && latitude < 5) asked.push(longitude); return 1; } } as never,
    { minimum: 0, maximum: 2, colors: ['#000000', '#ffffff'], outputLongitudeOrigin: 0 }, width, height);
  assert.equal(asked.length, width);
  asked.forEach((longitude, x) => assert.ok(Math.abs(longitude - (x + 0.5) * 360 / width) < 1e-9, `column ${x} asks ${longitude}`));
});
