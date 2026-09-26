/** Actual PolyCSS compiler regression for prepared density-image orientation and crop bounds. */
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry } from '@layoutit/polycss';
import type { Polygon } from '@layoutit/polycss';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import type { VolumeSliceQuad } from '@cssearth/bake/volume/node';
import type { Axis as SliceAxis, Vector3 } from '@cssearth/bake/volume';
import { test } from 'node:test';

type Quad = Pick<VolumeSliceQuad, 'id' | 'axis' | 'texturePath' | 'widthPx' | 'heightPx' | 'vertices' | 'uvs'>;
function record(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function finite(value: unknown): number { assert(typeof value === 'number' && Number.isFinite(value)); return value; }
function text(value: unknown): string { assert(typeof value === 'string' && value.length > 0); return value; }
function array(value: unknown, length: number): unknown[] { assert(Array.isArray(value) && value.length === length); return value; }
function triple(value: unknown): Vector3 { const a = array(value, 3); return [finite(a[0]), finite(a[1]), finite(a[2])]; }
function pair(value: unknown): [number, number] { const a = array(value, 2); return [finite(a[0]), finite(a[1])]; }
function parseQuad(value: unknown): Quad {
  const q = record(value), vertices = array(q.vertices, 4), uvs = array(q.uvs, 4);
  const axis = q.axis;
  assert(axis === 'x' || axis === 'y' || axis === 'z');
  const widthPx = finite(q.widthPx), heightPx = finite(q.heightPx);
  assert(Number.isInteger(widthPx) && widthPx > 0 && Number.isInteger(heightPx) && heightPx > 0);
  return { id: text(q.id), axis, texturePath: text(q.texturePath), widthPx, heightPx,
    vertices: [triple(vertices[0]), triple(vertices[1]), triple(vertices[2]), triple(vertices[3])],
    uvs: [pair(uvs[0]), pair(uvs[1]), pair(uvs[2]), pair(uvs[3])] };
}
function compile(q: Quad, vertices: Quad['vertices'] = q.vertices) {
  const url = 'offline-orientation-proof.png';
  const polygon: Polygon = { vertices, uvs: q.uvs, texture: url,
    textureImageSource: { url, width: q.widthPx, height: q.heightPx },
    texturePresentation: { backend: 'image', lighting: 'source', projection: 'projective' }, doubleSided: true };
  const plan = computeTextureAtlasPlanPublic(polygon, 0,
    { tileSize: 50, layerElevation: 50, seamBleed: 0 });
  assert(plan, `Missing PolyCSS plan for ${q.id}`);
  const geometry = resolvePolyTextureLeafGeometry(plan, { backend: 'image', lighting: 'source', projection: 'projective' });
  assert(geometry, `Missing image/projective geometry for ${q.id}`);
  return geometry;
}
function imageWorld(g: Pick<ReturnType<typeof compile>, 'matrix' | 'leafWidth' | 'leafHeight'>, u: number, v: number): Vector3 {
  const m = g.matrix.split(',').map(Number);
  assert(m.length === 16 && m.every(Number.isFinite));
  const coefficient = (index: number): number => { const value = m[index]; assert(value !== undefined); return value; };
  const x = u * g.leafWidth, y = v * g.leafHeight;
  // PolyCSS swaps world X/Y when expressing mesh vertices in CSS pixel coordinates.
  return [(coefficient(1) * x + coefficient(5) * y + coefficient(13)) / 50,
    (coefficient(0) * x + coefficient(4) * y + coefficient(12)) / 50,
    (coefficient(2) * x + coefficient(6) * y + coefficient(14)) / 50];
}
/** Independent of polygon winding: the baker's PNG top row samples positive in-plane V. */
function expectedImageWorld(q: Quad, u: number, v: number): Vector3 {
  const horizontal = q.axis === 'x' ? 1 : 0;
  const vertical = q.axis === 'z' ? 1 : 2;
  const depth = q.axis === 'x' ? 0 : q.axis === 'y' ? 1 : 2;
  const bounds = (index: number): [number, number] => {
    const values = q.vertices.map(vertex => { const value = vertex[index]; assert(value !== undefined); return value; });
    return [Math.min(...values), Math.max(...values)];
  };
  const [uMin, uMax] = bounds(horizontal), [vMin, vMax] = bounds(vertical);
  const result: Vector3 = [0, 0, 0];
  result[horizontal] = uMin + (uMax - uMin) * u;
  result[vertical] = vMax - (vMax - vMin) * v;
  result[depth] = q.vertices[0][depth];
  return result;
}
function mappingError(q: Quad, g: ReturnType<typeof compile>, u: number, v: number): number {
  const actual = imageWorld(g, u, v), expected = expectedImageWorld(q, u, v);
  return Math.hypot(actual[0] - expected[0], actual[1] - expected[1], actual[2] - expected[2]);
}
test('actual PolyCSS image corners preserve physical density orientation and reject the old vertex order', async () => {
const output = resolve('src/objects/milky-way/prepared');
const parsed: unknown = JSON.parse(await readFile(resolve(output, 'volume-slices.json'), 'utf8'));
const rawQuads = record(parsed).quads;
assert(Array.isArray(rawQuads) && rawQuads.length > 0);
const quads = rawQuads.map((value: unknown) => parseQuad(value));
let maximumError = 0, decodedBytes = 0, checkedPixels = 0;
// PolyCSS's conservative image edge extension is 0.6 CSS px. Allow 1.25px
// Euclidean error for two extended axes, including six-decimal matrix serialization.
const toleranceUnits = 1.25 / 50;
for (const q of quads) {
  const g = compile(q);
  const { data, info } = await sharp(resolve(output, q.texturePath)).raw().toBuffer({ resolveWithObject: true });
  assert(info.width === q.widthPx && info.height === q.heightPx && info.channels === 4);
  decodedBytes += data.length;
  let first = -1, last = -1;
  for (let index = 3; index < data.length; index += 4) if (data[index]) {
    if (first < 0) first = (index - 3) / 4;
    last = (index - 3) / 4;
  }
  for (const index of [first, last]) if (index >= 0) {
    const u = (index % q.widthPx + 0.5) / q.widthPx;
    const v = (Math.floor(index / q.widthPx) + 0.5) / q.heightPx;
    const error = mappingError(q, g, u, v);
    maximumError = Math.max(maximumError, error);
    assert(error < toleranceUnits, `${q.id}: PNG pixel mapped to the wrong world position (${error})`);
    checkedPixels++;
  }
}
assert(checkedPixels > 0, 'No visible density texels were checked');
const mutations: { axis: SliceAxis; errorUnits: number }[] = [];
for (const axis of ['x', 'y', 'z'] satisfies SliceAxis[]) {
  const depth = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const candidates = quads.filter(q => q.axis === axis).sort((a, b) => Math.abs(a.vertices[0][depth]) - Math.abs(b.vertices[0][depth]));
  const q = candidates[0];
  assert(q, `Missing ${axis} stack`);
  // This is the old broken bottom-left-first geometry, not a synthetic alternate input.
  const wrong = compile(q, [q.vertices[3], q.vertices[2], q.vertices[1], q.vertices[0]]);
  const error = mappingError(q, wrong, 0.5, 0.2);
  assert(error > toleranceUnits * 10, `${axis}: old corner-order mutation escaped the regression`);
  mutations.push({ axis, errorUnits: error });
}
const receipt = { result: 'PASS', quads: quads.length, checkedPixels, decodedMiB: decodedBytes / 1048576,
  maximumSourcePixelWorldErrorUnits: maximumError, toleranceUnits, mutations };

console.log('PASS actual PolyCSS PNG-to-world mapping; old vertex-order mutation rejected on X/Y/Z', receipt);

});

test('prepared volume descriptor and external PNG bank form a complete pinned closure', async () => {
  const { parseDensityVolumeObjectDescriptor } = await import('@cssearth/objects');
  const { sha256 } = await import('@cssearth/core/node');
  const root = resolve('src/objects/milky-way');
  const descriptor = parseDensityVolumeObjectDescriptor(JSON.parse(await readFile(resolve(root, 'object.json'), 'utf8')) as unknown);
  assert(descriptor.prepared);
  const bytes = await readFile(resolve(root, descriptor.prepared.url));
  const envelope = record(JSON.parse(bytes.toString('utf8')) as unknown);
  assert.equal(envelope.id, descriptor.id); assert.equal(envelope.format, descriptor.prepared.format);
  const data = record(envelope.data), resources = data.resources;
  assert(Array.isArray(resources) && resources.length > 0);
  for (const value of resources) {
    const resource = record(value), path = text(resource.path);
    assert(!path.startsWith('/') && !path.split('/').includes('..'));
    const png = await readFile(resolve(root, 'prepared', path));
    assert.equal(sha256(png), text(resource.sha256)); assert.equal(png.length, finite(resource.bytes));
  }
  assert(!bytes.includes(Buffer.from('data:image/')), 'Production payload must reference external PNGs');
});


test('volume compilation omits only lossless-alpha empty slabs, preserving every nonempty PolyCSS leaf', async () => {
  const { compileCssVolume } = await import('./volume.js');
  const { parseDensityVolumeObjectDescriptor } = await import('@cssearth/objects');
  const { parseVolumeRecipe } = await import('@cssearth/bake/volume');
  const slices = JSON.parse(await readFile('src/objects/milky-way/prepared/volume-slices.json', 'utf8')) as import('@cssearth/bake/volume/node').VolumeSlices;
  const descriptor = parseDensityVolumeObjectDescriptor(JSON.parse(await readFile('src/objects/milky-way/object.json', 'utf8')));
  const recipe = parseVolumeRecipe(JSON.parse(await readFile('src/objects/milky-way/source/volume.json', 'utf8')));
  const options = { id: descriptor.id, frame: descriptor.volume, recipe, slices };
  const empty = slices.quads.filter(quad => quad.alphaCoverage === 0);
  assert(empty.length > 0, 'the real prepared bank must exercise empty-slab exclusion');
  for (const quad of empty) {
    const rgba = await sharp(resolve('src/objects/milky-way/prepared', quad.texturePath)).ensureAlpha().raw().toBuffer();
    for (let offset = 3; offset < rgba.length; offset += 4) assert.equal(rgba[offset], 0, `${quad.id} must have zero decoded alpha`);
  }
  const complete = compileCssVolume({ ...options, slices: { ...slices, quads: slices.quads.map(quad => ({ ...quad, alphaCoverage: 1 })) } });
  const sparse = compileCssVolume(options);
  const omittedIds = new Set(empty.map(quad => quad.id)), omittedPaths = new Set(empty.map(quad => quad.texturePath));
  // Removing empty planes may change the balanced traversal, but never any
  // surviving geometry. Compare the retained leaves independently of ordering.
  const byId = (stack: (typeof sparse.stacks)[number]) => ({ ...stack,
    leaves: [...stack.leaves].sort((a, b) => a.id.localeCompare(b.id)) });
  assert.deepEqual(sparse.stacks.map(byId), complete.stacks.map(stack => byId({ ...stack,
    leaves: stack.leaves.filter(leaf => !omittedIds.has(leaf.id)) })));
  assert.deepEqual(sparse.resources, complete.resources.filter(resource => !omittedPaths.has(resource.path)));
  const faint = compileCssVolume({ ...options, slices: { ...slices, quads: slices.quads.map(quad => ({ ...quad, alphaCoverage: Number.MIN_VALUE })) } });
  assert.deepEqual(faint, complete, 'no nonzero coverage threshold may remove a faint slab');
});

test('compiled slices hold their texture at TEXELS_PER_CSS_PIXEL and cover the plane PolyCSS gave them', async () => {
  const { compileCssVolume } = await import('./volume.js');
  const { TEXELS_PER_CSS_PIXEL } = await import('@cssearth/bake/scene');
  const { parseDensityVolumeObjectDescriptor } = await import('@cssearth/objects');
  const { parseVolumeRecipe } = await import('@cssearth/bake/volume');
  const slices = JSON.parse(await readFile('src/objects/milky-way/prepared/volume-slices.json', 'utf8')) as import('@cssearth/bake/volume/node').VolumeSlices;
  const descriptor = parseDensityVolumeObjectDescriptor(JSON.parse(await readFile('src/objects/milky-way/object.json', 'utf8')));
  const recipe = parseVolumeRecipe(JSON.parse(await readFile('src/objects/milky-way/source/volume.json', 'utf8')));
  const volume = compileCssVolume({ id: descriptor.id, frame: descriptor.volume, recipe, slices });
  const quads = new Map(slices.quads.map(quad => [quad.id, quad]));
  let leaves = 0, maximumError = 0;
  for (const leaf of volume.stacks.flatMap(stack => stack.leaves)) {
    const quad = quads.get(leaf.id);
    assert(quad, `${leaf.id} has no source quad`);
    const polycss = compile(parseQuad(quad)), width = Number.parseFloat(leaf.style.width), height = Number.parseFloat(leaf.style.height);
    // The one-texel-per-pixel box WebKit backed at nine device pixels per texel on a DPR 3 phone.
    assert.equal(polycss.leafWidth, leaf.widthPx, `${leaf.id}: PolyCSS no longer sizes an image leaf by its texture`);
    assert.equal(leaf.widthPx / width, TEXELS_PER_CSS_PIXEL, `${leaf.id}: ${leaf.widthPx} texels across ${leaf.style.width}`);
    assert.equal(leaf.heightPx / height, TEXELS_PER_CSS_PIXEL, `${leaf.id}: ${leaf.heightPx} texels down ${leaf.style.height}`);
    assert.equal(leaf.style.backgroundSize, `${leaf.style.width} ${leaf.style.height}`);
    assert.equal(leaf.style.backgroundPosition, '0px 0px');
    const dense = { matrix: leaf.style.transform.slice('matrix3d('.length, -1), leafWidth: width, leafHeight: height };
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1], [0.37, 0.61]] as const) {
      const a = imageWorld(polycss, u, v), b = imageWorld(dense, u, v);
      maximumError = Math.max(maximumError, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
    }
    leaves++;
  }
  assert(leaves > 0, 'The real prepared bank must compile slices');
  assert(maximumError < 1e-9, `A dense slice moved by ${maximumError} units`);
});

