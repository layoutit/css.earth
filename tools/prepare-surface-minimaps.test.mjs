import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { prepareSurfaceMinimaps } from './prepare-surface-minimaps.mts';
import sharp from 'sharp';

test('prepared surface provenance does not replace its map image path', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'prepared-minimap-test-'));
  try {
    await mkdir(resolve(root, 'prepared'));
    await mkdir(resolve(root, 'source/preparation'), { recursive: true });
    await sharp({ create: { width: 8, height: 4, channels: 3, background: '#123456' } }).png().toFile(resolve(root, 'albedo.png'));
    await writeFile(resolve(root, 'prepared/controls.json'), JSON.stringify({ lenses: { controls: [{ id: 'albedo' }] } }));
    const surface = { id: 'albedo', map: { url: '/scenes/example/albedo.png' }, source: { id: 'released-albedo', sha256: 'a'.repeat(64), width: 8, height: 4 } };
    await writeFile(resolve(root, 'prepared/surfaces.json'), JSON.stringify({ surfaces: [surface] }));
    const options = { objectDirectory: root, publicDirectory: root, outputDirectory: resolve(root, 'prepared') };
    const images = await prepareSurfaceMinimaps(options);
    assert.equal(images.length, 1);
    const result = await sharp(resolve(root, 'prepared', images[0].path)).metadata();
    assert.equal(result.width, 8);
    assert.equal(result.height, 4);
    await writeFile(resolve(root, 'prepared/surfaces.json'), JSON.stringify({ surfaces: [{ ...surface, source: 42 }] }));
    await assert.rejects(prepareSurfaceMinimaps(options), /source/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a model-only lens can omit a misleading flat map without opening its image', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'comet-minimap-test-'));
  try {
    await mkdir(resolve(root, 'source/presentation'), { recursive: true });
    await mkdir(resolve(root, 'prepared'));
    await mkdir(resolve(root, 'source/preparation'));
    await writeFile(resolve(root, 'source/preparation/terrestrial.json'), JSON.stringify({ schema: 'cssearth-terrestrial-preparation@1', kind: 'solid-observation-body' }));
    await writeFile(resolve(root, 'prepared/controls.json'), JSON.stringify({ lenses: { controls: [{ id: 'model' }] } }));
    await writeFile(resolve(root, 'prepared/surfaces.json'), JSON.stringify({ surfaces: [{ id: 'model', map: { url: '/not-a-geographic-map.png' } }] }));
    await writeFile(resolve(root, 'source/presentation/minimap.json'), JSON.stringify({ excludeLenses: ['model'] }));
    const options = { objectDirectory: root, publicDirectory: root, outputDirectory: resolve(root, 'prepared') };
    assert.deepEqual(await prepareSurfaceMinimaps(options), []);
    assert.deepEqual(JSON.parse(await readFile(resolve(root, 'prepared/minimaps.json'))), { images: [] });
    await writeFile(resolve(root, 'source/presentation/minimap.json'), JSON.stringify({ excludeLenses: ['typo'] }));
    await assert.rejects(prepareSurfaceMinimaps(options), /Invalid excluded/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
