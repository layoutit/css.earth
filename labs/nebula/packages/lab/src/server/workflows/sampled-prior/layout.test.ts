import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeSliceLayout, padComponentSlice, type RegisteredSlice } from './layout.ts';

type Vec = [number, number, number];
function point(origin: Vec, u: Vec, v: Vec, x: number, y: number): Vec {
  return [origin[0] + u[0] * x + v[0] * y, origin[1] + u[1] * x + v[1] * y, origin[2] + u[2] * x + v[2] * y];
}
function quad(id: string, width: number, height: number, origin: Vec, u: Vec, v: Vec): RegisteredSlice {
  return { id, widthPx: width, heightPx: height, vertices: [origin, point(origin, u, v, width, 0),
    point(origin, u, v, width, height), point(origin, u, v, 0, height)], texturePath: `slices/${id[0]}/7.png`,
    sha256: 'a'.repeat(64), bytes: width * height * 4 };
}
const origin: Vec = [10, 20, 30];
const raster = Buffer.from([
  11, 12, 13, 14, 21, 22, 23, 24,
  31, 32, 33, 34, 41, 42, 43, 0,
  51, 52, 53, 54, 61, 62, 63, 255,
]);

test('shifted spectral crops preserve every RGBA byte on all three oriented planes', () => {
  const planes: { id: string; u: Vec; v: Vec }[] = [
    { id: 'x-7', u: [0, 2, 0], v: [0, 0, -3] },
    { id: 'y-7', u: [-2, 0, 0], v: [0, 0, -3] },
    { id: 'z-7', u: [-2, 0, 0], v: [0, -3, 0] },
  ];
  for (const { id, u, v } of planes) {
    const reference = quad(id, 6, 5, origin, u, v), component = quad(id, 2, 3, point(origin, u, v, 2, 1), u, v);
    const before = Buffer.from(raster), actual = padComponentSlice(reference, component, raster);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) {
      const at = (y * 6 + x) * 4, within = x >= 2 && x < 4 && y >= 1 && y < 4;
      const sourceAt = ((y - 1) * 2 + x - 2) * 4;
      assert.deepEqual(actual.subarray(at, at + 4), within ? raster.subarray(sourceAt, sourceAt + 4) : Buffer.alloc(4));
    }
    assert.deepEqual(raster, before, 'Padding must never modify the acquired component raster.');
  }
});

test('same-size component is copied exactly and missing or transparent planes remain transparent', () => {
  const reference = quad('z-7', 2, 3, origin, [1, 0, 0], [0, 1, 0]);
  assert.deepEqual(padComponentSlice(reference, reference, raster), raster);
  assert.deepEqual(padComponentSlice(reference, undefined), Buffer.alloc(24));
  const invisible = Buffer.from(raster); for (let i = 3; i < invisible.length; i += 4) invisible[i] = 0;
  assert.deepEqual(padComponentSlice(reference, reference, invisible), Buffer.alloc(24));
});

test('nonempty pixels outside any crop edge fail instead of being clipped', () => {
  const u: Vec = [1, 0, 0], v: Vec = [0, 1, 0], reference = quad('z-7', 6, 5, origin, u, v);
  for (const [x, y] of [[-1, 1], [5, 1], [1, -1], [1, 3]]) {
    const component = quad('z-7', 2, 3, point(origin, u, v, x!, y!), u, v);
    assert.throws(() => padComponentSlice(reference, component, raster), /canonical union crop/);
  }
});

test('padding rejects resampling, reversed rows, noninteger offsets and another physical plane', () => {
  const u: Vec = [1, 0, 0], v: Vec = [0, 1, 0], reference = quad('z-7', 6, 5, origin, u, v);
  for (const component of [
    quad('z-7', 2, 3, point(origin, u, v, 1.5, 1), u, v),
    quad('z-7', 2, 3, point(origin, u, v, 1, 1), [1.01, 0, 0], v),
    quad('z-7', 2, 3, point(origin, u, v, 1, 4), u, [0, -1, 0]),
    quad('z-7', 2, 3, [11, 21, 30.1], u, v),
  ]) assert.throws(() => padComponentSlice(reference, component, raster), /canonical union crop/);
});

