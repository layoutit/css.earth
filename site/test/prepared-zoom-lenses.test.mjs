import assert from 'node:assert/strict';
import test from 'node:test';
import { loadObjectContent } from './load-object-content.mjs';
import { prepareObjectContent } from '../../tools/objects/dist/content/prepare.js';

test('Earth forwards its zoom selection policy from source through content and mounted controls', async () => {
  const loaded = await loadObjectContent('earth');
  const source = await loaded.source('content');
  const { schema, ...title } = await loaded.source('title');
  const before = structuredClone(source);
  const prepared = prepareObjectContent({ ...source, title });
  assert.ok(source.lenses.zoomSelection);
  assert.deepEqual(prepared.lenses.zoomSelection, source.lenses.zoomSelection);
  assert.deepEqual(loaded.object.data.controls.lenses.zoomSelection, source.lenses.zoomSelection);
  assert.deepEqual(source, before);
});

test('objects without a zoom selection policy retain manual dataset selection', async () => {
  const loaded = await loadObjectContent('mercury');
  const source = await loaded.source('content');
  const { schema, ...title } = await loaded.source('title');
  assert.equal(prepareObjectContent({ ...source, title }).lenses.zoomSelection, undefined);
  assert.equal(loaded.object.data.controls.lenses.zoomSelection, undefined);
});
