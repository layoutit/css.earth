import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { preparedObjectText, readPreparedObjects } from '@cssearth/objects/node';
import { resolve } from 'node:path';
const test = sourceTest();

const OBJECTS = readPreparedObjects(findProjectRoot(import.meta.url)).sceneObjects;

// The transport is built from the restored runtime (prepared-transport.ts). The checked-in tree gate also runs in CI
// without requiring an asset download.
for (const { id } of OBJECTS) test(`${id}: serialized activation bank matches its descriptor and tree`, async () => {
  const root = new URL(`src/objects/${id}/`, pathToFileURL(findProjectRoot(import.meta.url) + '/'));
  const runtime = JSON.parse(await readFile(new URL('prepared/runtime.json', root), 'utf8'));
  const descriptor = JSON.parse(await readFile(new URL('object.json', root), 'utf8'));
  const payload = JSON.parse(await preparedObjectText(fileURLToPath(root), descriptor));
  assert.equal(payload.id, id);
  assert.deepEqual(payload.data.tree, runtime.tree, 'transport must use the checked-in prepared tree');
});