test('plane identities and decoded raster dimensions must match', () => {
  const reference = quad('z-7', 2, 3, origin, [1, 0, 0], [0, 1, 0]);
  assert.throws(() => padComponentSlice(reference, { ...reference, id: 'z-8' }, raster), /identity or raster dimensions/);
  assert.throws(() => padComponentSlice(reference, reference, raster.subarray(0, 20)), /identity or raster dimensions/);
  assert.throws(() => padComponentSlice(reference, reference), /identity or raster dimensions/);
});

test('actual footprint union expands every edge on each oriented pixel grid without modifying inputs', () => {
  const planes: { id: string; u: Vec; v: Vec }[] = [
    { id: 'x-7', u: [0, 2, 0], v: [0, 0, -3] },
    { id: 'y-7', u: [-2, 0, 0], v: [0, 0, -3] },
    { id: 'z-7', u: [-2, 0, 0], v: [0, -3, 0] },
  ];
  for (const { id, u, v } of planes) {
    const reference = quad(id, 6, 5, origin, u, v);
    const components = [[-1, 1], [5, 1], [1, -1], [1, 4]].map(([x, y]) => quad(id, 2, 3, point(origin, u, v, x!, y!), u, v));
    const before = structuredClone({ reference, components }), merged = mergeSliceLayout(reference, components);
    assert.equal(merged.widthPx, 8); assert.equal(merged.heightPx, 8);
    assert.deepEqual(merged.vertices, [point(origin, u, v, -1, -1), point(origin, u, v, 7, -1),
      point(origin, u, v, 7, 7), point(origin, u, v, -1, 7)]);
    assert.deepEqual({ reference, components }, before);
    for (const component of components) assert.doesNotThrow(() => padComponentSlice(merged, component, raster));
    assert.deepEqual(mergeSliceLayout(reference, []), reference);
  }
});

test('a quantized component row beyond neutral survives in the merged layout', () => {
  const u: Vec = [1, 0, 0], v: Vec = [0, 1, 0], reference = quad('z-7', 6, 5, origin, u, v);
  const component = quad('z-7', 2, 3, point(origin, u, v, 2, 3), u, v);
  assert.throws(() => padComponentSlice(reference, component, raster), /canonical union crop/);
  const union = mergeSliceLayout(reference, [component]); assert.equal(union.heightPx, 6);
  const padded = padComponentSlice(union, component, raster);
  assert.deepEqual(padded.subarray((5 * 6 + 2) * 4, (5 * 6 + 4) * 4), raster.subarray(16, 24));
});

test('footprint union cannot merge different slabs, resampled pixels or offsets outside the shared grid', () => {
  const u: Vec = [1, 0, 0], v: Vec = [0, 1, 0], reference = quad('z-7', 6, 5, origin, u, v);
  assert.throws(() => mergeSliceLayout(reference, [{ ...reference, id: 'z-8' }]), /different physical slabs/);
  for (const component of [
    quad('z-7', 2, 3, point(origin, u, v, 1.5, 1), u, v),
    quad('z-7', 2, 3, point(origin, u, v, 1, 1), [1.01, 0, 0], v),
    quad('z-7', 2, 3, [11, 21, 30.1], u, v),
  ]) assert.throws(() => mergeSliceLayout(reference, [component]), /registered pixel grid/);
});

test('registered footprint union retains physical slab intervals and rejects mismatched integration support', () => {
  const reference = quad('z-7', 6, 5, origin, [1, 0, 0], [0, 1, 0]);
  reference.slab = { start: 29, end: 31, samples: 8, startCell: 2, endCell: 4 };
  assert.deepEqual(mergeSliceLayout(reference, [structuredClone(reference)]).slab, reference.slab);
  const changed = structuredClone(reference); changed.slab!.samples = 4;
  assert.throws(() => mergeSliceLayout(reference, [changed]), /different physical integration/);
  delete changed.slab;
  assert.throws(() => mergeSliceLayout(reference, [changed]), /different physical integration/);
});
