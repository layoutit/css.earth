import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { contextLineages } from '@cssearth/bake/sources';
import { productSourceIds } from '@cssearth/objects/provenance';
import { CONTEXT_ROUTE } from '../../src/platform/dataset-destination.mts';

test('each catalogue context reads its products and sources from its source records alone', async () => {
  const read: string[] = [];
  const contexts = await contextLineages({ route: CONTEXT_ROUTE, input: path => { read.push(path); return readFile(path); } });
  assert.deepEqual(contexts.map(context => context.id), ['galaxy-clusters', 'local-group', 'nearby-universe', 'observable-universe']);
  // The application route passed in is what the catalogue links each context to: the Sun's scene.
  assert.ok(contexts.every(context => context.route === '/sun/'));
  assert.ok(read.every(path => /\/source\/(presentation|manifest)\.json$/u.test(path)), 'nothing prepared is read');
  for (const context of contexts) {
    assert.ok(context.lineage.products.length, context.id);
    for (const product of context.lineage.products) assert.ok(productSourceIds(context.lineage, product.id).length, `${context.id}/${product.id}`);
    assert.ok(context.lineage.sources.some(source => source.sourceBinding?.kind === 'catalogued'), context.id);
  }
});
