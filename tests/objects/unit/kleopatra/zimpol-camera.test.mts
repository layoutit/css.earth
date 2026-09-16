/**
 * Every controlled-shape camera field in Kleopatra's SPHERE photograph lens is recomputed here from the pinned
 * inputs and compared against the recipe. Without this the recipe's eight numbers per frame are hand-copied
 * constants and the module that derives them never runs, so "computed from the survey's own rotation record" would
 * be a claim about code the build does not execute.
 *
 * What is derived: the sub-observer and sub-solar points, the range, and the north azimuth.
 * What is measured from the photograph, and so is not derived: the disc centre and the sky threshold.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { observerCamera, parseSpinState } from '../../../../tools/objects/terrestrial-layers/observer-camera.mts';
import { readFitsHdu } from '../../../../tools/fits.mts';
import { requireArray, requireRecord, requireFiniteNumber, requireString } from '../../../../tools/source-values.mts';

const BODY = resolve(import.meta.dirname, '../../../../src/objects/kleopatra');
const AU_KM = 1.495978707e8;
const readJson = async (path: string) => JSON.parse(await readFile(resolve(BODY, path), 'utf8')) as unknown;

/** The rows of a Horizons table, between its own start and end markers. */
function horizonsRows(text: string) {
  const start = text.indexOf('$$SOE'), end = text.indexOf('$$EOE');
  if (start < 0 || end < 0) throw new Error('Pinned Horizons response has no data block.');
  return text.slice(start, end).split('\n').slice(1).map(line => line.trimEnd()).filter(line => line.trim().length > 0);
}
const numbers = (line: string) => (line.match(/-?\d+\.\d+(?:E[+-]\d+)?/g) ?? []).map(Number);

test('the lens recipe states the camera the pinned inputs imply', async () => {
  const recipe = requireRecord(await readJson('source/preparation/terrestrial.json'));
  const raster = requireRecord(recipe.raster), lenses = requireArray(raster.surfaceObservations);
  const lens = requireRecord(lenses.find(entry => requireRecord(entry).id === 'zimpol'));
  const frames = requireArray(lens.frames);
  assert.equal(frames.length, 5, 'the lens states five frames');

  // Kleopatra's parameter record is latitude first; that column order is established against a published pole,
  // because the survey's files do not share one. Reading it the other way is refused by the parser for this file.
  const spin = parseSpinState(await readFile(resolve(BODY, 'source/reference/216_Kleopatra_param.txt'), 'utf8'), 'latitude-first');

  const observer = horizonsRows(await readFile(resolve(BODY, 'source/reference/horizons-sphere-observer.txt'), 'utf8'));
  const heliocentric = horizonsRows(await readFile(resolve(BODY, 'source/reference/horizons-sphere-heliocentric.txt'), 'utf8'))
    .filter(line => line.trimStart().startsWith('X ='));
  assert.equal(observer.length, 7, 'the pinned observer table covers both apparitions');
  assert.equal(heliocentric.length, 7, 'the pinned heliocentric table covers both apparitions');

  for (const [index, raw] of frames.entries()) {
    const frame = requireRecord(raw), id = requireString(frame.id);
    // The pinned tables are in the survey's own time order; the lens uses the first five, the 2017 apparition.
    const sky = numbers(observer[index].slice(25).replace(/^\s*[a-zA-Z*]{1,2}\s+/, ' '));
    const [rightAscension, declination, , rangeAu] = sky;
    const [sunX, sunY, sunZ] = numbers(heliocentric[index]);
    const magnitude = Math.hypot(sunX, sunY, sunZ);

    const camera = observerCamera({
      epochJd: await epochFromHeader(requireString(frame.path)),
      targetRightAscensionDegrees: rightAscension, targetDeclinationDegrees: declination, rangeAu,
      // Horizons reports the body's position from the Sun, so the direction to the Sun is its negative.
      sunRightAscensionDegrees: (Math.atan2(-sunY, -sunX) * 180 / Math.PI + 360) % 360,
      sunDeclinationDegrees: Math.asin(-sunZ / magnitude) * 180 / Math.PI,
      pixelAngleMicroradians: requireFiniteNumber(frame.pixelAngleMicroradians, `${id} pixel angle`),
      center: [0, 0],
    }, spin);

    const close = (actual: number, stated: unknown, tolerance: number, what: string) =>
      assert.ok(Math.abs(((actual - requireFiniteNumber(stated, what) + 540) % 360) - 180) <= tolerance,
        `${id} ${what}: recipe states ${String(stated)}, the pinned inputs give ${actual}`);
    close(camera.observerLatitude, frame.observerLatitude, 0.01, 'sub-observer latitude');
    close(camera.observerWestLongitude, frame.observerWestLongitude, 0.01, 'sub-observer west longitude');
    close(camera.sunLatitude, frame.sunLatitude, 0.01, 'sub-solar latitude');
    close(camera.sunWestLongitude, frame.sunWestLongitude, 0.01, 'sub-solar west longitude');
    close(camera.northAzimuthDegrees, frame.northAzimuthDegrees, 0.01, 'north azimuth');
    assert.ok(Math.abs(camera.rangeKm - requireFiniteNumber(frame.rangeKm, 'range')) < 10, `${id} range`);
    assert.ok(Math.abs(rangeAu * AU_KM - camera.rangeKm) < 1, `${id} range follows the pinned distance`);
  }
});

