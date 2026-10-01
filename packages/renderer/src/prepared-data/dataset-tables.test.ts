import { readFile } from 'node:fs/promises';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { parseObjectDescriptor } from '@cssearth/objects';
import { parsePreparedObjectRuntime } from '../validation/index.js';
import { loadPreparedCssObject, loadPreparedDataset } from '../loader.js';
import { selectedPreparedVariant } from '../rendering/prepared-presentation.js';
import { serializePreparedScene } from '../rendering/prepared-scene-serialization.js';
import { initialObjectSelection } from '../runtime/object-contract.js';
import { createObjectControlBinding } from '../rendering/object-control-binding.js';
import { parseHTML } from 'linkedom';
import type { ObjectRuntimeDefinition } from '../runtime/object-runtime-types.js';
import { adoptPreparedDatasetTables, deferredDatasetIds, preparedDatasetReference, splitPreparedDatasetTables } from './dataset-tables.js';

const root = new URL('../../../../', import.meta.url);
async function runtime(id: string) {
  return parsePreparedObjectRuntime(JSON.parse(await readFile(new URL(`src/objects/${id}/prepared/runtime.json`, root), 'utf8')), { parsedJson: true });
}
/** Key order is not part of a table: compare levels as sorted entries and the asset list as a set. */
const tablesOf = (definition: ObjectRuntimeDefinition) => ({
  variants: definition.variants,
  entries: [...definition.assets.entries].sort((a, b) => a.key.localeCompare(b.key)),
  levels: definition.textureLevels?.levels.map(level => ({ minimumDiameter: level.minimumDiameter,
    resources: Object.entries(level.resources).sort(), tiles: level.tiles && Object.entries(level.tiles).sort() })),
});

for (const id of ['earth', 'mars']) test(`${id}: the transport keeps its default dataset, and adopting every other dataset's tables restores the runtime`, async () => {
  const complete = await runtime(id), defaultId = complete.controls.datasets!.defaultDataset;
  const { definition, tables } = splitPreparedDatasetTables(structuredClone(complete));
  const deferred = deferredDatasetIds(complete.controls);
  assert.ok(deferred.length > 0);
  assert.deepEqual(definition.deferredDatasets, deferred);
  assert.deepEqual(tables.map(table => table.datasetId), deferred);
  // The split definition is a valid runtime whose default selection is the complete one's.
  const base = parsePreparedObjectRuntime(JSON.parse(JSON.stringify(definition)), { parsedJson: true });
  const selection = initialObjectSelection(base.controls);
  assert.equal(selection.datasetId, defaultId);
  assert.deepEqual(selectedPreparedVariant(base, selection), selectedPreparedVariant(complete, selection));
  assert.deepEqual(serializePreparedScene(base), serializePreparedScene(complete));
  assert.ok(JSON.stringify(base).length < JSON.stringify(complete).length);
  for (const datasetId of deferred) {
    assert.throws(() => selectedPreparedVariant(base, { ...selection, datasetId }), /have not arrived/);
    assert.throws(() => serializePreparedScene(base, datasetId), /needs its tables/);
  }
  const residentEntries = base.assets;
  for (const table of tables) adoptPreparedDatasetTables(base, JSON.parse(JSON.stringify(table)), table.datasetId);
  assert.deepEqual(base.deferredDatasets, []);
  assert.equal(base.assets, residentEntries, 'a resource lease claims the mount by its asset table');
  assert.deepEqual(tablesOf(base), tablesOf(complete));
  for (const datasetId of deferred) assert.deepEqual(serializePreparedScene(base, datasetId), serializePreparedScene(complete, datasetId));
});

test('dataset tables are refused when they belong to another object or dataset, or leave a variant standing in', async () => {
  const { definition, tables } = splitPreparedDatasetTables(await runtime('mars'));
  const [first, second] = tables;
  assert.ok(first && second);
  assert.throws(() => adoptPreparedDatasetTables(definition, { ...first, id: 'earth' }, first.datasetId), /are not mars/);
  assert.throws(() => adoptPreparedDatasetTables(definition, first, second.datasetId), /are not mars/);
  assert.throws(() => adoptPreparedDatasetTables(definition, { ...first, variants: first.variants.slice(1) }, first.datasetId), /lack the variant/);
  assert.throws(() => adoptPreparedDatasetTables(definition, { ...first, entries: [] }, first.datasetId), /do not complete the definition/);
  assert.deepEqual(definition.deferredDatasets, deferredDatasetIds(definition.controls), 'a refused table changes nothing');
  adoptPreparedDatasetTables(definition, first, first.datasetId);
  assert.throws(() => adoptPreparedDatasetTables(definition, first, first.datasetId), /does not wait for dataset/);
});

