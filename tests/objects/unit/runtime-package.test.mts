// One runner for the prepared runtime contract of every registered object, replacing the
// per-body runtime-contract files that stamped the same checks with the body's name filled in.
// CSSEARTH_TEST_OBJECTS=<id>[,<id>] limits a run to those bodies (see anchor-table.mts).
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SCENE_OBJECTS } from '../../../site/objects.mts';
import { objectRuntimePackageTests, preparedSelectionFixture } from '../../../src/platform/test/object-runtime-package.mts';
import { required } from '../../../tools/contract/test-values.mts';
import { requireArray, requireRecord, requireString } from '../../../tools/sources/source-values.mts';
import { selectedObjectIds } from './anchor-table.mts';
import { projectRoot } from '../fixtures.mts';

async function preparedRuntime(id: string): Promise<unknown> {
  const text = await readFile(resolve(projectRoot, 'src/objects', id, 'prepared/runtime.json'), 'utf8').catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  });
  return text === null ? null : JSON.parse(text);
}

/** The lens ids the prepared controls publish, in their published order. */
function lensIds(definition: unknown): string[] {
  const controls = requireRecord(requireRecord(definition).controls, 'runtime controls');
  const lenses = controls.lenses === undefined ? [] : requireArray(requireRecord(controls.lenses, 'runtime lenses').controls, 'runtime lens controls');
  return lenses.map((lens, index) => requireString(requireRecord(lens, `lens ${index}`).id, `lens ${index} id`));
}

for (const id of selectedObjectIds(SCENE_OBJECTS.map(object => object.id))) {
  const definition = await preparedRuntime(id);
  if (definition === null) continue;
  objectRuntimePackageTests(definition);

  test(`${id}: every declared toggle commits through the shared selection owner without touching the retained tree`, async () => {
    const f = await preparedSelectionFixture(definition);
    try {
      const nodes = f.stage.querySelectorAll('*');
      for (const [name, input] of f.inputs) {
        if (input.getAttribute('type') !== 'checkbox') continue;
        input.checked = !input.checked;
        const listener = required(input.listeners.get('change'));
        if (typeof listener === 'function') listener(new Event('change')); else listener.handleEvent(new Event('change'));
        await f.settle();
        assert.equal(required(f.selection.state().committed)[name], input.checked, name);
      }
      assert.equal(f.inputs.get('stars'), undefined, 'the shared universe owns the sky');
      assert.equal(f.inputs.get('orbit'), undefined, 'no object publishes its own orbit toggle');
      assert.deepEqual(f.stage.querySelectorAll('*'), nodes);
      assert.deepEqual(f.errors, []);
      f.lifetime.destroy();
      assert.equal(f.listenerCount(), 0);
    } finally { f.restore(); }
  });

  const ids = lensIds(definition);
  if (ids.length > 1) test(`${id}: lens selection keeps the retained tree and commits every published lens`, async () => {
    const f = await preparedSelectionFixture(definition);
    try {
      const records = f.stage.querySelectorAll('*');
      for (const lens of [...ids.slice(1), ids[0]]) {
        const request = f.selection.dispatch({ kind: 'lens', id: lens });
        await f.settle();
        assert.equal(await request, true, lens);
        assert.equal(required(f.selection.state().committed).lensId, lens);
        assert.deepEqual(f.stage.querySelectorAll('*'), records);
      }
      assert.deepEqual(f.errors, []);
    } finally { f.restore(); }
  });
}
