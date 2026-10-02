import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preparedDefaultViewRotation } from '@cssearth/renderer/navigation/prepared-arrival-view.ts';
import { prepareObjectDiscovery } from '../build/prepare/prepare-object-discovery.mts';
import { parseObjectDiscovery } from '@cssearth/objects';

test('a shape-only body gets a prepared arrival without becoming photographic', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arrival-discovery-'));
  try {
    const prepared = join(directory, 'prepared');
    await mkdir(prepared);
    const runtime = JSON.parse(await readFile(new URL('../../src/objects/mercury/prepared/runtime.json', import.meta.url), 'utf8'));
    await writeFile(join(prepared, 'runtime.json'), JSON.stringify({ camera: runtime.camera }));
    await writeFile(join(prepared, 'controls.json'), JSON.stringify({ datasets: { defaultDataset: 'shape', controls: [{ id: 'shape' }] } }));
    const billboard = { url: '/scenes/body/body-arrival.webp', dataset: 'shape', size: 1024,
      distanceM: 8000, focalPixels: 1000, rotation: preparedDefaultViewRotation(runtime.camera) };
    await writeFile(join(prepared, 'arrival-billboard.json'), JSON.stringify(billboard));
    const descriptor = { properties: { catalog: {}, recipe: { sources: [] } } };
    const discovery = await prepareObjectDiscovery(descriptor, directory);
    assert.equal(discovery.imagery, false);
    assert.equal(discovery.illustration, false);
    assert.equal(discovery.featured, false);
    assert.equal(discovery.arrival?.billboard?.distanceM, 8000);
    assert.deepEqual(discovery.arrival?.datasetIds, ['shape']);
    assert.equal(parseObjectDiscovery(discovery).imagery, false);
    await writeFile(join(prepared, 'controls.json'), JSON.stringify({ datasets: { defaultDataset: 'shape', controls: [{ id: 'shape' }, { id: 'photo' }] } }));
    await writeFile(join(directory, 'raster.json'), JSON.stringify({ observations: [{ id: 'photo' }] }));
    const photographed = await prepareObjectDiscovery({ properties: { catalog: {}, recipe: { sources: [{ id: 'raster', path: 'raster.json' }] } } }, directory);
    assert.deepEqual(photographed.arrival?.datasetIds, ['shape', 'photo'], 'a photographic alternative cannot exclude the default billboard');
    assert.equal(parseObjectDiscovery(photographed).imagery, true);
    await writeFile(join(prepared, 'arrival-billboard.json'), JSON.stringify({ ...billboard, dataset: 'stale' }));
    await assert.rejects(prepareObjectDiscovery(descriptor, directory), /Reprepare the arrival billboard/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an object without a surface is reached on its default view when its dataset is pictured, not when it is dots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'arrival-discovery-')), directory = join(root, 'galaxy');
  try {
    const runtime = JSON.parse(await readFile(new URL('../../src/objects/m31/prepared/runtime.json', import.meta.url), 'utf8'));
    for (const path of ['galaxy/prepared', 'galaxy/source/content', 'layers', 'dots']) await mkdir(join(root, path), { recursive: true });
    await writeFile(join(directory, 'prepared/runtime.json'), JSON.stringify({ camera: runtime.camera }));
    await writeFile(join(root, 'layers/object.json'), JSON.stringify({ type: 'image-layer-bank' }));
    await writeFile(join(root, 'dots/object.json'), JSON.stringify({ type: 'catalogue-point-bank' }));
    const content = (volume: string) => writeFile(join(directory, 'source/content/object.json'),
      JSON.stringify({ datasets: { defaultDataset: 'optical', controls: [{ id: 'optical', volume: { objectId: volume } }] } }));
    const descriptor = { id: 'galaxy', properties: { catalog: {}, recipe: { surfaces: [], sources: [] } } };
    await content('layers');
    const pictured = await prepareObjectDiscovery(descriptor, directory);
    assert.equal(pictured.imagery, true);
    assert.deepEqual(pictured.arrival, { defaultDataset: 'optical', datasetIds: ['optical'], rotation: preparedDefaultViewRotation(runtime.camera) });
    assert.equal(parseObjectDiscovery(pictured).arrival?.billboard, undefined, 'the view is not an arrival image');
    await content('dots');
    const dots = await prepareObjectDiscovery(descriptor, directory);
    assert.equal(dots.imagery, false);
    assert.equal(dots.arrival, undefined, 'a field of catalogue dots keeps the direction the flight came from');
  } finally { await rm(root, { recursive: true, force: true }); }
});
