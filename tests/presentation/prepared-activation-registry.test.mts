import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { prepareActivationGroups } from '@cssearth/bake/presentation';
import { requireObjectRuntimeDefinition } from '@cssearth/bake/contract';
import { readPreparedObjects } from '@cssearth/objects/node';
import { resolve } from 'node:path';

const OBJECTS = readPreparedObjects(resolve(import.meta.dirname, '../..')).sceneObjects;

// The same registry that ships the application owns this gate. A new object
// cannot opt out by omitting a browser profile or a hand-maintained test list.
for (const { id } of OBJECTS) test(`${id}: installed tree carries reproducible activation ownership`, async () => {
  const root = new URL(`../../src/objects/${id}/`, import.meta.url);
  const runtime = requireObjectRuntimeDefinition(JSON.parse(await readFile(new URL('prepared/runtime.json', root), 'utf8')));
  if (runtime.variants.some(variant => variant.writes.some(write => write.kind === 'texture'))) {
    assert.ok(Array.isArray(runtime.tree.textureBindings),
      'textured presentations must resolve their consumers during preparation, including an explicit empty result');
  }
  assert.deepEqual(runtime.tree.activationGroups, prepareActivationGroups(runtime));
  assert.ok(runtime.tree.activationGroups.flat().length > 0, 'detail requires prepared activation leaves');
});
