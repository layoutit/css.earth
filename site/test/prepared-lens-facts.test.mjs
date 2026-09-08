import assert from 'node:assert/strict';
import test from 'node:test';
import { loadObjectContent } from './load-object-content.mjs';
import { prepareObjectContent } from '../../tools/objects/dist/content/prepare.js';

async function fixture() {
  const loaded = await loadObjectContent('comet-67p');
  const source = await loaded.source('content');
  const { schema, ...title } = await loaded.source('title');
  return { loaded, source: { ...source, title } };
}

test('authored lens facts survive preparation and runtime publication without mutating the source', async () => {
  const { loaded, source } = await fixture();
  const before = structuredClone(source);
  const prepared = prepareObjectContent(source);
  const facts = controls => controls.map(({ id, facts }) => ({ id, facts }));
  assert.deepEqual(facts(prepared.lenses.controls), facts(source.lenses.controls));
  assert.deepEqual(facts(loaded.object.data.controls.lenses.controls), facts(source.lenses.controls));
  assert.deepEqual(source, before);
  for (const control of prepared.lenses.controls) {
    assert.notEqual(control.facts, source.lenses.controls.find(lens => lens.id === control.id).facts);
  }
});

test('lens facts reject malformed rows and duplicate ids before publication', async () => {
  const { source } = await fixture();
  for (const facts of [null, {}, [null], [{ id: 'observed', label: '', value: '2014' }],
    [{ id: 'observed', label: 'Observed', value: 2014 }],
    [{ id: 'same', label: 'A', value: '1' }, { id: 'same', label: 'B', value: '2' }]]) {
    const candidate = structuredClone(source);
    candidate.lenses.controls[0].facts = facts;
    assert.throws(() => prepareObjectContent(candidate), /lens facts require unique ids and nonempty labels and values/);
  }
});

test('existing description-only lenses keep their original content contract', async () => {
  const { source } = await fixture();
  for (const lens of source.lenses.controls) delete lens.facts;
  const prepared = prepareObjectContent(source);
  assert.ok(prepared.lenses.controls.every(lens => !Object.hasOwn(lens, 'facts')));
  assert.deepEqual(prepared.lenses.controls.map(lens => lens.description), source.lenses.controls.map(lens => lens.description));
});
