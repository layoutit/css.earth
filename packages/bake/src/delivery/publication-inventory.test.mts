import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { sha256 } from '@cssearth/core/node';
import { inventoryPreparedAssets, inventoryText, readInventory, verifyInventory } from '@cssearth/objects/node';
import { publishPreparedObject } from '@cssearth/bake/delivery';

test('publication updates prepared inventory pins with the staged runtime', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'object-publication-'));
  try {
    const id = 'fixture', stage = resolve(root, 'stage'), objectDirectory = resolve(root, 'object');
    const outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve(root, 'public');
    const stagedData = resolve(stage, 'prepared'), stagedPublic = resolve(stage, 'public');
    await Promise.all([stagedData, stagedPublic, outputDirectory, publicDirectory, resolve(stagedData, 'minimaps'), resolve(outputDirectory, 'minimaps')].map(path => mkdir(path, { recursive: true })));
    const oldRuntime = Buffer.from('{"version":1}\n'), newRuntime = Buffer.from('{"version":2}\n');
    const texture = Buffer.from('prepared texture'), text = Buffer.from('{"facts":[]}\n'), gone = Buffer.from('{"old":true}\n');
    const leftMap = Buffer.from('minimap of a dataset that left'), keptMap = Buffer.from('minimap of a dataset that stays');
    const minimapList = (...names: string[]) => Buffer.from(JSON.stringify({ images: names.map(name => ({ path: `minimaps/${name}.webp` })) }));
    const pin = (filename: string, bytes: Buffer) => ({ filename, bytes: bytes.length, sha256: sha256(bytes) });
    const oldInventory = { schema: 'cssearth-inventory@1' as const, assets: [
      { location: 'public' as const, ...pin('surface.webp', texture) },
      { location: 'prepared' as const, ...pin('runtime.json', oldRuntime) },
      // Written by another step, not by the bake: kept while its bytes are on disk.
      { location: 'prepared' as const, ...pin('text.json', text) },
      // Recorded but no longer on disk: dropped.
      { location: 'prepared' as const, ...pin('stale.json', gone) },
      // A minimap the staged set no longer lists: still on disk, removed by this publication, and dropped with it.
      { location: 'prepared' as const, ...pin('minimaps.json', minimapList('left', 'kept')) },
      { location: 'prepared' as const, ...pin('minimaps/left.webp', leftMap) },
      { location: 'prepared' as const, ...pin('minimaps/kept.webp', keptMap) },
    ] };
    const publicManifest = { schema: 'cssearth-inventory@1' as const, assets: [
      { location: 'public' as const, ...pin('surface.webp', texture) },
    ] };
    await Promise.all([
      writeFile(resolve(objectDirectory, 'inventory.json'), inventoryText(oldInventory)),
      writeFile(resolve(outputDirectory, 'runtime.json'), oldRuntime),
      writeFile(resolve(outputDirectory, 'text.json'), text),
      writeFile(resolve(publicDirectory, 'surface.webp'), texture),
      writeFile(resolve(stage, 'object.json'), '{}\n'),
      writeFile(resolve(stagedData, 'inventory.json'), inventoryText(publicManifest)),
      writeFile(resolve(stagedData, 'runtime.json'), newRuntime),
      writeFile(resolve(stagedPublic, 'surface.webp'), texture),
      writeFile(resolve(outputDirectory, 'minimaps.json'), minimapList('left', 'kept')),
      writeFile(resolve(outputDirectory, 'minimaps/left.webp'), leftMap),
      writeFile(resolve(outputDirectory, 'minimaps/kept.webp'), keptMap),
      writeFile(resolve(stagedData, 'minimaps.json'), minimapList('kept')),
      writeFile(resolve(stagedData, 'minimaps/kept.webp'), keptMap),
    ]);
    const prepared = await inventoryPreparedAssets({ objectId: id, objectDirectory: stage, preparedRoot: stagedData });
    assert.deepEqual(prepared?.assets.map(asset => asset.filename), ['minimaps.json', 'minimaps/kept.webp', 'runtime.json']);
    await publishPreparedObject({ id, stage, objectDirectory, publicDirectory, outputDirectory, projectRoot: root });
    const inventory = await readInventory(id, objectDirectory);
    assert.ok(inventory);
    assert.equal(inventory.assets.find(asset => asset.location === 'prepared' && asset.filename === 'runtime.json')?.sha256, sha256(newRuntime));
    assert.deepEqual(inventory.assets.filter(asset => asset.location === 'prepared').map(asset => asset.filename), ['minimaps.json', 'minimaps/kept.webp', 'runtime.json', 'text.json']);
    await assert.rejects(readFile(resolve(outputDirectory, 'minimaps/left.webp')), /ENOENT/u);
    assert.equal((await readFile(resolve(outputDirectory, 'runtime.json'))).toString(), newRuntime.toString());
    await verifyInventory({ objectId: id, inventory, preparedRoot: outputDirectory, publicRoot: publicDirectory });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
