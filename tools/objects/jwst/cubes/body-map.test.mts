import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { controlledShapeCamera } from '../../terrestrial-layers/shape-camera-mosaic.mts';
import { decodeFitsImageMap } from '../../terrestrial-layers/fits-image-map.mts';
import { bodyMapFits, fitDiscCentre, projectBandMap, topRowFirst } from './body-map.mts';

const camera = { observerLatitude: 0, observerWestLongitude: 90, sunLatitude: 0, sunWestLongitude: 90, rangeKm: 6e8, northAzimuthDegrees: 0, pixelAngleMicroradians: 0.4848, center: [20, 20] as [number, number], phaseDegrees: 0, bodyEpochJd: 0 };
const RADIUS_KM = 1500, radiusPixels = RADIUS_KM / camera.rangeKm / (camera.pixelAngleMicroradians * 1e-6);

test('a blurred disc of known radius is centred to a twentieth of a pixel', () => {
  const size = 41, image = new Float64Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let sum = 0; // a disc at (19.3, 21.6), radius 5, blurred by supersampling a soft edge
    for (let sy = 0; sy < 5; sy++) for (let sx = 0; sx < 5; sx++) sum += 1 / (1 + Math.exp((Math.hypot(x + (sx - 2) / 5 - 19.3, y + (sy - 2) / 5 - 21.6) - 5) / 0.45));
    image[y * size + x] = 100 * sum / 25 + 1;
  }
  const { center, residualOverPeak } = fitDiscCentre(image, size, size, 5);
  assert.ok(Math.abs(center[0] - 19.3) < 0.05 && Math.abs(center[1] - 21.6) < 0.05, `centre ${center}`);
  assert.ok(residualOverPeak < 0.02);
});

test('a spot north-east of the disc centre on the sky lands north and at a larger west longitude on the body', () => {
  const size = 41, depth = new Float64Array(size * size), error = new Float64Array(size * size).fill(0.01), continuum = new Float64Array(size * size).fill(1);
  // The cube is stored bottom row first, north up, east on the first column: north-east of the centre is row 23, column 17.
  depth[23 * size + 17] = 1;
  const map = projectBandMap({ width: size, height: size, depth, error, continuum }, camera, RADIUS_KM, { width: 360, height: 180 }, 80);
  let peak = -1; map.depth.forEach((value, cell) => { if (Number.isFinite(value) && (peak < 0 || value > map.depth[peak]!)) peak = cell; });
  const latitude = 90 - (Math.floor(peak / 360) + 0.5), west = (360 - (peak % 360 + 0.5)) % 360;
  assert.ok(latitude > 20 && latitude < 50, `latitude ${latitude}`);
  // A prograde body's surface moves toward the sky's west, and east longitude grows the way it turns: a spot east of the
  // centre has yet to reach the sub-observer meridian, so its west longitude is over 90°. A mirrored map would give 45°.
  assert.ok(west > 100 && west < 140, `west longitude ${west}`);
  // The same point through the camera the photograph lenses use.
  const pixel = controlledShapeCamera(camera).project([Math.cos(latitude * Math.PI / 180) * Math.cos(-west * Math.PI / 180), Math.cos(latitude * Math.PI / 180) * Math.sin(-west * Math.PI / 180), Math.sin(latitude * Math.PI / 180)].map(v => v * RADIUS_KM * 1000))!;
  assert.ok(Math.abs(pixel[0]! - 17) < 1 && Math.abs(pixel[1]! - (size - 1 - 23)) < 1, `pixel ${pixel}`);
  assert.ok(radiusPixels > 5 && map.areaShare > 0.3 && map.areaShare < 0.5);
  assert.deepEqual([...topRowFirst(Float64Array.from([1, 2, 3, 4]), 2, 2)], [3, 4, 1, 2]);
});

test('the written map is read back by the scalar-map reader, north first, east longitude from zero', () => {
  const values = new Float32Array(8 * 4).fill(NaN); values[1 * 8 + 6] = 0.25;
  const bytes = bodyMapFits({ width: 8, height: 4 }, { TELESCOP: 'JWST' }, [{ name: 'DEPTH', units: 'band depth', values }]);
  const map = decodeFitsImageMap(bytes, { path: 'x.fits', sampling: 'nearest', extension: 1, name: 'DEPTH', units: 'band depth', primary: { TELESCOP: 'JWST' }, grid: { width: 8, height: 4, longitudeOrigin: 0, rowOrder: 'north-to-south' } });
  assert.equal(map.sample(292.5, 22.5), 0.25); assert.equal(map.sample(10, 22.5), null);
});
