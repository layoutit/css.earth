import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { OBJECTS } from '../objects.mjs';
import { datasetSpacecraft, objectSpacecraft, spacecraftAgencies } from '../dataset-spacecraft.mjs';
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

test('body mission lists combine dataset contributions once and preserve source scope', async () => {
  const cases = [
    ['mercury', ['messenger']],
    ['moon', ['lro', 'grail']],
    ['mars', ['viking', 'mars-global-surveyor', 'odyssey']],
    ['jupiter', ['hubble', 'juno']],
    ['pallas', []],
  ];
  for (const [id, expected] of cases) {
    const document = await provenance(id);
    const before = JSON.stringify(document);
    const missions = objectSpacecraft(document, catalog);
    assert.deepEqual(missions.map(mission => mission.id), expected, id);
    for (const mission of missions) assert.equal(mission, catalog[mission.id]);
    assert.equal(JSON.stringify(document), before);
  }
  assert.deepEqual(objectSpacecraft(undefined, catalog), []);
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

test('agency choices preserve joint mission credits and deduplicate mission results', async () => {
  const missions = objectSpacecraft(await provenance('jupiter'), catalog);
  const before = JSON.stringify(missions);
  const groups = spacecraftAgencies([...missions, missions[0]]);
  assert.deepEqual(groups.map(group => [group.name, group.missions.map(mission => mission.id)]), [
    ['NASA', ['hubble', 'juno']],
    ['ESA', ['hubble']],
  ]);
  assert.equal(groups[0].missions[0], catalog.hubble);
  assert.equal(groups[1].missions[0], catalog.hubble);
  assert.equal(JSON.stringify(missions), before);
  assert.deepEqual(spacecraftAgencies([catalog.cassini]).map(group => group.name), ['NASA', 'ESA', 'ASI']);
  assert.deepEqual(spacecraftAgencies([]), []);
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

test('approved static images cover the mission catalog and retain their source identity', async () => {
  const library = await json('../source/spacecraft/render-library.json');
  assert.deepEqual(library.entries.map(image => image.id).sort(), Object.keys(catalog).sort());
  const images = new Map(library.entries.map(image => [image.id, image]));
  for (const mission of Object.values(catalog)) {
    const approved = images.get(mission.id);
    assert.equal(mission.image.src, approved.url);
    assert.equal(mission.image.sha256, approved.sha256);
    assert.equal(mission.image.sourceUrl, approved.source.sourcePage);
    assert.equal(mission.image.credit, approved.source.credit);
    const bytes = await readFile(new URL(`../../public${mission.image.src}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), mission.image.sha256, mission.id);
    assert.equal(bytes.length, mission.image.bytes);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.width, mission.image.width);
    assert.equal(metadata.height, mission.image.height);
    assert.equal(metadata.width, 592);
    assert.equal(metadata.height, 296);
    assert.equal(mission.facts.length, 3);
    assert.equal(mission.facts[0].value, mission.name);
    assert.ok(mission.facts[0].detail, 'agency shares the mission row');
    assert.equal(mission.facts[1].label, 'Launched');
    assert.ok(['Ended', 'Status'].includes(mission.facts[2].label));
    assert.ok(mission.facts[2].sourceUrl, 'end date or status has a reference');
    assert.ok(mission.facts.every(fact => fact.label !== 'Destination'));
  }
  assert.equal(catalog.magellan.image.kind, 'model-render');
  for (const id of ['hayabusa', 'hayabusa2', 'viking'])
    assert.equal(catalog[id].image.kind, 'official-prerendered-artwork');
});

test('every spacecraft has a sourced PNG emblem with genuinely transparent exterior pixels', async () => {
  const library = await json('../source/spacecraft/emblem-library.json');
  assert.deepEqual(library.entries.map(e => e.id).sort(), Object.keys(catalog).sort());
  for (const approved of library.entries) {
    const emblem = catalog[approved.id].emblem;
    assert.equal(emblem.src, approved.src);
    assert.equal(emblem.sourceUrl, approved.source.sourceUrl);
    assert.ok(emblem.credit);
    const bytes = await readFile(new URL(`../../public${emblem.src}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), approved.sha256);
    assert.equal(emblem.sha256, approved.sha256);
    const metadata = await sharp(bytes).metadata();
    assert.equal(metadata.format, 'png');
    assert.equal(metadata.hasAlpha, true);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let transparent = 0, opaque = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha === 0) transparent++;
      if (alpha === 255) opaque++;
      if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1)
        assert.equal(alpha, 0, `${approved.id}: no opaque outer frame`);
    }
    assert.ok(transparent > info.width * info.height * 0.03, `${approved.id}: real background transparency`);
    assert.ok(opaque > info.width * info.height * 0.1, `${approved.id}: artwork retained`);
    const input = await readFile(new URL(`../source/spacecraft/emblems/${approved.source.localSource}`, import.meta.url));
    assert.equal(createHash('sha256').update(input).digest('hex'), approved.source.inputSha256);
  }
  assert.ok(library.entries.find(e => e.id === 'viking').preparation.removedBackgroundPixels > 0,
    'the white Mars/Viking background was removed from the source, not hidden with CSS');
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
