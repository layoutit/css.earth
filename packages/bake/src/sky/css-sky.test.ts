import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileCssSky } from './css-sky.ts';
import { validatePreparedCssSky, type PreparedCssVolume } from '@cssearth/objects';
import type { BakedSky } from './bake.ts';
const origin = [1000, -2000, 3000] as const;
const parallax = { originM: origin, metersPerCssPixel: 2 };
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
