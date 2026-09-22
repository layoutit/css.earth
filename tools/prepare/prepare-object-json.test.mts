import {loadObjectTestDefinition} from '../contract/object-test-data.mts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { parseObjectDescriptor, readPreparedObject } from '@cssearth/objects';
import { SCENE_OBJECTS } from '../../site/objects.mts';
import { refuseStaleKeptBindings } from './prepare-object-json.mts';

test('--keep-bindings refuses when the solved system transform moved', () => {
  // A body outside any solved lane (world-context focus, or a lane with nothing to solve) carries no system transform.
  assert.doesNotThrow(() => refuseStaleKeptBindings('sun', null));
  // solveSystemTransform's {from, to} is a no-op pair when the system node did not move (prepare-world-navigation.ts's
  // replaceSystemTransform short-circuits on solved.from === solved.to), regardless of whether the body has any
  // physical material track — this must hold for irregular shape-model bodies (e.g. Mimas) with no materials at all.
  assert.doesNotThrow(() => refuseStaleKeptBindings('mimas', { from: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', to: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' }));
  const moved = { from: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', to: 'matrix3d(0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1)' };
  assert.throws(() => refuseStaleKeptBindings('mimas', moved), /--keep-bindings refused/);
  assert.throws(() => refuseStaleKeptBindings('mimas', moved), /mimas/);
});

for (const object of SCENE_OBJECTS) {
  let text;
  try { text = await readFile(new URL(`../../src/objects/${object.id}/object.json`, import.meta.url), 'utf8'); }
  catch (error) {
    if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') continue;
    throw error;
  }
  test(`${object.id}: generic JSON transport preserves the complete prepared definition`, async () => {
    const descriptor = parseObjectDescriptor(text);
    assert.ok(descriptor.prepared);
    const raw = await readFile(new URL(`../../src/objects/${descriptor.id}/${descriptor.prepared.url}`, import.meta.url));
    assert.equal(createHash('sha256').update(raw).digest('hex'), descriptor.prepared.sha256);
    const envelope = readPreparedObject(JSON.parse(raw.toString('utf8')), descriptor, data => data);
    const runtimeDefinition = await loadObjectTestDefinition(object.id);
    assert.deepEqual(envelope.data, JSON.parse(JSON.stringify(runtimeDefinition)));
    assert.equal(envelope.id, object.id);
    assert.equal(envelope.type, descriptor.type);
  });
}
