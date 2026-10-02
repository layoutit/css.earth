import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { contextLineages } from '@cssearth/bake/sources';
import { productSourceIds } from '@cssearth/objects/provenance';
import { CONTEXT_ROUTE } from '@cssearth/objects/provenance';

test('each catalogue context reads its products and sources from its source records alone', async () => {
  const read: string[] = [];
  const contexts = await contextLineages({ route: CONTEXT_ROUTE, input: path => { read.push(path); return readFile(path); } });
  assert.deepEqual(contexts.map(context => context.id), ['fornax-cluster-members', 'galaxy-clusters', 'jupiter-minor-moons', 'jupiter-ring-particles', 'local-group-galaxies', 'nearby-universe-galaxies', 'neptune-minor-moons', 'neptune-ring-particles', 'observable-universe-cmb', 'saturn-minor-moons', 'saturn-ring-particles', 'uranus-minor-moons', 'uranus-ring-particles', 'virgo-cluster-members']);
  // A bank that names its host object is linked to that object's page; the rest to the route passed in, the Sun's scene.
  assert.deepEqual(contexts.map(context => context.route), ['/fornax-cluster/', '/sun/', '/jupiter/', '/jupiter/', '/local-group/', '/nearby-universe/', '/neptune/', '/neptune/', '/observable-universe/', '/saturn/', '/saturn/', '/uranus/', '/uranus/', '/virgo-cluster/']);
  assert.ok(read.every(path => /\/(object|source\/(presentation|manifest))\.json$/u.test(path)), 'nothing prepared is read');
  for (const context of contexts) {
    assert.ok(context.lineage.products.length, context.id);
    for (const product of context.lineage.products) assert.ok(productSourceIds(context.lineage, product.id).length, `${context.id}/${product.id}`);
    assert.ok(context.lineage.sources.some(source => source.sourceBinding?.kind === 'catalogued'), context.id);
  }
});
