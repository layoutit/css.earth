import assert from 'node:assert/strict';
import test from 'node:test';
import { compileCssSky, SKY_BASES, skyRay, type BakedSky } from '@cssearth/bake/sky';
import { faceWeights, guardedPixel, opticalBytes, samplePanorama, type FacePixels } from './seams.mts';
import { assertNativeRays, extendPreparedFace } from './geometry.mts';

const size = 256, gutter = 4, extent = 1 + 2 * gutter / size;
const fixture = (alpha: number): FacePixels[] => SKY_BASES.map(basis => {
  const rgba = new Uint8Array(size * size * 4);
  for (let p = 0; p < size * size; p++) rgba.set([197, 213, 241, alpha], p * 4);
  return { basis, size, rgba };
});

test('compiled expanded planes preserve native picture rays at the original cube radius', () => {
  const frame = { referenceFrame: 'test-icrf', epochJdTt: 123, originM: [0, 0, 0] as const, localToReferenceXyzw: [0, 0, 0, 1] as const,
    metersPerUnit: 1, boundsUnits: { min: [-1, -1, -1] as const, max: [1, 1, 1] as const } };
  const baked: BakedSky = { faces: SKY_BASES.map(basis => ({ ...basis, texturePath: `sky/${basis.id}.webp`, widthPx: size, heightPx: size, bytes: 100,
    vertices: [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([u, v]) => [0, 1, 2].map(axis => 100000 * (basis.forwardIcrf[axis]! + u! * basis.rightIcrf[axis]! + v! * basis.upIcrf[axis]!)) as [number, number, number]),
    uvs: [[0, 0], [1, 0], [1, 1], [0, 1]] })), provenance: {}, approximation: {} };
  const compiled = compileCssSky(baked, frame);
  for (const face of compiled.sky.faces) {
    const before = { ...face, id: `cirrus-native-${face.id}`, centerUnits: [0, 0, 0] as const };
    const result = extendPreparedFace(before, `next/${face.id}.webp`, gutter);
    assert.equal(result.leaf.widthPx, 264); assert(result.maximumNativeRayErrorCssWorld < 1e-6);
    // Keeping the old butted geometry underneath a newly padded image must fail.
    assert.throws(() => assertNativeRays(before, { ...result.leaf, style: before.style }, gutter), /Native picture ray moved/);
  }
});

test('old cube edges and three-way corners lie inside multiple supports, with zero signal before new outer edges', () => {
  for (const [i, basis] of SKY_BASES.entries()) {
    assert.equal(faceWeights(basis.forwardIcrf, size, gutter)[i], 1);
    for (const sign of [-1, 1]) {
      const shared = faceWeights(skyRay(basis, sign, 0), size, gutter);
      assert.equal([...shared].filter(value => value > 0).length, 2);
      assert.equal(shared[i], .5);
      const corner = faceWeights(skyRay(basis, sign, sign), size, gutter);
      assert.equal([...corner].filter(value => value > 0).length, 3);
      assert(Math.abs(corner[i]! - 1 / 3) < 1e-12);
      // A formerly visible hard edge is now a nonzero interior. The new physical
      // edge and its final full source-texel guard carry no emission or extinction.
      assert(faceWeights(skyRay(basis, sign * (1 + 2 / size), 0), size, gutter)[i]! > 0);
      assert.equal(faceWeights(skyRay(basis, sign * (extent - .5 / size), 0), size, gutter)[i], 0);
      assert.equal(faceWeights(skyRay(basis, sign * extent, 0), size, gutter)[i], 0);
    }
  }
});

test('joint face opacities preserve source-over transmission at faint edges and corners without double light', () => {
  for (const alpha of [0, 1 / 255, 2 / 255, 13 / 255, 23 / 255, 50 / 255, .5, .98, 1])
    for (const direction of [[1, 0, 1], [1, 1, 1], [1, .99, .98], [-1, -.99, 1], [1, 0, 0]] as const) {
      const weights = faceWeights(direction, size, gutter), bytes = opticalBytes(alpha, weights);
      const composite = 1 - [...bytes].reduce((transmission, value) => transmission * (1 - value / 255), 1);
      assert(Math.abs(composite - alpha) <= .5 / 255 + 1e-12, `${alpha} became ${composite}`);
      weights.forEach((weight, i) => { if (!weight) assert.equal(bytes[i], 0); });
    }
});

test('all expanded faces sample one common angular color and keep the unchanged central native pixels', () => {
  const faces = fixture(23);
  for (const basis of SKY_BASES) {
    const weights = faceWeights(basis.forwardIcrf, size, gutter), common = samplePanorama(faces, basis.forwardIcrf, weights);
    assert(Math.abs(common[3] - 23 / 255) < 1e-12);
  }
  for (let i = 0; i < faces.length; i++) {
    assert.deepEqual(guardedPixel(faces, i, SKY_BASES[i]!.forwardIcrf, gutter), [197, 213, 241, 23]);
    for (const coordinate of [-extent + 1 / size, extent - 1 / size]) assert.equal(guardedPixel(faces, i, skyRay(SKY_BASES[i]!, coordinate, 0), gutter)[3], 0);
  }
  const around = [-1e-7, 0, 1e-7].map(delta => samplePanorama(faces, [1, 0, 1 + delta], faceWeights([1, 0, 1 + delta], size, gutter)));
  around.forEach(pixel => pixel.forEach((value, c) => assert(Math.abs(value - around[1]![c]!) < 1e-12)));
});
