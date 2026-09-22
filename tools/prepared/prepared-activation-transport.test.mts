import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { SCENE_OBJECTS as OBJECTS } from '../../site/objects.mts';

// Run after prepare:object-json. The checked-in tree gate also runs in CI
// without requiring generated transports or an asset download.
for (const { id } of OBJECTS) test(`${id}: serialized activation bank matches its descriptor and tree`, async () => {
  const root = new URL(`../../src/objects/${id}/`, import.meta.url);
  const runtime = JSON.parse(await readFile(new URL('prepared/runtime.json', root), 'utf8'));
  const descriptor = JSON.parse(await readFile(new URL('object.json', root), 'utf8'));
  const bytes = await readFile(new URL(descriptor.prepared.url, root));
  const payload = JSON.parse(bytes.toString('utf8'));
  assert.equal(payload.id, id);
  assert.deepEqual(payload.data.tree, runtime.tree, 'transport must use the checked-in prepared tree');
});
