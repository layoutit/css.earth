import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseObjectDiscovery, OBJECT_RUNTIME_SCHEMA, OBJECT_SCHEMA, OBJECT_CONTENT_SCHEMA, OBJECT_CONTENT_VERSION, RASTER_RECIPE_SCHEMA } from '@cssearth/objects';
import { preparedDefaultViewRotation } from '@cssearth/engine';
import { prepareObjectDiscovery } from './prepare-object-discovery.mts';

test('a shape-only body gets a prepared arrival without becoming photographic', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arrival-discovery-'));
  try {
    const prepared = join(directory, 'prepared');
    await mkdir(prepared);
    const runtime = JSON.parse(await readFile(new URL('../../../src/objects/mercury/prepared/runtime.json', import.meta.url), 'utf8'));
    const stored = (controls: unknown[]) => writeFile(join(prepared, 'runtime.json'), JSON.stringify({ schema: OBJECT_RUNTIME_SCHEMA, camera: runtime.camera,
      controls: { datasets: { defaultDataset: 'shape', controls } } }));
    await stored([{ id: 'shape' }]);
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
    await stored([{ id: 'shape' }, { id: 'photo' }]);
    await writeFile(join(directory, 'raster.json'), JSON.stringify({ schema: RASTER_RECIPE_SCHEMA, observations: [{ id: 'photo' }] }));
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
    const runtime = JSON.parse(await readFile(new URL('../../../src/objects/m31/prepared/runtime.json', import.meta.url), 'utf8'));
    for (const path of ['galaxy/prepared', 'galaxy/source/content', 'layers', 'dots']) await mkdir(join(root, path), { recursive: true });
    await writeFile(join(directory, 'prepared/runtime.json'), JSON.stringify({ schema: OBJECT_RUNTIME_SCHEMA, camera: runtime.camera }));
    await writeFile(join(root, 'layers/object.json'), JSON.stringify({ schema: OBJECT_SCHEMA, id: 'layers', type: 'image-layer-bank', properties: {} }));
    await writeFile(join(root, 'dots/object.json'), JSON.stringify({ schema: OBJECT_SCHEMA, id: 'dots', type: 'catalogue-point-bank', properties: {} }));
    const content = (volume: string) => writeFile(join(directory, 'source/content/object.json'),
      JSON.stringify({ schema: OBJECT_CONTENT_SCHEMA, version: OBJECT_CONTENT_VERSION, id: 'galaxy', displayName: 'Galaxy',
        datasets: { defaultDataset: 'optical', controls: [{ id: 'optical', label: 'Optical', volume: { objectId: volume, datasetId: 'optical', surface: 'surface' } }] } }));
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
