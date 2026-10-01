/** Actual PolyCSS compiler regression for prepared density-image orientation and crop bounds. */
import { computeTextureAtlasPlanPublic, resolvePolyTextureLeafGeometry } from '@layoutit/polycss';
import type { Polygon } from '@layoutit/polycss';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import type { VolumeSliceQuad } from '../volume/node/index.ts';
import type { Vector3 } from '@cssearth/objects';
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
test('compiled slices hold their texture at TEXELS_PER_CSS_PIXEL and cover the plane PolyCSS gave them', async () => {
  const { compileCssVolume } = await import('./volume.ts');
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
  const { balanceVolumeSlices } = await import('./volume-order.ts');
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
