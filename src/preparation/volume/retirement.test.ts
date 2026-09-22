import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { zstdCompressSync } from 'node:zlib';
import { encodeDensityKtx2 } from './acquisition.js';
import { sha256 } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { readPreviousVolumeTextures, retireVolumeTextures } from './retirement.js';

test('successful format/count changes retire previous manifest-owned textures and preserve unrelated files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'volume-retirement-'));
  try {
    assert.deepEqual(await readPreviousVolumeTextures(root), []);
    await mkdir(join(root, 'slices/z'), { recursive: true });
    const previous = ['slices/z/00.png', 'slices/z/01.png', 'slices/z/02.webp'];
    const current = ['slices/z/00.webp', 'slices/z/02.webp'];
    for (const path of [...new Set([...previous, ...current, 'slices/z/unrelated.png', 'notes.txt'])]) await writeFile(join(root, path), path);
    await mkdir(join(root, 'sky'), { recursive: true });
    await writeFile(join(root, 'sky/px.webp'), 'sky');
    await writeFile(join(root, 'volume.json'), JSON.stringify({ data: { resources: [...previous, 'sky/px.webp', 'notes.txt'].map(path => ({ path })) } }));
    const owned = await readPreviousVolumeTextures(root);
    assert.deepEqual(owned, previous);
    await retireVolumeTextures(root, owned, current);
    for (const path of previous.slice(0, 2)) await assert.rejects(readFile(join(root, path)), { code: 'ENOENT' });
    for (const path of [...current, 'slices/z/unrelated.png', 'notes.txt']) assert.equal(await readFile(join(root, path), 'utf8'), path);
    assert.equal(await readFile(join(root, 'sky/px.webp'), 'utf8'), 'sky', 'slice retirement must preserve other prepared capabilities');
    // Reject a manifest escape before even its first otherwise valid retirement.
    await assert.rejects(retireVolumeTextures(root, [current[0], 'slices/../notes.txt'], []), /escapes/);
    assert.equal(await readFile(join(root, current[0]), 'utf8'), current[0]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('normal preparation CLI removes obsolete PNG/count outputs after publishing the complete replacement', async () => {
  await mkdir('.local', { recursive: true });
  const root = await mkdtemp(resolve('.local/volume-publication-'));
  try {
    const engineRequire = createRequire(resolve('packages/engine/package.json'));
    const { build } = createRequire(engineRequire.resolve('tsup'))('esbuild') as { build(options: unknown): Promise<void> };
    const executable = join(root, 'prepare-volume.mjs');
    await build({ entryPoints: [resolve('tools/objects/prepare-volume.ts')], outfile: executable,
      bundle: true, platform: 'node', format: 'esm', target: 'node22', packages: 'external' });
    const object = join(root, 'fixture'); await mkdir(join(object, 'source'), { recursive: true });
    const raw = Buffer.from(Array.from({ length: 8 }, () => [128, 0, 0, 0]).flat());
    const grid = encodeDensityKtx2({ width: 2, height: 2, depth: 2, encodedRgba: raw }, 9);
    const provenance = Buffer.from('{"source":"test fixture"}\n');
    await writeFile(join(object, 'source/grid.ktx2'), grid); await writeFile(join(object, 'source/provenance.json'), provenance);
    const skyRaw = Buffer.alloc(4 * 2 * 6); for (let i = 0; i < skyRaw.length; i += 2) skyRaw.writeUInt16LE(0x3000, i);
    const skyChunk = zstdCompressSync(skyRaw); await writeFile(join(object, 'source/sky.zst'), skyChunk);
    const skyRecipe = Buffer.from(JSON.stringify({ schema: 'cssearth-sky-recipe@1', source: { format: 'rgb16f-le-zstd-rows', width: 4, height: 2,
      decodedSha256: sha256(skyRaw), chunks: [{ path: 'sky.zst', sha256: sha256(skyChunk), firstRow: 0, rows: 2 }],
      acquisition: { path: 'unused-acquisition.json', sha256: '0'.repeat(64) } },
      projection: { frame: 'icrf-j2000', mapping: 'equirectangular-ra-left', centerRaDegrees: 0 },
      bake: { faceSize: 8, exposure: 1, transfer: 'linear-to-srgb', webpQuality: 90 },
      provenance: { path: 'provenance.json', sha256: sha256(provenance) } }));
    await writeFile(join(object, 'source/sky.json'), skyRecipe);
    const bounds = { min: [-1, -1, -.125], max: [1, 1, .125] };
    const recipe = { schema: 'cssearth-volume-recipe@1',
      grid: { path: 'grid.ktx2', sha256: sha256(grid), decodedSha256: sha256(raw), dimensions: [2, 2, 2], encoding: 'sqrt-density-unorm8', bounds },
      material: { emission: [{ channel: 0, color: [1, 1, 1], strength: 1 }], absorption: [], intensityScale: 1, stepScale: 1, exposureGain: 1 },
      bake: { sliceCounts: { x: 1, y: 1, z: 2 }, unitsPerSourceUnit: 1, imageWidth: 8, samplesPerSlab: 1, cropTransparent: true, opticalWeight: 1,
        imageEncoding: { format: 'png' as 'png' | 'webp' } }, anchors: [], provenance: { path: 'provenance.json', sha256: sha256(provenance) },
      sky: { path: 'sky.json', sha256: sha256(skyRecipe) } };
    const descriptor = { schema: 'cssearth-object@1', id: 'test-cloud', type: 'density-volume', properties: {
      volume: { referenceFrame: 'sun-icrf', epochJdTt: 2451545, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: bounds },
      preparation: { source: 'source/volume.json' } } };
    async function prepare() {
      const bytes = Buffer.from(JSON.stringify(recipe));
      await writeFile(join(object, 'source/volume.json'), bytes); await writeFile(join(object, 'object.json'), JSON.stringify(descriptor));
      const result = spawnSync(process.execPath, [executable, object], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /PREPARED test-cloud:/);
    }
    await prepare();
    const prepared = join(object, 'prepared');
    assert(await readFile(join(prepared, 'slices/z/01.png')));
    await writeFile(join(prepared, 'slices/z/unrelated.png'), 'keep');
    recipe.bake.sliceCounts.z = 1; recipe.bake.imageEncoding.format = 'webp';
    // A completed raster bake replaces the intermediate manifest before a later compile failure.
    // Only the last published envelope still owns the original PNG bank on retry.
    descriptor.properties.volume.boundsUnits = { ...bounds, min: [-2, -1, -.125] };
    await assert.rejects(prepare(), /Prepared geometry bounds disagree/);
    assert(await readFile(join(prepared, 'slices/z/01.png')));
    descriptor.properties.volume.boundsUnits = bounds;
    await prepare();
    for (const path of ['slices/x/00.png', 'slices/y/00.png', 'slices/z/00.png', 'slices/z/01.png'])
      await assert.rejects(readFile(join(prepared, path)), { code: 'ENOENT' });
    assert.equal(await readFile(join(prepared, 'slices/z/unrelated.png'), 'utf8'), 'keep');
    const envelope = JSON.parse(await readFile(join(prepared, 'volume.json'), 'utf8')) as { data: { resources: { path: string; sha256: string }[] } };
    assert.equal(envelope.data.resources.length, 9, 'normal CLI publishes three volume slabs plus six prepared sky faces');
    for (const resource of envelope.data.resources) { assert(resource.path.endsWith('.webp')); assert.equal(sha256(await readFile(join(prepared, resource.path))), resource.sha256); }
  } finally { await rm(root, { recursive: true, force: true }); }
});
