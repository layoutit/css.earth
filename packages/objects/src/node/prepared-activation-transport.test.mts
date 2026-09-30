import { projectRoot as findProjectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { preparedObjectText, readPreparedObjects } from '@cssearth/objects/node';
import { runtimeRepresentatives } from '@cssearth/objects/node/contract';
const test = sourceTest();

const root = findProjectRoot(import.meta.url);
const OBJECTS = readPreparedObjects(root).sceneObjects;

// The transport the site serves is built from the restored runtime (prepared-transport.ts) and carries it whole. Once per
// runtime structure: the transport reads nothing but the structure.
for (const { id, definition } of await runtimeRepresentatives(OBJECTS.map(object => object.id), root)) {
  test(`${id}: the served transport carries the restored runtime whole`, async () => {
    const directory = new URL(`src/objects/${id}/`, pathToFileURL(root + '/'));
    const descriptor = JSON.parse(await readFile(new URL('object.json', directory), 'utf8'));
    const payload = JSON.parse(await preparedObjectText(fileURLToPath(directory), descriptor));
    assert.equal(payload.id, id);
    assert.deepEqual(payload.data, JSON.parse(JSON.stringify(definition)));
  });
}
