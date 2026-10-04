import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { prepareClusterCatalogObject } from '@cssearth/bake/cluster-catalog';
import { prepareGalaxyCatalogObject } from '@cssearth/bake/galaxy-catalog';

for (const prepare of [prepareClusterCatalogObject, prepareGalaxyCatalogObject]) {
  test(`${prepare.name} requires the authored identity before reading inputs or writing outputs`, async () => {
    const objectDirectory = await mkdtemp(resolve(tmpdir(), 'catalogue-identity-'));
    try {
      await assert.rejects(prepare({ objectDirectory }), { message: `object.json is missing for ${objectDirectory}` });
      await writeFile(resolve(objectDirectory, 'object.json'), JSON.stringify({ id: 'different-directory' }));
      await assert.rejects(prepare({ objectDirectory }), /authored descriptor id "different-directory" must match directory/u);
      for (const id of [undefined, '', 42, '../escape']) {
        await writeFile(resolve(objectDirectory, 'object.json'), JSON.stringify({ id }));
        await assert.rejects(prepare({ objectDirectory }), /object.json: authored descriptor id is required\./u);
      }
    } finally { await rm(objectDirectory, { recursive: true, force: true }); }
  });
}
