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
    await writeFile(resolve(root, 'prepared/surfaces.json'), JSON.stringify({ surfaces: [{ id: 'model', map: { url: '/not-a-geographic-map.png' }, source: { id: 'stooke-halley', sha256: 'a'.repeat(64) } }] }));
    await writeFile(resolve(root, 'source/presentation/minimap.json'), JSON.stringify({ excludeLenses: ['model'] }));
    const options = { objectDirectory: root, publicDirectory: root, outputDirectory: resolve(root, 'prepared') };
    assert.deepEqual(await prepareSurfaceMinimaps(options), []);
    assert.deepEqual(
      JSON.parse((await readFile(resolve(root, 'prepared/minimaps.json'))).toString('utf8')),
      { images: [] },
    );
    await writeFile(resolve(root, 'source/presentation/minimap.json'), JSON.stringify({ excludeLenses: ['typo'] }));
    await assert.rejects(prepareSurfaceMinimaps(options), /Invalid excluded/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

// Solid-body preparation records source metadata here; it is not a file path.
test('a prepared photo map uses its map URL when source is a provenance record', async () => {
  const {default:sharp} = await import('sharp');
  const root = await mkdtemp(resolve(tmpdir(), 'photo-minimap-test-'));
  try {
    await mkdir(resolve(root, 'prepared'));
    await sharp({create:{width:16,height:8,channels:3,background:'#ffffff'}}).png().toFile(resolve(root,'photo.png'));
    await writeFile(resolve(root, 'prepared/surfaces.json'), JSON.stringify({surfaces:[{
      id:'giotto',map:{url:'/scenes/comet-1p/photo.png'},source:{id:'giotto-projection',sha256:'a'.repeat(64),width:16,height:8},
    }]}));
    const result = await prepareSurfaceMinimaps({objectDirectory:root,publicDirectory:root,outputDirectory:resolve(root,'prepared')});
    assert.deepEqual(result.map(({id,width,height})=>({id,width,height})),[{id:'giotto',width:16,height:8}]);
    const {data} = await sharp(resolve(root,'prepared/minimaps/giotto.webp')).removeAlpha().raw().toBuffer({resolveWithObject:true});
    assert.ok(data.every(value=>value>=253));
  } finally {await rm(root,{recursive:true,force:true});}
});

test('refresh one prepared observation minimap while retaining an unavailable unrelated map', async () => {
  const objectDirectory = await mkdtemp(resolve(tmpdir(), 'cssearth-minimap-'));
  const outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve(objectDirectory, 'public');
  try {
    await mkdir(resolve(outputDirectory, 'minimaps'), { recursive: true }); await mkdir(publicDirectory);
    await writeFile(resolve(outputDirectory, 'surfaces.json'), JSON.stringify({ surfaces: [
      { id: 'camera', map: { url: '/scenes/test/camera-map.webp' } },
      { id: 'retained', map: { url: '/scenes/test/not-installed.webp' } },
    ] }));
    const retained = { id: 'retained', path: 'minimaps/retained.webp', width: 24, height: 12 };
    await writeFile(resolve(outputDirectory, 'minimaps.json'), JSON.stringify({ images: [
      { id: 'camera', path: 'minimaps/camera.webp', width: 24, height: 12 }, retained,
    ] }));
    await writeFile(resolve(outputDirectory, retained.path), 'retained bytes');
    await sharp({ create: { width: 80, height: 40, channels: 3, background: '#777777' } }).webp().toFile(resolve(publicDirectory, 'camera-map.webp'));
    await prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory, photographs: ['camera'] });
    const result = JSON.parse(await readFile(resolve(outputDirectory, 'minimaps.json'), 'utf8'));
    assert.deepEqual(result.images[1], retained);
    assert.equal(await readFile(resolve(outputDirectory, retained.path), 'utf8'), 'retained bytes');
    assert.equal(result.images[0].width, 80);
    await assert.rejects(prepareSurfaceMinimaps({ objectDirectory, publicDirectory, outputDirectory, photographs: ['missing'] }), /existing photographic surfaces/);
  } finally { await rm(objectDirectory, { recursive: true, force: true }); }
});
