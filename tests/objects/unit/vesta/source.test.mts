import {required} from '../../../../tools/test-values.mts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { loadPdsScalarGrid } from '../../../../tools/objects/terrestrial-layers/pds-scalar-grid.mts';
import { colorForValue } from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import { preparePlanetarySystem } from '../../../../src/platform/prepare-planetary-system.mts';
import { prepareEclipticPresentationFrame } from '../../../../src/platform/solar-presentation-frame.mts';
const root = resolve(import.meta.dirname, '../../../..'), base = resolve(root, 'src/objects/vesta');
const read = async (path: string) => JSON.parse(await readFile(resolve(base, path), 'utf8'));

test('Dawn radius anchors preserve meters, poles and east longitude; elevation has a numeric datum', async () => {
  const config = await read('source/preparation/terrestrial.json'), profile = config.geometry.radialTerrain;
  const grid = await loadPdsScalarGrid(resolve(base, 'source', profile.path), profile.grid, { width: 361, height: 181 });
  // Independent values read directly from the native PDS rows, not fitted axes.
  for (const [longitude, latitude, expected] of [[0, 0, 281444], [90, 0, 274738], [180, 0, 278152], [270, 0, 284430], [0, 90, 231352], [0, -90, 225276]] as const) {
    assert.ok(Math.abs(required(grid.sample(longitude, latitude)) - expected) < 1, `${longitude}E ${latitude}N must remain a radius in meters`);
  }
  const lens = config.raster.scientific.find((lens: { id: string; }) => lens.id === 'elevation');
  assert.deepEqual(lens.valueTransform, { scale: .001, offset: -255 });
  const { data, info } = await sharp(resolve(root, 'public/scenes/vesta/vesta-elevation-legend.webp')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const x of [0, 64, 128, 255]) for (const y of [0, 15]) {
    const expected = colorForValue(lens.minimum + x / 255 * (lens.maximum - lens.minimum), lens);
    const actual = [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
    // The existing legend emitter uses lossy WebP; account for its RGB decode.
    assert.ok(actual.every((v, i) => Math.abs(v - expected[i]) <= 3), 'unshaded numeric legend agrees within three display codes');
  }
});

test('Vesta uses one shared scene and its measured mesh for drawing and hits', async () => {
  const [runtime, terrain, descriptor, manifest, scene] = await Promise.all(['prepared/runtime.json', 'prepared/terrain.json', 'object.json', 'runtime-assets.json', 'prepared/scene.json'].map(read));
  assert.equal(descriptor.properties.recipe.shape.kind, 'radial-terrain');
  assert.equal(runtime.tree.nodes.filter((n: { className: string|string[]; }) => n.className?.includes('polycss-camera')).length, 1);
  assert.equal(runtime.surfaceHit.triangles.length, terrain.faces.length);
  assert.ok(terrain.faces.length <= 850, 'Vesta stays near the requested 800-face budget');
  assert.equal(scene.bodyLeaves.length, terrain.faces.length);
  for (const [index, leaf] of scene.bodyLeaves.entries()) {
    assert.equal(leaf.tag, 'u');
    assert.equal(leaf.attributes['data-polycss-texture-leaf-sizing'], 'raster');
    assert.equal(leaf.projectiveTextureLayer, undefined);
    assert.ok(leaf.style.includes(`--polycss-atlas-width:${terrain.source.tileSize}px`));
    assert.ok(leaf.style.includes(`--polycss-atlas-height:${terrain.source.tileSize}px`));
    // Test the browser primitive's actual footprint against source positions.
    // Raster fitting must retain every measured vertex inside the native u.
    const matrix = leaf.style.match(/matrix3d\(([^)]+)\)/)[1].split(',').map(Number);
    const size = terrain.source.tileSize;
    const corners = [[size / 2, 0], [0, size], [size, size]].map(([x, y]) =>
      [0, 1, 2].map(axis => matrix[axis] * x + matrix[axis + 4] * y + matrix[axis + 12]));
    const sub = (a:readonly number[], b:readonly number[]) => a.map((value: number, axis: number) => value - b[axis]);
    const dot = (a:readonly number[], b:readonly number[]) => a.reduce((sum: number, value: number, axis: number) => sum + value * b[axis], 0);
    const ab = sub(corners[1], corners[0]), ac = sub(corners[2], corners[0]);
    const aa = dot(ab, ab), bb = dot(ac, ac), abac = dot(ab, ac), determinant = aa * bb - abac * abac;
    for (const [y, x, z] of terrain.faces[index].vertices) {
      const p = sub([x * 50, y * 50, z * 50], corners[0]);
      const u = (dot(p, ab) * bb - dot(p, ac) * abac) / determinant;
      const v = (dot(p, ac) * aa - dot(p, ab) * abac) / determinant;
      assert.ok(u >= 0 && v >= 0 && u + v <= 1, `native triangle ${index} covers its source vertices`);
      assert.ok(Math.hypot(...p.map((value: number, axis: number) => value - u * ab[axis] - v * ac[axis])) < 1e-5,
        `native triangle ${index} stays in its measured plane`);
    }
  }
  assert.deepEqual(runtime.surfaceHit.triangles[0][0], [terrain.faces[0].vertices[0][1] * 50, terrain.faces[0].vertices[0][0] * 50, terrain.faces[0].vertices[0][2] * 50]);
  for (const asset of manifest.assets) {
    const bytes = await readFile(resolve(root, 'public/scenes/vesta', asset.filename));
    assert.equal(bytes.length, asset.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256);
  }
  const system = await preparePlanetarySystem({ bodyId: 'vesta', presentationFrame: prepareEclipticPresentationFrame('vesta'), kilometersPerUnit: 261.385 / 230 });
  assert.ok(system.bodies.every(body => body.id !== 'vesta'));
  assert.ok(system.bodies.every(body => body.position.every(Number.isFinite)));
});
