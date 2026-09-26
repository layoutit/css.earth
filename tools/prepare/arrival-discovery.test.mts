import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preparedDefaultViewRotation } from '@cssearth/renderer/navigation';
import { prepareObjectDiscovery } from './prepare-object-discovery.mts';

test('a shape-only body gets a prepared arrival without becoming photographic', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'arrival-discovery-'));
  try {
    const prepared = join(directory, 'prepared');
    await mkdir(prepared);
    const runtime = JSON.parse(await readFile(new URL('../../src/objects/mercury/prepared/runtime.json', import.meta.url), 'utf8'));
    await writeFile(join(prepared, 'runtime.json'), JSON.stringify({ camera: runtime.camera }));
    await writeFile(join(prepared, 'controls.json'), JSON.stringify({ lenses: { defaultLens: 'shape', controls: [{ id: 'shape' }] } }));
    const billboard = { url: '/scenes/body/body-arrival.webp', lens: 'shape', size: 1024,
      distanceM: 8000, focalPixels: 1000, rotation: preparedDefaultViewRotation(runtime.camera) };
    await writeFile(join(prepared, 'arrival-billboard.json'), JSON.stringify(billboard));
    const descriptor = { properties: { catalog: {}, recipe: { sources: [] } } };
    const discovery = await prepareObjectDiscovery(descriptor, directory);
    assert.equal(discovery.imagery, false);
    assert.equal(discovery.illustration, false);
    assert.equal(discovery.featured, false);
    assert.equal(discovery.arrival?.billboard?.distanceM, 8000);
    assert.deepEqual(discovery.arrival?.lensIds, ['shape']);
    await writeFile(join(prepared, 'arrival-billboard.json'), JSON.stringify({ ...billboard, lens: 'stale' }));
    await assert.rejects(prepareObjectDiscovery(descriptor, directory), /Reprepare the arrival billboard/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
