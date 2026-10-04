import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparedSkyCameraTransform } from './prepared-sky-runtime.js';
import { validatePreparedSkyParallax } from '@cssearth/objects';
import { type WorldCameraPose } from '@cssearth/engine';
const viewport = { focalPixels: 600, principalOffsetPixels: [17, -11] } as const;
const origin = [1000, -2000, 3000] as const;
const parallax = validatePreparedSkyParallax({ originM: origin, metersPerCssPixel: 2 });
const world = (positionM: WorldCameraPose['pose']['positionM'] = origin,
  orientationXyzw: WorldCameraPose['pose']['orientationXyzw'] = [0, 0, 0, 1]): WorldCameraPose =>
  ({ referenceFrame: 'test-icrf', epochJdTt: 123, pose: { positionM, orientationXyzw } });
function parse(transform: string) {
  const translation = transform.match(/^translate3d\(([^)]+)\)/)![1].split(',').map(n => Number.parseFloat(n));
  const matrix = transform.match(/matrix3d\(([^)]+)\)/)![1].split(',').map(Number);
  return { translation, matrix };
}
function project(transform: string, physicalOffsetCss: readonly number[]) {
  const { translation, matrix } = parse(transform);
  // The prepared geometry has one reflection. This independent CSS projection
  // applies the browser's perspective about the authored principal point.
  const css = [physicalOffsetCss[1], physicalOffsetCss[0], physicalOffsetCss[2]];
  const eye = [0, 1, 2].map(row => translation[row] + matrix[row] * css[0] + matrix[4 + row] * css[1] + matrix[8 + row] * css[2]);
  const scale = viewport.focalPixels / (viewport.focalPixels - eye[2]);
  return [viewport.principalOffsetPixels[0] + (eye[0] - viewport.principalOffsetPixels[0]) * scale,
    viewport.principalOffsetPixels[1] + (eye[1] - viewport.principalOffsetPixels[1]) * scale];
}

test('finite sky origin exactly matches infinite registration for every cardinal camera orientation', () => {
  for (const q of [[0, 0, 0, 1], [0, Math.SQRT1_2, 0, Math.SQRT1_2], [0, 0, Math.SQRT1_2, Math.SQRT1_2], [.5, .5, .5, .5]] as const) {
    assert.equal(preparedSkyCameraTransform(world(origin, q), viewport, parallax), preparedSkyCameraTransform(world(origin, q), viewport));
  }
  assert.equal(preparedSkyCameraTransform(world([1e25, -2e25, 3e25]), viewport), preparedSkyCameraTransform(world(), viewport));
});

test('observer displacement rotates in physical ICRF, then reaches CSS eye space with y reversed', () => {
  const moved = [1020, -1960, 3060] as const;
  // A pose's camera axes are right, up and toward the eye; CSS eye space has y down.
  assert.deepEqual(parse(preparedSkyCameraTransform(world(moved), viewport, parallax)).translation, [7, 9, 570]);
  // World-to-eye for +90 degrees about Z is [dy,-dx,dz], then y reversed.
  assert.deepEqual(parse(preparedSkyCameraTransform(world(moved, [0, 0, Math.SQRT1_2, Math.SQRT1_2]), viewport, parallax)).translation, [-3, -21, 570]);
  // World-to-eye for +90 degrees about Y is [-dz,dy,dx], then y reversed.
  assert.deepEqual(parse(preparedSkyCameraTransform(world(moved, [0, Math.SQRT1_2, 0, Math.SQRT1_2]), viewport, parallax)).translation, [47, 9, 590]);
});

test('a fixed face feature moves under transverse travel and shrinks when the camera moves away', () => {
  const point = [50, 0, -50];
  const initial = project(preparedSkyCameraTransform(world(), viewport, parallax), point);
  assert.deepEqual(initial, [617, -11]);
  const transverse = project(preparedSkyCameraTransform(world([1020, -2000, 3000]), viewport, parallax), point);
  assert.deepEqual(transverse, [497, -11]);
  const away = project(preparedSkyCameraTransform(world([1000, -2000, 3100]), viewport, parallax), point);
  assert.deepEqual(away, [317, -11]);
  assert.equal((away[0] - 17), (initial[0] - 17) / 2);
  const edgeA = project(preparedSkyCameraTransform(world([1000, -2000, 3100]), viewport, parallax), [-50, 0, -50]);
  assert.equal((away[0] - edgeA[0]), 600);
});

test('invalid camera positions, displacement overflow and unvalidated finite scales are rejected', () => {
  for (const position of [[0, 0], [0, 0, NaN], [0, Infinity, 0], [0, 0, '1']]) {
    assert.throws(() => preparedSkyCameraTransform(world(position as unknown as WorldCameraPose['pose']['positionM']), viewport, parallax), /observer/);
  }
  assert.throws(() => preparedSkyCameraTransform(world(), viewport, { ...parallax, metersPerCssPixel: 0 }), /parallax/);
  assert.throws(() => preparedSkyCameraTransform(world([Number.MAX_VALUE, 0, 0]), viewport,
    { originM: [-Number.MAX_VALUE, 0, 0], metersPerCssPixel: 1 }), /displacement/);
});
