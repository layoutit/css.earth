import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { decodeCatalogueBankBinary } from '@cssearth/objects';
import { inventoryPreparedAssets, unpackPreparedBinary } from '@cssearth/objects/node';
import { writeCatalogueBank } from '@cssearth/bake/volume/node';

test('repacking preserves the published bank even when stale scratch output exists', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'repack-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const objectDirectory = resolve(root, 'src/objects/fixture');
  const original = { schema: 'cssearth-catalogue-points@1', id: 'dots', points: [[1, 2, 3], [4, 5, 6]] };
  const inventory = () => inventoryPreparedAssets({ objectId: 'fixture', objectDirectory, gitTrackedPaths: async () => new Set() });
  await writeCatalogueBank({ objectDirectory, id: 'dots', bank: original, published: true, inventory });
  await writeCatalogueBank({ objectDirectory, id: 'dots', bank: { ...original, points: [[99, 99, 99]] }, published: false, repositoryRoot: root });
  await promisify(execFile)(process.execPath, [resolve(import.meta.dirname, 'pack-prepared-banks.mts'), objectDirectory]);
  const path = resolve(objectDirectory, 'prepared/dots.bin');
  const restored = decodeCatalogueBankBinary(unpackPreparedBinary(await readFile(path), path), path);
  assert.deepEqual(restored.points, original.points);
});
