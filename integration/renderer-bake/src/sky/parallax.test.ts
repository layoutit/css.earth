import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { compileCssSky } from '@cssearth/bake/sky';
import { preparedSkyCameraTransform } from '@cssearth/renderer/sky/prepared-sky-runtime.ts';
import { validatePreparedCssSky, type PreparedCssVolume } from '@cssearth/objects';
import { type WorldCameraPose } from '@cssearth/engine';
import type { BakedSky } from '@cssearth/bake/sky';

const viewport = { focalPixels: 600, principalOffsetPixels: [17, -11] } as const;
const origin = [1000, -2000, 3000] as const;
const parallax = { originM: origin, metersPerCssPixel: 2 };
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

const frame: PreparedCssVolume['frame'] = { referenceFrame: 'test-icrf', epochJdTt: 123, originM: [0, 0, 0],
  localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
function bakedFixture(): BakedSky {
  const bases = [
    ['px', [1, 0, 0], [0, -1, 0], [0, 0, 1]], ['nx', [-1, 0, 0], [0, 1, 0], [0, 0, 1]],
    ['py', [0, 1, 0], [1, 0, 0], [0, 0, 1]], ['ny', [0, -1, 0], [-1, 0, 0], [0, 0, 1]],
    ['pz', [0, 0, 1], [0, -1, 0], [-1, 0, 0]], ['nz', [0, 0, -1], [0, -1, 0], [1, 0, 0]],
  ] as const;
  return { faces: bases.map(([id, f, r, u]) => ({ id, forwardIcrf: [...f], rightIcrf: [...r], upIcrf: [...u],
    texturePath: `sky/${id}.webp`, widthPx: 8, heightPx: 8, bytes: 100,
    vertices: [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => f.map((n, i) => n + x * r[i] + y * u[i]) as [number, number, number]),
    uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
  })), provenance: {}, approximation: {} };
}

test('compiler forwards finite placement and explicit metres per CSS pixel without changing any prepared face or image', () => {
  const baked = bakedFixture(), infinite = compileCssSky(baked, frame);
  assert.equal(('parallax' in infinite.sky), false);
  const finite = compileCssSky({ ...baked, parallax: { originM: [...origin], radiusM: 100 } }, frame);
  assert.deepEqual(finite.sky.parallax, parallax);
  assert.deepEqual(finite.sky.faces, infinite.sky.faces);
  assert.deepEqual(finite.resources, infinite.resources);
  assert.equal(validatePreparedCssSky(finite.sky, finite.resources), finite.sky);
  for (const bad of [null, {}, { originM: [0, 0], metersPerCssPixel: 2 }, { originM: [0, NaN, 0], metersPerCssPixel: 2 },
    { originM: [0, 0, 0], metersPerCssPixel: 0 }, { originM: [0, 0, 0], metersPerCssPixel: -1 },
    { originM: [0, 0, 0], metersPerCssPixel: Infinity }, { ...parallax, radiusM: 100 }]) {
    assert.throws(() => validatePreparedCssSky({ ...finite.sky, parallax: bad }, finite.resources), /parallax/);
  }
  assert.throws(() => validatePreparedCssSky({ ...finite.sky, parallaxExtra: true }, finite.resources), /unsupported/);
});

test('invalid camera positions, displacement overflow and unvalidated finite scales are rejected', () => {
  for (const position of [[0, 0], [0, 0, NaN], [0, Infinity, 0], [0, 0, '1']]) {
    assert.throws(() => preparedSkyCameraTransform(world(position as unknown as WorldCameraPose['pose']['positionM']), viewport, parallax), /observer/);
  }
  assert.throws(() => preparedSkyCameraTransform(world(), viewport, { ...parallax, metersPerCssPixel: 0 }), /parallax/);
  assert.throws(() => preparedSkyCameraTransform(world([Number.MAX_VALUE, 0, 0]), viewport,
    { originM: [-Number.MAX_VALUE, 0, 0], metersPerCssPixel: 1 }), /displacement/);
});

test('faces are built at half their texture size and still land on the same cube corners', () => {
  // Corners of every face as compiled at full texture size (before the density change): the leaf must shrink, the cube must not move.
  const corners: Record<string, number[][]> = {"px": [[50.6, 50, 50.6], [-50.6, 50, 50.6], [-50.6, 50, -50.6], [50.6, 50, -50.6]], "nx": [[-50.6, -50, 50.6], [50.6, -50, 50.6], [50.6, -50, -50.6], [-50.6, -50, -50.6]], "py": [[50, -50.6, 50.6], [50, 50.6, 50.6], [50, 50.6, -50.6], [50, -50.6, -50.6]], "ny": [[-50, 50.6, 50.6], [-50, -50.6, 50.6], [-50, -50.6, -50.6], [-50, 50.6, -50.6]], "pz": [[50.6, -50.6, 50], [-50.6, -50.6, 50], [-50.6, 50.6, 50], [50.6, 50.6, 50]], "nz": [[50.6, 50.6, -50], [-50.6, 50.6, -50], [-50.6, -50.6, -50], [50.6, -50.6, -50]]};
  const baked = bakedFixture(), { sky } = compileCssSky(baked, frame);
  for (const face of sky.faces) {
    const m = face.style.transform.match(/matrix3d\(([^)]+)\)/)![1].split(',').map(Number);
    const w = Number.parseFloat(face.style.width), h = Number.parseFloat(face.style.height);
    assert.deepEqual(([w, h]), [face.widthPx / 2, face.heightPx / 2]);
    assert.equal(face.style.backgroundSize, `${w}px ${h}px`);
    const map = (x: number, y: number) => [0, 1, 2].map(row => m[row]! * x + m[4 + row]! * y + m[12 + row]!);
    [map(0, 0), map(w, 0), map(w, h), map(0, h)].forEach((point, i) => point.forEach((n, axis) => assert.ok(Math.abs(n - (corners[face.id]![i]![axis]!)) < 10 ** -9 / 2, `${n} is not close to ${corners[face.id]![i]![axis]!}`)));
  }
});
