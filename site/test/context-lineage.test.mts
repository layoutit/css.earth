import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { contextLineages } from '@cssearth/bake/sources';
import { productSourceIds } from '@cssearth/objects/provenance';
import { CONTEXT_ROUTE } from '@cssearth/objects/provenance';

test('each catalogue context reads its products and sources from its source records alone', async () => {
  const read: string[] = [];
  const contexts = await contextLineages({ route: CONTEXT_ROUTE, input: path => { read.push(path); return readFile(path); } });
  assert.deepEqual(contexts.map(context => context.id), ['abell-2744-members', 'abell-370-members', 'catalogue-asteroids', 'centaurus-cluster-members', 'coma-cluster-members', 'fornax-cluster-members', 'galaxy-clusters', 'hydra-cluster-members', 'jupiter-minor-moons', 'jupiter-ring-particles', 'local-group-galaxies', 'macs-j0416-members', 'nearby-universe-galaxies', 'neptune-minor-moons', 'neptune-ring-particles', 'nuclear-star-cluster', 'observable-universe-cmb', 'perseus-cluster-members', 'saturn-minor-moons', 'saturn-ring-particles', 'smacs-0723-members', 'trans-neptunian-objects', 'uranus-minor-moons', 'uranus-ring-particles', 'virgo-cluster-members']);
  // A bank that names its host object is linked to that object's page; the rest to the route passed in, the Sun's scene.
  assert.deepEqual(contexts.map(context => context.route), ['/abell-2744/', '/abell-370/', '/sun/', '/centaurus-cluster/', '/coma-cluster/', '/fornax-cluster/', '/sun/', '/hydra-cluster/', '/jupiter/', '/jupiter/', '/local-group/', '/macs-j0416/', '/nearby-universe/', '/neptune/', '/neptune/', '/sgr-a-star/', '/observable-universe/', '/perseus-cluster/', '/saturn/', '/saturn/', '/smacs-0723/', '/sun/', '/uranus/', '/uranus/', '/virgo-cluster/']);
  assert.ok(read.every(path => /\/(object|source\/(presentation|manifest))\.json$/u.test(path)), 'nothing prepared is read');
  for (const context of contexts) {
    assert.ok(context.lineage.products.length, context.id);
    for (const product of context.lineage.products) assert.ok(productSourceIds(context.lineage, product.id).length, `${context.id}/${product.id}`);
    assert.ok(context.lineage.sources.some(source => source.sourceBinding?.kind === 'catalogued'), context.id);
  }
});