test('a definition reads each deferred dataset once through the transport it came from, and again after a failure', async () => {
  const descriptor = parseObjectDescriptor(await readFile(new URL('src/objects/mars/object.json', root), 'utf8'));
  const { definition: split, tables } = splitPreparedDatasetTables(await runtime('mars'));
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).buffer;
  const transport = { schema: 'cssearth-prepared-object@1', id: descriptor.id, type: descriptor.type, format: descriptor.prepared!.format, data: split };
  let fail = true;
  const read = mock.fn(async (reference: string) => {
    if (reference === descriptor.prepared!.url) return encode(transport);
    const table = tables.find(table => preparedDatasetReference(descriptor.prepared!.url, table.datasetId) === reference);
    if (!table) throw new Error(`unexpected ${reference}`);
    if (fail) { fail = false; throw new Error('offline'); }
    return encode(table);
  });
  const definition = await loadPreparedCssObject(descriptor, { read });
  // A mount adapts a copy of the definition (world-context-runtime.ts); preflight keeps the original.
  const mounted = { ...definition, camera: { ...definition.camera } };
  const datasetId = tables[0]!.datasetId;
  await assert.rejects(loadPreparedDataset(definition, datasetId), /offline/);
  await Promise.all([loadPreparedDataset(definition, datasetId), loadPreparedDataset(definition, datasetId), loadPreparedDataset(mounted, datasetId)]);
  assert.deepEqual(read.mock.calls.map(call => call.arguments[0]), [descriptor.prepared!.url, ...Array(2).fill(`prepared/datasets/${datasetId}.json`)]);
  for (const copy of [definition, mounted]) {
    assert.ok(!copy.deferredDatasets?.includes(datasetId));
    assert.doesNotThrow(() => selectedPreparedVariant(copy, initialObjectSelection(copy.controls, datasetId)));
  }
  assert.equal(mounted.assets, definition.assets);
  assert.equal(new Set(definition.assets.entries.map(entry => entry.key)).size, definition.assets.entries.length, 'each entry is adopted once');
  await loadPreparedDataset(definition, datasetId);
  await loadPreparedDataset(definition, definition.controls.datasets!.defaultDataset);
  assert.equal(read.mock.callCount(), 3, 'an adopted or default dataset reads nothing');
});

test('pointing at, touching or focusing a dataset reads its tables once, and the click shares that read', async () => {
  const descriptor = parseObjectDescriptor(await readFile(new URL('src/objects/mars/object.json', root), 'utf8'));
  const { definition: split, tables } = splitPreparedDatasetTables(await runtime('mars'));
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).buffer;
  const read = mock.fn(async (reference: string) => reference === descriptor.prepared!.url
    ? encode({ schema: 'cssearth-prepared-object@1', id: descriptor.id, type: descriptor.type, format: descriptor.prepared!.format, data: split })
    : encode(tables.find(table => preparedDatasetReference(descriptor.prepared!.url, table.datasetId) === reference)));
  const definition = await loadPreparedCssObject(descriptor, { read });
  const datasetId = tables[0]!.datasetId, ids = definition.controls.datasets!.controls.map(control => control.id);
  const { document, Event } = parseHTML(`<main></main><section class="object-information-panel"><div class="object-datasets">
    <form data-dataset-form>${ids.map(id => `<div data-dataset-option><button type="submit" name="dataset" value="${id}" aria-controls="details-${id}">${id}</button></div>`).join('')}</form></div>
    ${ids.map(id => `<div id="details-${id}" data-dataset-details="${id}"></div>`).join('')}</section>`);
  const form = document.querySelector('form')!;
  // Linkedom does not implement form.elements or button.value.
  for (const button of form.querySelectorAll('button')) button.value = button.getAttribute('value')!;
  Object.defineProperty(form, 'elements', { value: [...form.querySelectorAll('button')] });
  const selection = initialObjectSelection(definition.controls);
  const state = { desired: selection, committed: selection, committedBy: null, plan: null, pending: false, loadingMaterial: false, ready: true, error: null, viewRevision: null };
  const selected: Promise<void>[] = [];
  // Only the dataset controls are rendered here.
  const binding = createObjectControlBinding({ stage: document.querySelector('main')!, controls: { ...definition.controls, settings: null }, initialSelection: selection,
    getState: () => state, onError: error => { throw error; },
    onAction: action => { if (action.kind === 'dataset') selected.push(loadPreparedDataset(definition, action.id)); },
    onIntent: id => { void loadPreparedDataset(definition, id); } });
  binding.setReady();
  const button = document.querySelector(`button[value="${datasetId}"]`)!;
  for (const event of ['pointerenter', 'focus', 'touchstart', 'pointerenter']) button.dispatchEvent(new Event(event));
  assert.equal(read.mock.callCount(), 2, 'intent starts the read before the click');
  button.dispatchEvent(new Event('click', { cancelable: true }));
  await Promise.all(selected);
  assert.equal(selected.length, 1);
  assert.deepEqual(read.mock.calls.map(call => call.arguments[0]).slice(1), [`prepared/datasets/${datasetId}.json`]);
  assert.ok(!definition.deferredDatasets?.includes(datasetId));
  binding.destroy();
});
