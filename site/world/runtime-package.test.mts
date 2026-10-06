import { parsePreparedObjectRuntime, splitPreparedDatasetTables } from '@cssearth/objects';

// The prepared runtime contract and the shared selection owner, on the bodies with the most kinds of control. The code is
// the same for every body, and each body's own data is checked when it is prepared. CSSEARTH_TEST_OBJECTS=<id>[,<id>] runs
// those bodies instead (see anchor-table.mts).
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { SCENE_OBJECTS } from '../directory/objects.mts';
import { objectRuntimePackageTests, preparedSelectionFixture } from '@cssearth/renderer/test/object-runtime-package.mts';
import { loadObjectTestDefinition, required } from '@cssearth/objects/node/contract';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { isDeepStrictEqual } from 'node:util';
import { adoptPreparedDatasetTables } from '@cssearth/renderer';

import { selectedObjectIds } from './fixtures/anchor-table.mts';
import { projectRoot } from '../directory/fixtures/objects.mts';

/** Whether two node lists hold the same nodes in the same order. A plain boolean: a failed deep comparison of thousands
 * of fixture nodes formats them all into its message and runs the process out of memory. */
function sameNodes(actual: ArrayLike<unknown>, expected: ArrayLike<unknown>) {
  return actual.length === expected.length && Array.prototype.every.call(actual, (node, index) => node === expected[index]);
}

/** The dataset ids the prepared controls publish, in their published order. */
function datasetIds(definition: unknown): string[] {
  const controls = requireRecord(requireRecord(definition).controls, 'runtime controls');
  const datasets = controls.datasets === undefined ? [] : requireArray(requireRecord(controls.datasets, 'runtime datasets').controls, 'runtime dataset controls');
  return datasets.map((dataset, index) => requireString(requireRecord(dataset, `dataset ${index}`).id, `dataset ${index} id`));
}

const ids = process.env.CSSEARTH_TEST_OBJECTS ? selectedObjectIds(SCENE_OBJECTS.map(object => object.id)) : ['earth', 'moon', 'saturn'];
for (const id of ids) {
  const definition = await loadObjectTestDefinition(id, projectRoot);
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
      assert.ok(sameNodes(f.stage.querySelectorAll('*'), nodes), 'toggles keep the retained tree');
      assert.deepEqual(f.errors, []);
      f.lifetime.destroy();
      assert.equal(f.listenerCount(), 0);
    } finally { f.restore(); }
  });

  const ids = datasetIds(definition);
  // A dataset may swap which prepared mesh or cutaway is mounted (prepared-omitted-nodes.ts); it never makes new nodes, and
  // the first dataset's tree comes back whole.
  if (ids.length > 1) test(`${id}: dataset selection reuses the prepared nodes and commits every published dataset`, async () => {
    const f = await preparedSelectionFixture(definition);
    try {
      const records = f.stage.querySelectorAll('*'), made = f.document.created;
      for (const dataset of [...ids.slice(1), ids[0]]) {
        const request = f.selection.dispatch({ kind: 'dataset', id: dataset });
        await f.settle();
        assert.equal(await request, true, dataset);
        assert.equal(required(f.selection.state().committed).datasetId, dataset);
      }
      assert.ok(sameNodes(f.stage.querySelectorAll('*'), records), 'the first dataset gets its tree back');
      assert.equal(f.document.created, made, 'no dataset makes new nodes');
      assert.deepEqual(f.errors, []);
    } finally { f.restore(); }
  });
}

// A dataset whose tables travel apart from the object transport (dataset-tables.ts) waits for them while the committed
// dataset keeps drawing, then commits the demand and styles the complete runtime commits.
test('earth: a dataset whose tables travel apart commits once they arrive, as the complete runtime commits it', async () => {
  const complete = await loadObjectTestDefinition('earth', projectRoot);
  const { definition: split, tables } = splitPreparedDatasetTables(parsePreparedObjectRuntime(structuredClone(complete)));
  const table = required(tables[0]);
  let arrive = () => {};
  const arrived = new Promise<void>(resolve => { arrive = resolve; });
  const reads: string[] = [];
  const f = await preparedSelectionFixture(split, { async readDatasetTables(datasetId) {
    reads.push(datasetId);
    await arrived;
    adoptPreparedDatasetTables(split, table, datasetId);
  } });
  const g = await preparedSelectionFixture(complete);
  type Fixture = typeof f;
  const names = [...new Set([...parsePreparedObjectRuntime(structuredClone(complete)).variants.flatMap(variant => variant.writes.map(write => write.name)),
    'backgroundImage', 'backgroundPosition', 'backgroundSize', 'display'])];
  const read = (style: Fixture['stage']['style'], name: string) => name.startsWith('--') ? style.getPropertyValue(name) : String(Reflect.get(style, name) ?? '');
  const drawn = (fixture: Fixture) => [JSON.stringify(fixture.stage.dataset),
    ...[fixture.stage, ...fixture.stage.querySelectorAll('*')].map(node => names.map(name => read(node.style, name)).join('|'))];
  try {
    const before = drawn(f), request = f.selection.dispatch({ kind: 'dataset', id: table.datasetId });
    await f.settle();
    assert.deepEqual(reads, [table.datasetId]);
    assert.equal(required(f.selection.state().committed).datasetId, required(split.controls.datasets).defaultDataset);
    assert.equal(f.selection.state().pending, true);
    assert.ok(isDeepStrictEqual(drawn(f), before), 'nothing changes before the tables arrive');
    arrive();
    await f.settle();
    assert.equal(await request, true);
    const expected = g.selection.dispatch({ kind: 'dataset', id: table.datasetId });
    await g.settle();
    assert.equal(await expected, true);
    assert.deepEqual(required(f.selection.state().plan).required, required(g.selection.state().plan).required);
    assert.deepEqual(f.residency.stats().committed, g.residency.stats().committed);
    assert.ok(isDeepStrictEqual(drawn(f), drawn(g)), 'the split runtime draws what the complete one draws');
    assert.deepEqual([...f.errors, ...f.materialErrors, ...g.errors, ...g.materialErrors], []);
  } finally { f.restore(); g.restore(); }
});
