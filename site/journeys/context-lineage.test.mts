import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { contextLineages } from '@cssearth/bake/sources';
import { productSourceIds, CONTEXT_ROUTE } from '@cssearth/objects/provenance';

test('each catalogue context reads its products and sources from its source records alone', async () => {
  const read: string[] = [];
  const contexts = await contextLineages({ route: CONTEXT_ROUTE, input: path => { read.push(path); return readFile(path); } });
  assert.deepEqual(contexts.map(context => context.id), ['catalogue-asteroids', 'centaurus-cluster-members', 'coma-cluster-members', 'fornax-cluster-members', 'galaxy-clusters', 'hydra-cluster-members', 'jupiter-minor-moons', 'jupiter-ring-particles', 'local-group-galaxies', 'local-group-structures', 'm10-members', 'm103-members', 'm107-members', 'm11-members', 'm12-members', 'm13-members', 'm14-members', 'm15-members', 'm18-members', 'm19-members', 'm2-members', 'm21-members', 'm22-members', 'm23-members', 'm25-members', 'm26-members', 'm28-members', 'm29-members', 'm3-members', 'm30-members', 'm31-globular-clusters', 'm34-members', 'm35-members', 'm36-members', 'm37-members', 'm38-members', 'm39-members', 'm4-members', 'm41-members', 'm44-members', 'm46-members', 'm47-members', 'm48-members', 'm5-members', 'm50-members', 'm52-members', 'm53-members', 'm54-members', 'm55-members', 'm56-members', 'm6-members', 'm62-members', 'm67-members', 'm68-members', 'm69-members', 'm7-members', 'm70-members', 'm71-members', 'm72-members', 'm75-members', 'm79-members', 'm80-members', 'm9-members', 'm92-members', 'm93-members', 'nearby-universe-galaxies', 'neptune-minor-moons', 'neptune-ring-particles', 'nuclear-star-cluster', 'observable-universe-cmb', 'perseus-cluster-members', 'saturn-minor-moons', 'saturn-ring-particles', 'trans-neptunian-objects', 'uranus-minor-moons', 'uranus-ring-particles', 'virgo-cluster-members', 'wd-1851-329-dust-cloud']);
  // A bank that names its host object is linked to that object's page; the rest to the route passed in, the Sun's scene.
  assert.deepEqual(contexts.map(context => context.route), ['/sun/', '/centaurus-cluster/', '/coma-cluster/', '/fornax-cluster/', '/nearby-universe/', '/hydra-cluster/', '/jupiter/', '/jupiter/', '/local-group/', '/local-group/', '/m10/', '/m103/', '/m107/', '/m11/', '/m12/', '/m13/', '/m14/', '/m15/', '/m18/', '/m19/', '/m2/', '/m21/', '/m22/', '/m23/', '/m25/', '/m26/', '/m28/', '/m29/', '/m3/', '/m30/', '/m31/', '/m34/', '/m35/', '/m36/', '/m37/', '/m38/', '/m39/', '/m4/', '/m41/', '/m44/', '/m46/', '/m47/', '/m48/', '/m5/', '/m50/', '/m52/', '/m53/', '/m54/', '/m55/', '/m56/', '/m6/', '/m62/', '/m67/', '/m68/', '/m69/', '/m7/', '/m70/', '/m71/', '/m72/', '/m75/', '/m79/', '/m80/', '/m9/', '/m92/', '/m93/', '/nearby-universe/', '/neptune/', '/neptune/', '/sgr-a-star/', '/observable-universe/', '/perseus-cluster/', '/saturn/', '/saturn/', '/sun/', '/uranus/', '/uranus/', '/virgo-cluster/', '/wd-1851-329/']);
  assert.ok(read.every(path => /\/(object|source\/(presentation|manifest))\.json$/u.test(path)), 'nothing prepared is read');
  for (const context of contexts) {
    assert.ok(context.lineage.products.length, context.id);
    for (const product of context.lineage.products) assert.ok(productSourceIds(context.lineage, product.id).length, `${context.id}/${product.id}`);
    assert.ok(context.lineage.sources.some(source => source.sourceBinding?.kind === 'catalogued'), context.id);
  }
});
