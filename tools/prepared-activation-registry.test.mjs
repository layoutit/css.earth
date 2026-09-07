import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { OBJECTS } from '../site/objects.mjs';
import { prepareActivationGroups } from './prepared-activation-groups.mjs';

// The same registry that ships the application owns this gate. A new object
// cannot opt out by omitting a browser profile or a hand-maintained test list.
for (const { id } of OBJECTS) test(`${id}: transport carries reproducible activation ownership`, async () => {
  const root = new URL(`../src/planets/${id}/`, import.meta.url);
  const runtime = JSON.parse(await readFile(new URL('prepared/runtime.json', root), 'utf8'));
  const descriptor = JSON.parse(await readFile(new URL('object.json', root), 'utf8'));
  const bytes = await readFile(new URL(descriptor.prepared.url, root));
  const payload = JSON.parse(bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), descriptor.prepared.sha256);
  assert.equal(payload.id, id);
  assert.deepEqual(payload.data.tree, runtime.tree, 'transport must use the checked-in prepared tree');
  assert.deepEqual(runtime.tree.activationGroups, prepareActivationGroups(runtime));
  assert.ok(runtime.tree.activationGroups.flat().length > 0, 'detail requires prepared activation leaves');
});
