import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseTextKernel } from './text-kernel.js';
import { Ephemeris } from './geometry.js';
import { rotation, pckRotation } from './frames.js';
import { spiceCamera, invert, aberrationRotation, pixelModel, type PixelModelKeys } from './camera.js';
import type { SpkSegment } from './spk.js';

// A body whose fixed frame coincides with J2000 (pole at +Z, prime meridian along +X), a camera frame that is J2000
// itself, looking along -Z, and a 100 x 100 detector of 10 µm pixels behind a 1 m focal length: 100,000 px per radian.
const pool = parseTextKernel(`\\begindata
BODY599_POLE_RA  = ( -90.0  0.0  0.0 )
BODY599_POLE_DEC = (  90.0  0.0  0.0 )
BODY599_PM       = (   0.0  0.0  0.0 )
FRAME_ROCK_FIXED = 1599
FRAME_1599_NAME = 'ROCK_FIXED'
FRAME_1599_CLASS = 2
FRAME_1599_CLASS_ID = 599
FRAME_1599_CENTER = 599
FRAME_SC_CAMERA = -900100
FRAME_-900100_NAME = 'SC_CAMERA'
FRAME_-900100_CLASS = 4
FRAME_-900100_CLASS_ID = -900100
TKFRAME_-900100_RELATIVE = 'J2000'
TKFRAME_-900100_SPEC = 'MATRIX'
TKFRAME_-900100_MATRIX = ( 1 0 0  0 1 0  0 0 1 )
INS-900101_FOCAL_LENGTH = ( 1000.0 )
INS-900101_PIXEL_SIZE = ( 10.0 )
INS-900101_DETECTOR_CENTER = ( 49.5, 49.5 )
INS-900101_BORESIGHT = ( 0.0, 0.0, -1.0 )
INS-900101_PIXEL_SAMPLES = ( 100 )
INS-900101_PIXEL_LINES = ( 100 )
INS-900101_FOV_FRAME = 'SC_CAMERA'
\\begintext`, 'camera-test.tf');
const pixels: PixelModelKeys = { focalLength: { key: 'FOCAL_LENGTH', unit: 'mm' }, pixelPitch: { key: 'PIXEL_SIZE', unit: 'micrometre' }, center: 'DETECTOR_CENTER', boresight: 'BORESIGHT',
  samples: 'PIXEL_SAMPLES', lines: 'PIXEL_LINES', frame: 'FOV_FRAME', origin: 0, column: 'X', row: '-Y' };
const segment = (target: number, center: number, at: (et: number) => number[]): SpkSegment =>
  ({ name: `${target}`, target, center, frame: 1, type: 9, start: -1e9, stop: 1e9, state: et => { const s = at(et); return { position: [s[0], s[1], s[2]], velocity: [s[3], s[4], s[5]] }; } });
const rotate = (frame: string | number, et: number) => rotation(pool, frame, et, { pck: (body, at) => pckRotation(pool, body, at) });
const project = (matrix: number[][], p: number[]) => { const h = matrix.map(row => row[0] * p[0] + row[1] * p[1] + row[2] * p[2] + row[3]); return [h[0] / h[2], h[1] / h[2], h[2]]; };
const close = (a: number, b: number, tolerance: number) => Math.abs(a - b) <= tolerance;

function scene({ observerVelocity = [0, 0, 0], targetVelocity = [0, 0, 0] } = {}) {
  return new Ephemeris([
    segment(10, 0, () => [1e8, 0, 0, 0, 0, 0]),
    segment(-99, 0, et => [observerVelocity[0] * et, observerVelocity[1] * et, observerVelocity[2] * et, ...observerVelocity]),
    segment(599, 0, et => [targetVelocity[0] * et, targetVelocity[1] * et, -100 + targetVelocity[2] * et, ...targetVelocity]),
  ]);
}
const request = (ephemeris: Ephemeris, aberration: 'LT+S' | 'LT' | 'NONE') =>
  spiceCamera({ pool, ephemeris, rotation: rotate, observer: -99, target: 599, bodyFrame: 'ROCK_FIXED', instrument: -900101, et: 0, aberration, pixels });

