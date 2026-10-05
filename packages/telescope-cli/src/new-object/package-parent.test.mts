/** The system a new host's bodies are inside is written before the host's first bake (package-parent.mts). */
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { ensureHostSystem } from './package-parent.mts';

test('a new host is moved inside a system written where it sat, with its own card, and a system already there is kept', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'host-system-')), path = (id: string) => resolve(root, `src/objects/${id}/object.json`);
  const read = async (id: string) => JSON.parse(await readFile(path(id), 'utf8')) as Record<string, any>;
  try {
    const worldFrame = { referenceFrame: 'sun-icrf', originM: [1, 2, 3] };
    const catalog = { name: 'HD 1', classification: 'star', color: '#fff7fd', distanceAu: 43425864.2, description: 'HD 1 b crosses HD 1 as seen from Earth.', systemName: 'HD 1 system', order: 7 };
    await mkdir(resolve(root, 'src/objects/hd-1'), { recursive: true });
    await writeFile(path('hd-1'), JSON.stringify({ schema: 'cssearth-object@2', id: 'hd-1', parent: 'milky-way', type: 'star', properties: { catalog, worldFrame } }));
    assert.equal(await ensureHostSystem(root, 'hd-1', true), true);
    // As the bake's systems step writes a star's system with its bodies (site/build/prepare/system-packages.mts).
    assert.deepEqual(await read('hd-1-system'), { schema: 'cssearth-object@2', id: 'hd-1-system', parent: 'milky-way', type: 'system', generator: 'site/build/prepare/system-packages.mts',
      properties: { system: { host: 'hd-1' }, catalog: { name: 'HD 1 system', systemName: 'HD 1 system', classification: 'planetary-system', color: '#fff7fd', distanceAu: 43425864.2,
        description: 'HD 1 b crosses HD 1 as seen from Earth.' }, worldFrame } });
    const host = await read('hd-1');
    assert.deepEqual([host.parent, host.properties.catalog, Object.keys(host).slice(0, 3)], ['hd-1-system', catalog, ['schema', 'id', 'parent']]);
    assert.equal(await ensureHostSystem(root, 'hd-1', true), false, 'a system already there is kept');
    // A host with only a star bound to it makes a star system; a host that names no parent has no place for one.
    await mkdir(resolve(root, 'src/objects/hd-2'), { recursive: true });
    await writeFile(path('hd-2'), JSON.stringify({ schema: 'cssearth-object@2', id: 'hd-2', parent: 'milky-way', type: 'star', properties: { catalog: { ...catalog, systemName: 'HD 2 system' }, worldFrame } }));
    await ensureHostSystem(root, 'hd-2', false);
    assert.equal((await read('hd-2-system')).properties.catalog.classification, 'star-system');
    await mkdir(resolve(root, 'src/objects/hd-3'), { recursive: true });
    await writeFile(path('hd-3'), JSON.stringify({ schema: 'cssearth-object@2', id: 'hd-3', type: 'star', properties: { catalog, worldFrame } }));
    await assert.rejects(ensureHostSystem(root, 'hd-3', true), /src\/objects\/hd-3\/object\.json: the host of hd-3-system names no parent/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
