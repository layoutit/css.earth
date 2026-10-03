import assert from 'node:assert/strict';
import test from 'node:test';
import { loadObjectTestDefinition } from '@cssearth/objects/node/contract';
import { requireObjectRuntimeDefinition } from './index.ts';

const definition = requireObjectRuntimeDefinition(await loadObjectTestDefinition('moon'));
for (const name of ['createPresentation', 'resolvePresentation', 'reduceSelection']) {
  test(`preparation rejects executable ${name} before invoking it`, () => {
    let invoked = false;
    assert.throws(() => requireObjectRuntimeDefinition({ ...definition, [name]() { invoked = true; return Promise.resolve(); } }), /acyclic JSON|unsupported/);
    assert.equal(invoked, false);
  });
}