test('the kernel camera projects body-fixed points through the declared pixel axes and inverts its own rays', () => {
  const camera = request(scene(), 'NONE');
  assert.equal(camera.width, 100); assert.equal(camera.height, 100);
  assert.ok(close(camera.report.focalLengthPixels, 100000, 1e-9));
  assert.deepEqual(camera.positionKm.map(v => Math.round(v * 1e9) / 1e9), [0, 0, 100], 'observer 100 km along the body +Z axis');
  const centre = project(camera.matrix, [0, 0, 0]);
  assert.ok(close(centre[0], 49.5, 1e-9) && close(centre[1], 49.5, 1e-9) && close(centre[2], 100, 1e-9), `target centre at the detector centre, 100 km deep: ${centre}`);
  // One kilometre along body +X is 10 mrad off the boresight: 1000 px along stored columns (+X); body +Y runs against stored rows (-Y).
  const east = project(camera.matrix, [1, 0, 0]), north = project(camera.matrix, [0, 1, 0]);
  assert.ok(close(east[0], 1049.5, 1e-6) && close(east[1], 49.5, 1e-9), `${east}`);
  assert.ok(close(north[0], 49.5, 1e-9) && close(north[1], -950.5, 1e-6), `${north}`);
  const ray = camera.rayMatrix.map(row => row[0] * 1049.5 + row[1] * 49.5 + row[2]), n = Math.hypot(...ray), direction = ray.map(v => v / n);
  const expected = [1, 0, -100].map(v => v / Math.hypot(1, 0, 100));
  assert.ok(direction.every((v, i) => close(v, expected[i], 1e-12)), `ray through the projected pixel points back at the point: ${direction}`);
  assert.ok(camera.sunDirection.every((v, i) => close(v, [1, 0, 0][i], 1e-6)), 'Sun along body +X');
  assert.ok(close(camera.report.phaseAngleDegrees, 90, 1e-4));
  assert.throws(() => invert([[1, 2, 3], [2, 4, 6], [0, 0, 1]]), /Singular/);
});

test('light time and stellar aberration move the apparent target as SPICE does', () => {
  // The target drifts +X at 1 km/s: in the 0.3336 ms of light time it moves 0.3336 m, 0.3336 px at 100 km.
  const lt = request(scene({ targetVelocity: [1, 0, 0] }), 'LT'), none = request(scene({ targetVelocity: [1, 0, 0] }), 'NONE');
  assert.ok(close(project(lt.matrix, [0, 0, 0])[0] - project(none.matrix, [0, 0, 0])[0], -0.33356, 1e-3), 'the target is seen where it was one light time ago');
  assert.ok(close(lt.report.lightTimeSeconds, 100 / 299792.458, 1e-12));
  // The observer moves +X at 30 km/s: the apparent direction tilts toward the velocity by v/c, 100.07 µrad, 10.007 px.
  const moving = request(scene({ observerVelocity: [30, 0, 0] }), 'LT+S'), still = request(scene({ observerVelocity: [30, 0, 0] }), 'LT');
  assert.ok(close(project(moving.matrix, [0, 0, 0])[0], 49.5 + 1e5 * 30 / 299792.458, 1e-3), `${project(moving.matrix, [0, 0, 0])}`);
  assert.ok(close(project(still.matrix, [0, 0, 0])[0], 49.5, 1e-6));
  assert.ok(close(moving.report.aberrationMicroradians, 1e6 * 30 / 299792.458, 1e-3));
  const r = aberrationRotation([0, 0, -1], [30, 0, 0]);
  assert.ok(close(r[0][2], -Math.sin(30 / 299792.458), 1e-12) && close(r[2][2], Math.cos(30 / 299792.458), 1e-12), 'rotation of the boresight toward +X');
});

test('a resolved pixel model replaces the kernel keys, and a separate ephemeris epoch moves the observer without turning the camera', () => {
  // The observer drifts +X at 2 km/s. Taken half a second later along its path, it stands 1 km further, so the target falls 1000 px back along the columns.
  const ephemeris = scene({ observerVelocity: [2, 0, 0] }), model = pixelModel(pool, -900101, pixels);
  const base = { pool, ephemeris, rotation: rotate, observer: -99, target: 599, bodyFrame: 'ROCK_FIXED', instrument: -900101, et: 0, aberration: 'NONE' as const };
  const keyed = spiceCamera({ ...base, pixels }), resolved = spiceCamera({ ...base, pixels: model }), later = spiceCamera({ ...base, pixels: model, ephemerisEt: 0.5 });
  assert.deepEqual(resolved.matrix, keyed.matrix); assert.deepEqual(resolved.rayMatrix, keyed.rayMatrix);
  assert.deepEqual(later.rayMatrix, keyed.rayMatrix, 'the pointing is read at et, whatever the ephemeris epoch');
  assert.deepEqual(later.positionKm.map(v => Math.round(v * 1e9) / 1e9), [1, 0, 100]);
  assert.ok(close(project(later.matrix, [0, 0, 0])[0], 49.5 - 1000, 1e-6), `${project(later.matrix, [0, 0, 0])}`);
  // A strip's model moves its optical centre; nothing else about the camera changes.
  const shifted = spiceCamera({ ...base, pixels: { ...model, center: [model.center[0] - 20, model.center[1]] } });
  assert.ok(close(project(shifted.matrix, [0, 0, 0])[0], 29.5, 1e-9));
});
