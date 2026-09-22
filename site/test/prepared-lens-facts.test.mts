import {parseObjectContentFixture} from './object-content-fixture.mts';
import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { loadObjectContent } from './load-object-content.mts';
import { prepareObjectContent } from '../../tools/objects/dist/content/prepare.js';
import { requireArray, requireRecord, requireString } from '../../tools/sources/source-values.mts';
import type { ObjectContentSource } from '../../tools/objects/content/types.ts';

const preparedObject = (value: unknown): { readonly data: { readonly lenses: { readonly controls: readonly Record<string, unknown>[] } } } => {
  const object = requireRecord(value, 'prepared object');
  const data = requireRecord(object.data, 'prepared object data');
  const controls = requireRecord(data.controls, 'prepared object controls');
  const lenses = requireRecord(controls.lenses, 'prepared object lenses');
  return { data: { lenses: { controls: requireArray(lenses.controls, 'prepared lens controls').map((control, index) => requireRecord(control, `prepared lens control ${index}`)) } } };
};

async function fixture(): Promise<{ readonly loaded: Awaited<ReturnType<typeof loadObjectContent>>; readonly source: ObjectContentSource }> {
  const loaded = await loadObjectContent('comet-67p');
  const rawSource = await loaded.source('content');
  const rawTitle = await loaded.source('title');
  const source = parseObjectContentFixture({ ...rawSource, title: rawTitle });
  return { loaded, source };
}

const lensFacts = (controls: readonly unknown[]) => controls.map((control, index) => {
  const lens = requireRecord(control, `lens ${index}`);
  return { id: requireString(lens.id, `lens ${index} id`), facts: lens.facts };
});

test('authored lens facts survive preparation and runtime publication without mutating the source', async () => {
  const { loaded, source } = await fixture();
  const before = structuredClone(source);
  const prepared = prepareObjectContent(source);
  assert.deepEqual(lensFacts(prepared.lenses.controls), lensFacts(source.lenses.controls));
  const objectData = preparedObject(loaded.object);
  assert.deepEqual(lensFacts(objectData.data.lenses.controls), lensFacts(source.lenses.controls));
  assert.deepEqual(source, before);
  for (const control of prepared.lenses.controls) {
    const id = requireString(control.id, 'prepared lens id');
    const authored = source.lenses.controls.find(lens => lens.id === id);
    assert.ok(authored);
    assert.notEqual(control.facts, authored.facts);
  }
});

test('lens facts reject malformed rows and duplicate ids before publication', async () => {
  const { source } = await fixture();
  for (const malformed of [null, {}, [null], [{ id: 'observed', label: '', value: '2014' }],
    [{ id: 'observed', label: 'Observed', value: 2014 }],
    [{ id: 'same', label: 'A', value: '1' }, { id: 'same', label: 'B', value: '2' }]]) {
    const candidate = structuredClone(source);
    const lens = candidate.lenses.controls[0];
    assert.ok(lens);
    Reflect.set(lens, 'facts', malformed);
    assert.throws(() => prepareObjectContent(candidate), /lens facts require unique ids and nonempty labels and values/);
  }
});

test('lenses without facts publish none, and no lens carries reader text', async () => {
  const { source } = await fixture();
  for (const lens of source.lenses.controls) Reflect.deleteProperty(lens, 'facts');
  const prepared = prepareObjectContent(source);
  assert.ok(prepared.lenses.controls.every(lens => !Object.hasOwn(lens, 'facts')));
  assert.ok(prepared.lenses.controls.every(lens => ['title', 'detail', 'summary', 'description'].every(key => !Object.hasOwn(lens, key))));
});
