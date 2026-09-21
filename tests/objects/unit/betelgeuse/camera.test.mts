/**
 * Every controlled-shape camera field in Betelgeuse's MATISSE lens is recomputed here from the pinned inputs and compared
 * against the recipe, through the same observer-camera transform the asteroid photographs use. What is derived: the
 * sub-observer and sub-solar points, the range, and the north azimuth. What is measured from the reconstruction, and so is
 * not derived: the disc centre (its flux centroid) and the sky threshold.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { observerCamera, type BodyOrientation } from '../../../../tools/objects/terrestrial-layers/observer-camera.mts';
import { readFitsImage } from '../../../../tools/fits.mts';
import { skyImageAxes } from '../../../../tools/fits-sky.mts';
import { requireArray, requireRecord, requireFiniteNumber, requireString } from '../../../../tools/source-values.mts';

const BODY = resolve(import.meta.dirname, '../../../../src/objects/betelgeuse');
const ASTRONOMY = resolve(import.meta.dirname, '../../../../packages/astronomy/data/bodies/betelgeuse.json');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as unknown;
const DEGREE = Math.PI / 180, PARSEC_AU = 648000 / Math.PI, MAS_RAD = DEGREE / 3.6e6;
const direction = (ra: number, dec: number) => [Math.cos(dec * DEGREE) * Math.cos(ra * DEGREE), Math.cos(dec * DEGREE) * Math.sin(ra * DEGREE), Math.sin(dec * DEGREE)];

for (const lensId of ['matisse', 'matisse-2018-12', 'matisse-2020-12']) test(`the ${lensId} lens states the camera the pinned astrometry and pole imply`, async () => {
  const recipe = requireRecord(await readJson(resolve(BODY, 'source/preparation/raster.json')));
  const surface = requireRecord(requireArray(recipe.surfaces).find(entry => requireRecord(entry).id === lensId));
  const lens = requireRecord(requireRecord(surface.science).lens);
  const frames = requireArray(lens.frames);
  assert.equal(frames.length, 1, 'the lens states one reconstructed frame');
  const frame = requireRecord(frames[0]);
  const star = requireRecord(requireRecord(await readJson(ASTRONOMY)).star);
  const rotation = requireRecord(await readJson(resolve(BODY, 'source/preparation/rotation.json')));
  const measurements = requireRecord(await readJson(resolve(BODY, 'source/measurements.json')));

  // The pole: in the plane of the sky at the ALMA position angle, so its dot product with the line of sight is zero.
  const ra = requireFiniteNumber(star.rightAscensionDegrees), dec = requireFiniteNumber(star.declinationDegrees);
  const toStar = direction(ra, dec), pole = direction(requireFiniteNumber(rotation.rightAscensionDegrees), requireFiniteNumber(rotation.declinationDegrees));
  assert.ok(Math.abs(pole[0] * toStar[0] + pole[1] * toStar[1] + pole[2] * toStar[2]) < 1e-9, 'the pole lies in the plane of the sky');
  const east = [-Math.sin(ra * DEGREE), Math.cos(ra * DEGREE), 0], north = [-Math.sin(dec * DEGREE) * Math.cos(ra * DEGREE), -Math.sin(dec * DEGREE) * Math.sin(ra * DEGREE), Math.cos(dec * DEGREE)];
  const positionAngle = Math.atan2(pole[0] * east[0] + pole[1] * east[1] + pole[2] * east[2], pole[0] * north[0] + pole[1] * north[1] + pole[2] * north[2]) / DEGREE;
  assert.ok(Math.abs(positionAngle - 48.0) < 1e-6, `the pole position angle is the ALMA 48.0 degrees, got ${positionAngle}`);

  // The mesh frame: +z on the pole, +x toward the observer at the epoch (the sub-Earth point is the display meridian).
  const x = toStar.map(n => -n), z = pole, y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const orientation: BodyOrientation = { rotation: () => [x, y, z] as unknown as ReturnType<BodyOrientation['rotation']>, phaseDegrees: () => 0 };
  const framePath = requireString(frame.path);
  const image = readFitsImage(await readFile(resolve(BODY, framePath.startsWith('observations') ? `source/${framePath}` : framePath)));
  const pixelAngleMicroradians = skyImageAxes(image.header).scale[0] * MAS_RAD * 1e6;
  const rangeAu = requireFiniteNumber(star.distanceParsecs) * PARSEC_AU;
  const camera = observerCamera({ epochJd: 2458887.0087, targetRightAscensionDegrees: ra, targetDeclinationDegrees: dec,
    // The Sun lies within a thousandth of a degree of the observer as seen from 168 parsecs: the antipode of the star's direction.
    sunRightAscensionDegrees: (ra + 180) % 360, sunDeclinationDegrees: -dec, rangeAu, pixelAngleMicroradians,
    center: [requireFiniteNumber(requireArray(frame.center)[0]), requireFiniteNumber(requireArray(frame.center)[1])] }, orientation);
  for (const key of ['observerLatitude', 'observerWestLongitude', 'sunLatitude', 'sunWestLongitude', 'northAzimuthDegrees'] as const) {
    const stated = requireFiniteNumber(frame[key]), expected = camera[key];
    assert.ok(Math.abs(((stated - expected + 180) % 360 + 360) % 360 - 180) < 1e-6, `${key}: recipe ${stated}, derived ${expected}`);
  }
  assert.ok(Math.abs(requireFiniteNumber(frame.rangeKm) - camera.rangeKm) < 1, `range: recipe ${frame.rangeKm}, derived ${camera.rangeKm}`);
  assert.ok(Math.abs(requireFiniteNumber(frame.pixelAngleMicroradians) - camera.pixelAngleMicroradians) < 1e-12, 'pixel angle from the image header');

  // The disc centre is the flux centroid of the reconstruction, in top-down rows as the decoder presents it.
  const { width, height, values } = image;
  let sx = 0, sy = 0, sw = 0;
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) { const v = values[row * width + col]; if (v > 0) { sx += col * v; sy += row * v; sw += v; } }
  const centroid = [sx / sw, height - 1 - sy / sw];
  const center = requireArray(frame.center).map(n => requireFiniteNumber(n));
  assert.ok(Math.abs(centroid[0] - center[0]) < 0.01 && Math.abs(centroid[1] - center[1]) < 0.01, `centre: recipe ${center}, centroid ${centroid}`);

  // The disc the reconstruction shows is the measured angular diameter: half its flux within the 42.45 mas disc's radius.
  const diameterPixels = requireFiniteNumber(measurements.angularDiameterMas) / skyImageAxes(image.header).scale[0];
  let inside = 0;
  for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) {
    if (Math.hypot(col - centroid[0], height - 1 - row - centroid[1]) <= diameterPixels / 2) inside += values[row * width + col];
  }
  assert.ok(inside / sw > 0.8 && inside / sw < 1, `${(inside / sw * 100).toFixed(1)}% of the reconstructed flux lies within the measured disc`);
});
