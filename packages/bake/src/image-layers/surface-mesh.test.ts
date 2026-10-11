import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { parseImageLayerRecipe, type ImageLayerRecipe } from './config.ts';
import { closedMesh, edgeShare, imageLayerSurfaceMesh, MESH_OPACITY_FLOOR, pushPull } from './surface-mesh.ts';
import { stlTriangles } from './surface.ts';

type Surface = NonNullable<ImageLayerRecipe['geometry']['surface']>;

const SIZE = 120, PIXEL = 0.5;
const sky = (px: number, py: number) => [(SIZE / 2 - px - 0.5) * PIXEL, (SIZE / 2 - py - 0.5) * PIXEL] as const;
/** A binary STL ball of `radius` about the origin; `open` leaves out its cap within that many rings of the +z pole. */
function ball(radius: number, steps = 24, open = 0): Buffer {
  const triangles: number[][] = [], at = (i: number, j: number) => { const polar = Math.PI * i / steps, turn = 2 * Math.PI * j / steps; return [radius * Math.sin(polar) * Math.cos(turn), radius * Math.sin(polar) * Math.sin(turn), radius * Math.cos(polar)]; };
  for (let i = open; i < steps; i++) for (let j = 0; j < steps; j++) { triangles.push([...at(i, j), ...at(i + 1, j), ...at(i + 1, j + 1)]); triangles.push([...at(i, j), ...at(i + 1, j + 1), ...at(i, j + 1)]); }
  const bytes = Buffer.alloc(84 + 50 * triangles.length); bytes.writeUInt32LE(triangles.length, 80);
  for (const [index, triangle] of triangles.entries()) for (let value = 0; value < 9; value++) bytes.writeFloatLE(triangle[value]!, 84 + 50 * index + 12 + 4 * value);
  return bytes;
}
const surface: Surface = { source: 'fixture', basis: 'fixture', path: 'fixture.stl', arcsecPerUnit: 10, originUnits: [0, 0, 0], pole: { tiltDeg: 60, paDeg: 0, rollDeg: 0, receding: '+z' }, fitArcsec: 0.5, closedMesh: true };

test('a surface with a hole is closed: every edge of the closed mesh is held by two triangles, one each way', () => {
  const triangles = stlTriangles(ball(1, 12, 2), 'open.stl'), keys = new Map<string, number>(), positions: number[] = [], indices: number[] = [];
  for (let corner = 0; corner < triangles.length / 3; corner++) { const key = [0, 1, 2].map(k => Math.round(triangles[3 * corner + k]! * 1e4)).join(','); let index = keys.get(key); if (index === undefined) { index = positions.length / 3; keys.set(key, index); positions.push(...[0, 1, 2].map(k => triangles[3 * corner + k]!)); } indices.push(index); }
  const closed = closedMesh(Float32Array.from(positions), Uint32Array.from(indices)), edges = new Map<string, number>();
  assert.equal(closed.holes, 1);
  for (let t = 0; t < closed.indices.length; t += 3) for (let k = 0; k < 3; k++) { const key = `${closed.indices[t + k]},${closed.indices[t + (k + 1) % 3]}`; edges.set(key, (edges.get(key) ?? 0) + 1); }
  for (const [key, n] of edges) { const [a, b] = key.split(','); assert.equal(n, 1, `edge ${key} runs one way once`); assert.ok(edges.has(`${b},${a}`), `edge ${key} has its twin`); }
});

test('a hole in a field is filled from its whole rim, and the known values are kept', () => {
  const width = 16, height = 16, values = new Float32Array(width * height), weight = new Float32Array(width * height).fill(1);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) values[y * width + x] = x;
  for (let y = 5; y < 11; y++) for (let x = 5; x < 11; x++) { values[y * width + x] = 0; weight[y * width + x] = 0; }
  const [filled] = pushPull([values], weight, width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const value = filled![y * width + x]!;
    if (weight[y * width + x]) assert.equal(value, x); else assert.ok(value > 2 && value < 13, `the hole at ${x}, ${y} takes its rim's values: ${value}`); }
});

test('a closed ball is drawn as its own triangles: dark dust opaque, bright gas clear to the floor, nothing past the long side', async () => {
  // The picture's left half is dark dust, its right half bright gas.
  const photo = Buffer.alloc(4 * SIZE * SIZE); for (let p = 0; p < SIZE * SIZE; p++) photo.set(p % SIZE < SIZE / 2 ? [20, 15, 12, 255] : [200, 150, 120, 255], 4 * p);
  const made = await imageLayerSurfaceMesh(surface, stlTriangles(ball(2), 'ball.stl'), photo, SIZE, SIZE, sky);
  assert.ok(made.length > 100, `${made.length} triangles`);
  const floor = Math.round(255 * MESH_OPACITY_FLOOR), inside = new Set<number>();
  for (const triangle of made) { const [columns, rows] = triangle.texture, alpha = (s: number, t: number) => triangle.rgba[4 * (Math.floor(t * rows) * columns + Math.floor(s * columns)) + 3]!;
    const held = alpha(.2, .2); inside.add(held); assert.ok(held >= floor, `no face clearer than the floor: ${held}`); if (columns > 4 && rows > 4) assert.equal(alpha(.95, .95), 0, 'clear past its long side'); }
  assert.ok(inside.has(255), 'the dark dust stays opaque'); assert.ok(inside.has(floor), 'the brightest gas clears to the floor');
});

test('a recipe draws its surface as a closed mesh with its filament and detail maps, and refuses what it cannot read', () => {
  const recipe = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../../src/objects/homunculus-nebula-layers/source/recipe.json'), 'utf8')) as { geometry: { surface: Record<string, unknown> } };
  const parsed = parseImageLayerRecipe(recipe).geometry.surface!;
  assert.equal(parsed.closedMesh, true); assert.deepEqual(parsed.filaments, { path: 'filaments.png', darkness: 0.65, detailPath: 'detail.png' }); assert.deepEqual(parsed.edgeFit, { maxStretch: 0.15, smoothDeg: 6 });
  const with_ = (patch: Record<string, unknown>) => () => parseImageLayerRecipe({ ...recipe, geometry: { ...recipe.geometry, surface: { ...recipe.geometry.surface, ...patch } } });
  assert.throws(with_({ closedMesh: false }), /closedMesh is true or left out/u);
  assert.throws(with_({ filaments: { path: 'filaments.png', darkness: 2 } }), /darkness is from 0 to 1/u);
  assert.throws(with_({ edgeFit: { maxStretch: 1.5, smoothDeg: 6 } }), /maxStretch is a share/u);
});

test('two triangles over their shared edge band make the face\'s opacity together: no gap, no edge drawn twice', () => {
  for (const a of [0, .1, .5, .9, 1]) {
    assert.equal(edgeShare(a, .5), a, 'half a texel inside, a triangle draws its face whole');
    assert.equal(edgeShare(a, 3), a);
    assert.equal(edgeShare(a, -.5), 0, 'half a texel outside, it draws nothing');
    assert.equal(edgeShare(a, -3), 0);
    for (const inside of [-.49, 0, .49]) {
      // A texel in the band is drawn by both triangles, one over the other: together 1 - (1 - s)^2.
      const s = edgeShare(a, inside), together = 1 - (1 - s) ** 2;
      assert.ok(Math.abs(together - a) < 1e-12, `a = ${a}, ${inside} texels in: the two make ${together}`);
    }
  }
});