/**
 * The exposure epoch as a Julian date, from the frame's own DATE-OBS. The recipe's frame id carries whole seconds
 * only, and this body turns 0.01 degrees in the half second that truncation would discard, so the header owns it.
 */
async function epochFromHeader(path: string) {
  const { header } = readFitsHdu(await readFile(resolve(BODY, 'source', path)));
  const stated = String(header['DATE-OBS'] ?? '').replace(/^'|'$/g, '').trim();
  const match = stated.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$/);
  if (!match) throw new Error(`Frame ${path} states no usable exposure time: ${stated}`);
  const [, year, month, day, hour, minute, second] = match;
  const whole = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), 0);
  return whole / 86_400_000 + 2440587.5 + Number(second) / 86_400;
}

test('the sub-observer and sub-solar points are consistent with the phase angle Horizons reports', async () => {
  // An independent check of the derived geometry: the angle between the two sub-points on the body must equal the
  // solar phase angle in the pinned table. This is invariant under the longitude mirror, so it proves the
  // ephemeris handling rather than the frame handedness; the recipe comparison above covers that.
  const recipe = requireRecord(await readJson('source/preparation/terrestrial.json'));
  const lens = requireRecord(requireArray(requireRecord(recipe.raster).surfaceObservations)[0]);
  const observer = horizonsRows(await readFile(resolve(BODY, 'source/reference/horizons-sphere-observer.txt'), 'utf8'));
  const degree = Math.PI / 180;
  for (const [index, raw] of requireArray(lens.frames).entries()) {
    const frame = requireRecord(raw);
    const stated = numbers(observer[index].slice(25).replace(/^\s*[a-zA-Z*]{1,2}\s+/, ' '))[5];
    const point = (latitude: unknown, longitude: unknown) => {
      const b = requireFiniteNumber(latitude, 'latitude') * degree, l = requireFiniteNumber(longitude, 'longitude') * degree;
      return [Math.cos(b) * Math.cos(l), Math.cos(b) * Math.sin(l), Math.sin(b)];
    };
    const a = point(frame.observerLatitude, frame.observerWestLongitude), s = point(frame.sunLatitude, frame.sunWestLongitude);
    const phase = Math.acos(Math.max(-1, Math.min(1, a[0] * s[0] + a[1] * s[1] + a[2] * s[2]))) / degree;
    assert.ok(Math.abs(phase - stated) < 0.05, `${String(frame.id)} phase: recipe implies ${phase}, Horizons reports ${stated}`);
  }
});
