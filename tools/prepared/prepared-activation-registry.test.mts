import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { SCENE_OBJECTS as OBJECTS } from '../../site/objects.mts';
import { prepareActivationGroups } from '@cssearth/bake/presentation';

// The same registry that ships the application owns this gate. A new object
// cannot opt out by omitting a browser profile or a hand-maintained test list.
for (const { id } of OBJECTS) test(`${id}: checked-in tree carries reproducible activation ownership`, async () => {
  const root = new URL(`../../src/objects/${id}/`, import.meta.url);
  const runtime = JSON.parse(await readFile(new URL('prepared/runtime.json', root), 'utf8'));
  assert.deepEqual(runtime.tree.activationGroups, prepareActivationGroups(runtime));
  assert.ok(runtime.tree.activationGroups.flat().length > 0, 'detail requires prepared activation leaves');
});
