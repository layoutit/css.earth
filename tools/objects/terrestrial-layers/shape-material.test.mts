import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import sharp from 'sharp';
import { fixtureSource } from '../test-source-fixture.mts';
import { prepareSolidRasters } from './solid-raster.mts';
import { prepareRadialMaterials } from './radial-terrain.mts';
import { retainedShapeAtlas } from '../refresh-shape-materials.mts';
import { parseObjShape } from './obj-shape.mts';

test('shape views share neutral color while retaining absent-imagery and source evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-neutral-shape-'));
  try {
    await writeFile(join(root, 'shape.obj'), 'v 0 0 0\n');
    const source = await fixtureSource(root, [{ id: 'shape', path: 'shape.obj', consumers: ['shape'] }]);
    const config = { namespace: 'fixture', publicBase: '/scenes/fixture/',
      geometry: { radius: 1, radiusKm: 1, radialTerrain: { path: 'shape.obj' } },
      raster: { width: 64, height: 32, bandCount: 8, gutter: 1, poleSize: 16, reportMissingPixels: true,
        observations: [], scientific: [], shapeViews: ['shape', 'alternative'].map(id => ({ id, consumer: 'shape', label: id })) } };
    const surfaces = await prepareSolidRasters({ sourceDirectory: root, publicDirectory: root, outputDirectory: root, config, source });
    assert.equal(surfaces.length, 2);
    for (const surface of surfaces) {
      assert.equal(surface.missingPixels, 64 * 32, 'Neutral display must not claim photographic coverage');
      assert.deepEqual(surface.source, { id: 'shape' });
      for (const asset of [surface.map, surface.surface, surface.thumbnail]) {
        const bytes = await sharp(await readFile(join(root, basename(asset.url)))).ensureAlpha().raw().toBuffer();
        for (let i = 0; i < bytes.length; i += 4) if (bytes[i + 3])
          assert.deepEqual([...bytes.subarray(i, i + 3)], [128, 128, 128], 'No grid or invented texture in any shape-only raster');
      }
    }
    assert.equal(surfaces[0].map.sha256, surfaces[1].map.sha256);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('retained shape refresh selects the lens mesh and preserves light direction and atlas addresses', async () => {
  const scene = { surfaceTriangles: [ [[0, 0, 0], [50, 0, 0], [0, 50, 0]], [[0, 0, 0], [50, 0, 0], [0, 50, 0]] ],
    surfaceLensRanges: [{ lensId: 'a', start: 0, count: 1 }, { lensId: 'b', start: 1, count: 1 }],
    bodyLeaves: [1, 1].map(() => ({ tag: 'u', style: 'transform:matrix3d(25,0,0,0,0,25,0,0,0,0,1,0,0,0,0,1);background-position:0px 0px;background-size:2px 2px;--polycss-atlas-width:2px;--polycss-atlas-height:2px' })) };
  const before = structuredClone(scene), radial = retainedShapeAtlas(scene, 'b');
  assert.equal(radial.faces.length, 1);
  assert.deepEqual(scene, before);
  assert.throws(() => retainedShapeAtlas(scene, 'absent'), /no retained geometry/);
  const root = await mkdtemp(join(tmpdir(), 'cssearth-neutral-lighting-'));
  try {
    await sharp({ create: { width: 4, height: 2, channels: 3, background: '#808080' } }).webp({ lossless: true }).toFile(join(root, 'shape.webp'));
    const source = await fixtureSource(root, [{ path: 'shape.webp', consumers: ['shape'] }]);
    for (const incidence of [-1, 1]) for (const mode of ['ordinary', 'neutral-fast', 'neutral-general']) {
      const neutral = mode !== 'ordinary';
      const surface = { id: 'shape', map: { url: '/shape.webp' }, ...(neutral ? { material: { kind: 'unobserved-neutral', color: '#808080' } } : {}),
        ...(mode === 'neutral-general' ? { textureScale: 1 } : {}) };
      await prepareRadialMaterials({ radial, surfaces: [surface], config: { namespace: 'fixture', publicBase: '/',
        geometry: { radius: 1, radiusKm: 1, radialTerrain: {} }, raster: { width: 4 } }, source,
        publicDirectory: root, outputDirectory: root, sunDirection: [0, 0, incidence] });
      const flood = await sharp(await readFile(join(root, 'fixture-shape-surface@2x.webp'))).removeAlpha().raw().toBuffer();
      const shadow = await sharp(await readFile(join(root, 'fixture-shape-shadow@2x.webp'))).removeAlpha().raw().toBuffer();
      assert.ok(flood.every(value => Math.abs(value - (neutral && incidence === 1 ? 70 : 128)) <= 1),
        'Only neutral shapes receive gentle shading; the back side remains visible');
      assert.ok(shadow.every(value => Math.abs(value - (incidence === -1 ? 128 : 15)) <= 1), `Source winding and ambient/diffuse illumination remain intact after WebP encoding: ${[...shadow]}`);
    }
    assert.deepEqual(scene, before);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('neutral bake matches the general texture bake over varying smooth normals', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-neutral-equivalence-'));
  try {
    const normal = (x: number, y: number, z: number) => [x, y, z].map(n => n / Math.hypot(x, y, z));
    const face = { vertices: [[0, 0, 1], [1, 0, 1], [0, 1, 1]], normal: [0, 0, 1],
      vertexNormals: [normal(-.6, .2, 1), normal(.7, -.1, 1), normal(.1, .8, 1)] };
    const radial = { width: 32, height: 32, faces: [face],
      plans: [{ face, rect: { x: 0, y: 0, width: 32, height: 32 }, geometry: { leafWidth: 32, leafHeight: 32 },
        matrix: [0, 50 / 32, 0, 0, 50 / 32, 0, 0, 0, 0, 0, 1, 0, 0, 0, 50, 1] }] };
    await sharp({ create: { width: 64, height: 32, channels: 3, background: '#808080' } }).webp({ lossless: true }).toFile(join(root, 'gray.webp'));
    const source = await fixtureSource(root, [{ path: 'gray.webp', consumers: ['shape'] }]);
    const mesh = parseObjShape('v -10 -10 1\nv 10 -10 1\nv 0 10 1\nv -10 -10 5\nv 0 10 5\nv 10 -10 5\nf 1 2 3\nf 4 5 6\n',
      { metersPerUnit: 1, expectedVertices: 6, expectedFaces: 2 });
    const outputs: Buffer[] = [], fills: Buffer[] = [];
    for (const mode of ['ordinary', 'neutral-fast', 'neutral-general', 'ordinary-cast', 'neutral-cast']) {
      const neutral = mode.startsWith('neutral'), cast = mode.endsWith('cast');
      const surface = { id: 'shape', map: { url: '/gray.webp' }, ...(neutral ? { material: { kind: 'unobserved-neutral', color: '#808080' } } : {}),
        ...(mode === 'neutral-general' ? { textureScale: 1 } : {}) };
      await prepareRadialMaterials({ radial: { ...radial, ...(cast ? { grid: mesh } : {}) }, surfaces: [surface], config: { namespace: 'fixture', publicBase: '/',
        geometry: { radius: 1, radiusKm: .001, radialTerrain: cast ? { sourceLighting: {
          maximumDistanceMeters: 2, rayOffsetMeters: .001, ambient: .2, diffuse: .8, uniformFlood: true,
          floodLights: [{ direction: [0, 0, 1], weight: .8 }],
        } } : {} }, raster: { width: 64 } }, source,
        publicDirectory: root, outputDirectory: root, sunDirection: normal(.6, -.5, .3) });
      outputs.push(await readFile(join(root, 'fixture-shape-shadow@2x.webp')));
      fills.push(await readFile(join(root, 'fixture-shape-surface@2x.webp')));
    }
    assert.deepEqual(outputs[0], outputs[1], 'Same encoded lighting across the complete atlas, including bleed');
    assert.deepEqual(outputs[0], outputs[2], 'The general path also preserves Shadows-on bytes');
    assert.deepEqual(fills[1], fills[2], 'Fast and general paths bake the same default shape lighting');
    assert.deepEqual(outputs[3], outputs[4], 'Neutral material retains the source-cast Shadows-on image');
    assert.deepEqual(fills[0], fills[3], 'Ordinary source-cast flood remains unchanged');
    assert.deepEqual(fills[1], fills[4], 'Neutral shapes use the same gentle default even with source-cast lighting');
    const pixels = await sharp(fills[1]).removeAlpha().raw().toBuffer();
    const colors = new Set<number>();
    for (let i = 0; i < pixels.length; i += 3) {
      assert.equal(pixels[i], pixels[i + 1]); assert.equal(pixels[i], pixels[i + 2]);
      assert.ok(pixels[i] >= 68 && pixels[i] <= 130, 'Gentle fill stays within the neutral material range after encoding');
      colors.add(pixels[i]);
    }
    assert.ok(colors.size > 10, 'Varying mesh normals must remain visible with Shadows off');
  } finally { await rm(root, { recursive: true, force: true }); }
});
