import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { OBJECTS } from '../objects.mjs';
import { datasetSpacecraft } from '../dataset-spacecraft.mjs';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mjs';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const catalog = await json('../prepared-spacecraft.json');
const provenance = id => json(`../../src/planets/${id}/prepared/provenance.json`);
const ids = (document, lens) => datasetSpacecraft(document, lens, catalog).map(mission => mission.id);

test('capture platforms follow the selected dataset, including derived maps', async () => {
  const mercury = await provenance('mercury'), moon = await provenance('moon'), mars = await provenance('mars');
  for (const lens of ['normal', 'enhanced', 'topography']) assert.deepEqual(ids(mercury, lens), ['messenger']);
  assert.deepEqual(ids(moon, 'surface'), ['lro']);
  assert.deepEqual(ids(moon, 'topography'), ['lro']);
  assert.deepEqual(ids(moon, 'crust'), ['grail']);
  assert.deepEqual(ids(mars, 'normal'), ['viking']);
  assert.deepEqual(ids(mars, 'elevation'), ['mars-global-surveyor']);
  assert.deepEqual(ids(mars, 'thermal'), ['odyssey']);
  for (const lens of ['surface', 'monochrome', 'topography']) assert.deepEqual(ids(await provenance('pluto'), lens), ['new-horizons']);
});

test('multi-mission composites retain each spacecraft once; other lenses do not inherit them', async () => {
  const jupiter = await provenance('jupiter');
  assert.deepEqual(ids(jupiter, 'normal'), ['hubble', 'juno']);
  assert.deepEqual(ids(jupiter, 'ultraviolet'), ['hubble']);
  assert.deepEqual(ids(jupiter, 'methane'), ['hubble']);
  assert.deepEqual(new Set(ids(await provenance('callisto'), 'normal')), new Set(['galileo', 'voyager-1', 'voyager-2']));
});

test('illustrations and local models do not acquire capture provenance from an outer texture', async () => {
  assert.deepEqual(ids(await provenance('mercury'), 'interior'), []);
  const saturn = await provenance('saturn');
  assert.deepEqual(ids(saturn, 'cross-section'), []);
  assert.deepEqual(ids(saturn, 'thermal'), []);
  assert.deepEqual(ids(await provenance('earth'), 'buenos-aires-noise'), []);
  for (const object of ['juno', 'adrastea', 'pallas']) {
    const document = await provenance(object);
    for (const product of document.products) for (const lens of product.lensIds) assert.deepEqual(ids(document, lens), []);
  }
});

test('every declared capture has a catalog entry and stays tied to its pinned source', async () => {
  let objects = 0;
  for (const { id } of OBJECTS) {
    const document = await provenance(id), before = JSON.stringify(document);
    const manifest = await json(`../../src/planets/${id}/source/manifest.json`);
    const inputs = new Map(manifest.inputs.map(input => [input.id, input]));
    for (const source of document.sources.filter(source => source.capture)) {
      assert.deepEqual(source.capture, inputs.get(source.id).capture);
      for (const spacecraftId of source.capture.spacecraftIds) assert.ok(catalog[spacecraftId], spacecraftId);
    }
    const missions = document.products.flatMap(product => product.lensIds.flatMap(lens => ids(document, lens)));
    if (missions.length) objects++;
    assert.equal(JSON.stringify(document), before);
  }
  assert.ok(objects > 50, 'shared coverage across existing spacecraft datasets');
});

test('prepared mission artwork and three source-backed facts match the catalog', async () => {
  for (const mission of Object.values(catalog)) {
    const bytes = await readFile(new URL(`../../public${mission.image.src}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), mission.image.sha256, mission.id);
    assert.equal(bytes.length, mission.image.bytes);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, mission.image.width);
    assert.equal(metadata.height, mission.image.height);
    assert.ok(metadata.width <= 288 && metadata.height <= 288);
    assert.equal(mission.facts.length, 3);
    assert.equal(mission.facts[0].value, mission.name);
    assert.ok(mission.facts[0].detail, 'agency shares the mission row');
    assert.equal(mission.facts[1].label, 'Launched');
    assert.ok(['Ended', 'Status'].includes(mission.facts[2].label));
    assert.ok(mission.facts[2].sourceUrl, 'end date or status has a reference');
    assert.ok(mission.facts.every(fact => fact.label !== 'Destination'));
  }
  assert.equal(catalog.magellan.image.kind, 'illustration');
  assert.equal(catalog['mars-global-surveyor'].image.kind, 'illustration');
});

test('missing capture metadata is not inferred from source names, and invalid identities fail', async () => {
  const document = await provenance('mercury');
  for (const source of document.sources) delete source.capture;
  assert.deepEqual(ids(document, 'normal'), []);
  const source = document.sources.find(source => source.id === 'usgs-messenger-bdr-global-z3');
  source.capture = { spacecraftIds: ['unknown-probe'], evidence: source.origin };
  assert.throws(() => ids(document, 'normal'), /Unknown source spacecraft/u);
  source.capture.spacecraftIds = ['messenger', 'messenger'];
  assert.throws(() => validateObjectProvenance(document), /Duplicate provenance capture/u);
});
