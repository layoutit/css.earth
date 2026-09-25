import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { parseTextKernel } from './text-kernel.mts';
import { pckRotation, rotation, rotate, tkFrameRotation, frameDefinition } from './frames.mts';
import { apply, multiply, transpose } from '@cssearth/spice';

const pool = parseTextKernel(`\\begindata
BODY999_POLE_RA  = ( 30.0  0.0  0.0 )
BODY999_POLE_DEC = ( 60.0  0.0  0.0 )
BODY999_PM       = ( 10.0  360.0  0.0 )
FRAME_ROCK_FIXED = 1999
FRAME_1999_NAME = 'ROCK_FIXED'
FRAME_1999_CLASS = 2
FRAME_1999_CLASS_ID = 999
FRAME_1999_CENTER = 999
FRAME_SC_BUS = -900000
FRAME_-900000_NAME = 'SC_BUS'
FRAME_-900000_CLASS = 3
FRAME_-900000_CLASS_ID = -900000
FRAME_SC_CAMERA = -900100
FRAME_-900100_NAME = 'SC_CAMERA'
FRAME_-900100_CLASS = 4
FRAME_-900100_CLASS_ID = -900100
TKFRAME_-900100_RELATIVE = 'SC_BUS'
TKFRAME_-900100_SPEC = 'ANGLES'
TKFRAME_-900100_UNITS = 'DEGREES'
TKFRAME_-900100_AXES = ( 3, 1, 3 )
TKFRAME_-900100_ANGLES = ( 90.0, 0.0, 0.0 )
FRAME_SC_MATRIX = -900200
FRAME_-900200_NAME = 'SC_MATRIX'
FRAME_-900200_CLASS = 4
FRAME_-900200_CLASS_ID = -900200
TKFRAME_-900200_RELATIVE = 'J2000'
TKFRAME_-900200_SPEC = 'MATRIX'
TKFRAME_-900200_MATRIX = ( 0 1 0  -1 0 0  0 0 1 )
\\begintext`, 'test.tf');
const close = (a: readonly (readonly number[])[], b: readonly (readonly number[])[], tolerance = 1e-12) => a.every((row, i) => row.every((v, j) => Math.abs(v - b[i][j]) < tolerance));

test('a PCK pole model turns the north pole direction into the body Z axis and spins by the prime meridian', () => {
  const m = pckRotation(pool, 999, 0), rad = Math.PI / 180;
  const pole = [Math.cos(60 * rad) * Math.cos(30 * rad), Math.cos(60 * rad) * Math.sin(30 * rad), Math.sin(60 * rad)];
  const z = apply(m, pole);
  assert.ok(Math.abs(z[0]) < 1e-12 && Math.abs(z[1]) < 1e-12 && Math.abs(z[2] - 1) < 1e-12, 'pole maps to +Z');
  // One day later the prime meridian has advanced a full turn: the rotation repeats.
  assert.ok(close(pckRotation(pool, 999, 86400), m), 'PM rate of 360°/day');
  const half = pckRotation(pool, 999, 43200), x = apply(half, apply(transpose(m), [1, 0, 0]));
  assert.ok(Math.abs(x[0] + 1) < 1e-12, 'half a day later body X points the other way');
});

test('fixed-offset frames list the frame-to-relative rotation by angles or column-major matrix; CK frames chain through their reference', () => {
  const camera = tkFrameRotation(pool, frameDefinition(pool, 'SC_CAMERA'));
  assert.equal(camera.relative, 'SC_BUS');
  assert.ok(close(camera.matrix, rotate(Math.PI / 2, 3)));
  const matrixFrame = tkFrameRotation(pool, frameDefinition(pool, 'SC_MATRIX'));
  assert.ok(close(matrixFrame.matrix, [[0, -1, 0], [1, 0, 0], [0, 0, 1]]), 'kernel matrices are listed by column');
  // The listed matrix maps camera vectors into the bus (V_relative = M * V_frame), so the bus-to-camera rotation is its transpose.
  const cameraX = apply(matrixFrame.matrix, [1, 0, 0]);
  assert.ok(Math.abs(cameraX[0]) < 1e-12 && Math.abs(cameraX[1] - 1) < 1e-12, 'frame +X lies along relative +Y');
  const bus = rotate(Math.PI / 4, 3);
  const providers = { ck: (instrument: number, et: number) => instrument === -900000 && et === 5 ? { cMatrix: bus, reference: 1 } : null, pck: (body: number, et: number) => pckRotation(pool, body, et) };
  assert.ok(close(rotation(pool, 'SC_CAMERA', 5, providers), multiply(transpose(rotate(Math.PI / 2, 3)), bus)));
  assert.ok(close(rotation(pool, 'SC_MATRIX', 5, providers), transpose(matrixFrame.matrix)));
  assert.ok(close(rotation(pool, 'ROCK_FIXED', 0, providers), pckRotation(pool, 999, 0)));
  assert.ok(close(rotation(pool, 'J2000', 5, providers), [[1, 0, 0], [0, 1, 0], [0, 0, 1]]));
  assert.throws(() => rotation(pool, 'SC_CAMERA', 6, providers), /No CK pointing/);
  assert.throws(() => rotation(pool, 'NOPE', 0, providers), /Unknown frame/);
});
