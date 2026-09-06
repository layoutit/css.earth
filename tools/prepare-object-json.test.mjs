import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseObjectDescriptor, readPreparedObject } from '@cssearth/objects';
import { OBJECTS } from '../site/objects.mjs';

for (const object of OBJECTS) {
  let text;
  try { text = await readFile(new URL(`../src/planets/${object.id}/object.json`, import.meta.url), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  test(`${object.id}: generic JSON transport preserves the complete prepared definition`, async () => {
    const descriptor = parseObjectDescriptor(text);
    const raw = await readFile(new URL(`../objects/${descriptor.prepared.url}`, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), descriptor.prepared.sha256);
    const envelope = readPreparedObject(JSON.parse(raw), descriptor, data => data);
    const { runtimeDefinition } = await import(`../src/planets/${object.id}/runtime/definition.mjs`);
    assert.deepEqual(envelope.data, JSON.parse(JSON.stringify(runtimeDefinition)));
    assert.equal(envelope.id, object.id);
    assert.equal(envelope.type, descriptor.type);
  });
}
