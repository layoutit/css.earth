import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import sharp from 'sharp';
import type { VolumeSlices } from '@cssearth/bake/volume';
import { sha256 } from '@cssearth/core/node';
import { preparePlacedDensity } from './placed-assets.ts';

test('compact model placement reuses exact density/alpha bytes and restores missing generated resources', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'placed-density-'));
  const save = async (path: string, value: unknown) => {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
    await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), bytes); return sha256(bytes);
  };
  try {
    const pixel = await sharp(Buffer.from([100, 100, 100, 123]), { raw: { width: 1, height: 1, channels: 4 } }).png().toBuffer();
    const textureSha = await save('model/prepared/slice.png', pixel), gridSha = await save('model/source/density.ktx2', Buffer.from('canonical density bytes'));
    const recipeSha = await save('model/source/volume.json', { grid: { path: 'density.ktx2', sha256: gridSha } });
    const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2460000, originM: [0, 0, 60 * 3.085677581491367e19],
      localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 3.085677581491367e19, boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
    await save('model/object.json', { schema: 'cssearth-object@1', id: 'canonical', type: 'density-volume',
      properties: { volume: frame, preparation: { source: 'source/volume.json', sha256: recipeSha } } });
    const slices: VolumeSlices = { boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] }, provenance: {},
      approximation: { method: 'test', radialEmission: '', limitations: [], samplesPerSlab: 1, opticalWeight: 1, exposureGain: 1,
        sliceCounts: { x: 1, y: 1, z: 1 }, slabPitchUnits: { x: 2, y: 2, z: 2 } },
      quads: (['x', 'y', 'z'] as const).map((axis, index) => ({ id: axis, axis, sliceIndex: 0, texturePath: 'slice.png', widthPx: 1, heightPx: 1,
        vertices: index === 0 ? [[0, -1, -1], [0, 1, -1], [0, 1, 1], [0, -1, 1]] : index === 1 ?
          [[-1, 0, -1], [1, 0, -1], [1, 0, 1], [-1, 0, 1]] : [[-1, -1, 0], [1, -1, 0], [1, 1, 0], [-1, 1, 0]],
        center: [0, 0, 0], normal: index === 0 ? [1, 0, 0] : index === 1 ? [0, 1, 0] : [0, 0, 1],
        uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], sha256: textureSha, bytes: pixel.length, alphaCoverage: 1 })) };
    await save('model/prepared/volume-slices.json', slices);
    const placementPath = 'placement.json';
    const placementSha = await save(placementPath, { schema: 'cssearth-density-placement@1', scale: 1.5, rotationZDegrees: 45,
      pivotUnits: [0, 0, 0], translationUnits: [3, 4, 0], originalDensity: { path: 'model/source/volume.json', sha256: recipeSha } });
    const options = { sourceDirectory: 'model', outputDirectory: '.local/nebula-lab/placed', placement: { path: placementPath, sha256: placementSha } };
    await preparePlacedDensity(root, options);
    const directory = resolve(root, options.outputDirectory);
    assert.equal(await realpath(resolve(directory, 'prepared/slice.png')), await realpath(resolve(root, 'model/prepared/slice.png')));
    assert.deepEqual(await readFile(resolve(directory, 'prepared/slice.png')), pixel);
    assert.equal(sha256(await readFile(resolve(directory, 'source/density.ktx2'))), gridSha);
    const prepared = JSON.parse(await readFile(resolve(directory, 'prepared/volume.json'), 'utf8'));
    assert.ok(prepared.data.stacks[0].normalUnits[1] > .7);
    await rm(resolve(directory, 'prepared/slice.png'));
    await preparePlacedDensity(root, options);
    assert.deepEqual(await readFile(resolve(directory, 'prepared/slice.png')), pixel);
    const wrongSha = await save(placementPath, { schema: 'cssearth-density-placement@1', scale: 1, rotationZDegrees: 0,
      pivotUnits: [0, 0, 0], translationUnits: [0, 0, 0], originalDensity: { path: 'model/source/density.ktx2', sha256: gridSha } });
    await assert.rejects(preparePlacedDensity(root, { ...options, placement: { path: placementPath, sha256: wrongSha } }), /canonical density recipe/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
