import {parseObjectContentFixture} from './fixtures/object-content-fixture.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { loadObjectContent } from './load-object-content.mts';
import { prepareObjectContent } from '../build/content/prepare.ts';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import type { ObjectContentSource } from '@cssearth/bake/objects/content';

const preparedObject = (value: unknown): { readonly data: { readonly datasets: { readonly controls: readonly Record<string, unknown>[] } } } => {
  const object = requireRecord(value, 'prepared object');
  const data = requireRecord(object.data, 'prepared object data');
  const controls = requireRecord(data.controls, 'prepared object controls');
  const datasets = requireRecord(controls.datasets, 'prepared object datasets');
  return { data: { datasets: { controls: requireArray(datasets.controls, 'prepared dataset controls').map((control, index) => requireRecord(control, `prepared dataset control ${index}`)) } } };
};

async function fixture(): Promise<{ readonly loaded: Awaited<ReturnType<typeof loadObjectContent>>; readonly source: ObjectContentSource }> {
  const loaded = await loadObjectContent('comet-67p');
  const source = parseObjectContentFixture(await loaded.source('content'));
  return { loaded, source };
}

const datasetFacts = (controls: readonly unknown[]) => controls.map((control, index) => {
  const dataset = requireRecord(control, `dataset ${index}`);
  return { id: requireString(dataset.id, `dataset ${index} id`), facts: dataset.facts };
});

test('authored dataset facts survive preparation and runtime publication without mutating the source', async () => {
  const { loaded, source } = await fixture();
  const before = structuredClone(source);
  const prepared = prepareObjectContent(source);
  assert.deepEqual(datasetFacts(prepared.datasets.controls), datasetFacts(source.datasets.controls));
  const objectData = preparedObject(loaded.object);
  assert.deepEqual(datasetFacts(objectData.data.datasets.controls), datasetFacts(source.datasets.controls));
  assert.deepEqual(source, before);
  for (const control of prepared.datasets.controls) {
    const id = requireString(control.id, 'prepared dataset id');
    const authored = source.datasets.controls.find(dataset => dataset.id === id);
    assert.ok(authored);
    assert.notEqual(control.facts, authored.facts);
  }
});

test('dataset facts reject malformed rows and duplicate ids before publication', async () => {
  const { source } = await fixture();
  for (const malformed of [null, {}, [null], [{ id: 'observed', label: '', value: '2014' }],
    [{ id: 'observed', label: 'Observed', value: 2014 }],
    [{ id: 'same', label: 'A', value: '1' }, { id: 'same', label: 'B', value: '2' }]]) {
    const candidate = structuredClone(source);
    const dataset = candidate.datasets.controls[0];
    assert.ok(dataset);
    Reflect.set(dataset, 'facts', malformed);
    assert.throws(() => prepareObjectContent(candidate), /dataset facts require unique ids and nonempty labels and values/);
  }
});

test('datasets without facts publish none, and no dataset carries reader text', async () => {
  const { source } = await fixture();
  for (const dataset of source.datasets.controls) Reflect.deleteProperty(dataset, 'facts');
  const prepared = prepareObjectContent(source);
  assert.ok(prepared.datasets.controls.every(dataset => !Object.hasOwn(dataset, 'facts')));
  assert.ok(prepared.datasets.controls.every(dataset => ['title', 'detail', 'summary', 'description'].every(key => !Object.hasOwn(dataset, key))));
});
