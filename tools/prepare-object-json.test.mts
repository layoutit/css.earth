import {loadObjectTestDefinition} from './object-test-data.mts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseObjectDescriptor, readPreparedObject } from '@cssearth/objects';
import { SCENE_OBJECTS } from '../site/objects.mts';

for (const object of SCENE_OBJECTS) {
  let text;
  try { text = await readFile(new URL(`../src/objects/${object.id}/object.json`, import.meta.url), 'utf8'); }
  catch (error) {
    if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue;
    throw error;
  }
  test(`${object.id}: generic JSON transport preserves the complete prepared definition`, async () => {
    const descriptor = parseObjectDescriptor(text);
    assert.ok(descriptor.prepared);
    const raw = await readFile(new URL(`../src/objects/${descriptor.id}/${descriptor.prepared.url}`, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), descriptor.prepared.sha256);
    const envelope = readPreparedObject(JSON.parse(raw.toString('utf8')), descriptor, data => data);
    const runtimeDefinition = await loadObjectTestDefinition(object.id);
    assert.deepEqual(envelope.data, JSON.parse(JSON.stringify(runtimeDefinition)));
    assert.equal(envelope.id, object.id);
    assert.equal(envelope.type, descriptor.type);
  });
}