test('prepared volume plane order bounds first-pivot depth without changing coplanar order', async () => {
  const { balanceVolumeSlices } = await import('./volume-order.js');
  for (const axis of ['x', 'y', 'z'] as const) {
    const component = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const input = Array.from({ length: 214 }, (_,index) => {
      const centerUnits: [number, number, number] = [17, 23, 29];
      centerUnits[component] = index - 107;
      return [{ id: `${index}-first`, centerUnits }, { id: `${index}-second`, centerUnits }];
    }).reverse().flat();
    const before = [...input], ordered = balanceVolumeSlices(input, axis);
    assert.deepEqual(input, before, 'preparation must not mutate source order');
    assert.deepEqual([...ordered].sort((a,b)=>a.id.localeCompare(b.id)), [...input].sort((a,b)=>a.id.localeCompare(b.id)));
    for (let index = 0; index < ordered.length; index += 2) {
      assert(ordered[index]!.id.endsWith('-first'));
      assert.equal(ordered[index]!.centerUnits, ordered[index + 1]!.centerUnits, 'coplanar source siblings stay adjacent and ordered');
    }
    // Model Chromium's first-plane partition, not the preparation traversal.
    const depth = (values: readonly number[]): number => {
      if (values.length === 0) return 0;
      const pivot = values[0]!;
      return 1 + Math.max(depth(values.filter(value => value < pivot)), depth(values.filter(value => value > pivot)));
    };
    assert.equal(depth(input.map(leaf => leaf.centerUnits[component])), 214);
    assert.equal(depth(ordered.map(leaf => leaf.centerUnits[component])), 8);
    assert.deepEqual(balanceVolumeSlices([], axis), []);
  }
});
