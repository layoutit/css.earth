import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { OBJECTS } from '../objects.mts';
import { spacecraftAgencies } from '../dataset-spacecraft.mts';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import { parsePreparedExploration } from '../../src/platform/prepared-exploration.mts';
import { compileContributions, contributionViews, parseContributionGraph } from '../../src/platform/exploration-contributions.mts';

const json = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const prepared = parsePreparedExploration(await json('../prepared-spacecraft.json'));
const catalog = prepared.catalog;
const provenance = id => json(`../../src/planets/${id}/prepared/provenance.json`);
const missions = Object.fromEntries(catalog.missions.map(mission => [mission.id, mission]));
async function objectInput(id, document = null) {
  const object = OBJECTS.find(object => object.id === id);
  const page = await json(`../../src/planets/${id}/prepared/page.json`);
  return { id, name: object.name, route: object.route, controls: page.controls.lenses?.controls ?? [], provenance: document ?? await provenance(id) };
}
async function graphFor(id, document = null) { return compileContributions([await objectInput(id, document)], catalog); }
const ids = (graph, lens, domain = 'mission') => [...new Set(graph.edges.filter(edge => edge.lensIds.includes(lens)).flatMap(edge => {
  const a = edge.attribution;
  return domain === 'mission' ? a.kind !== 'unresolved' && a.missionId ? [a.missionId] : [] : a.kind === 'spacecraft' ? [a.spacecraftId] : [];
}))];

test('capture attribution follows the selected dataset, including derived maps', async () => {
  const mercury = await graphFor('mercury'), moon = await graphFor('moon'), mars = await graphFor('mars');
  for (const lens of ['normal', 'enhanced', 'topography']) assert.deepEqual(ids(mercury, lens), ['messenger']);
  for (const lens of ['surface', 'topography']) assert.deepEqual(ids(moon, lens), ['lro']);
  assert.deepEqual(ids(moon, 'crust'), ['grail']);
  assert.deepEqual(ids(moon, 'crust', 'spacecraft'), [], 'mission attribution must not imply a vehicle observation');
  assert.deepEqual(ids(mars, 'normal'), []);
  assert.ok(mars.edges.some(edge => edge.lensIds.includes('normal') && edge.attribution.kind === 'unresolved' && edge.attribution.label === 'Viking orbiters'));
  assert.deepEqual(ids(mars, 'elevation'), ['mars-global-surveyor']);
  assert.deepEqual(ids(mars, 'thermal'), ['odyssey']);
  const pluto = await graphFor('pluto');
  for (const lens of ['surface', 'monochrome', 'topography']) assert.deepEqual(ids(pluto, lens), ['new-horizons']);
});

test('multi-mission composites preserve every evidenced contributor without repeating dataset destinations', async () => {
  const jupiter = await graphFor('jupiter');
  assert.deepEqual(ids(jupiter, 'normal'), ['hubble', 'juno']);
  for (const lens of ['ultraviolet', 'methane']) assert.deepEqual(ids(jupiter, lens), ['hubble']);
  assert.deepEqual(new Set(ids(await graphFor('callisto'), 'normal')), new Set(['galileo', 'voyager-1', 'voyager-2']));
  assert.equal(new Set(jupiter.datasets.map(view => view.href)).size, jupiter.datasets.length);
  assert.ok(jupiter.edges.filter(edge => edge.lensIds.includes('normal')).length > 1);
});

test('schematic and synthetic views do not inherit observations from their outer texture', async () => {
  assert.deepEqual(ids(await graphFor('mercury'), 'interior'), []);
  const saturn = await graphFor('saturn');
  for (const lens of ['cross-section', 'thermal']) assert.deepEqual(ids(saturn, lens), []);
  assert.deepEqual(ids(await graphFor('earth'), 'buenos-aires-noise'), []);
  for (const object of ['juno', 'adrastea', 'pallas']) assert.deepEqual((await graphFor(object)).datasets, []);
});

test('agency choices count individual missions and preserve joint credits', () => {
  const values = [missions.hubble, missions.juno, missions.hubble];
  assert.deepEqual(spacecraftAgencies(values).map(group => [group.name, group.missions.map(mission => mission.id)]), [
    ['NASA', ['hubble', 'juno']], ['ESA', ['hubble']],
  ]);
  assert.deepEqual(spacecraftAgencies([missions.cassini]).map(group => group.name), ['NASA', 'ESA', 'ASI']);
  assert.equal(spacecraftAgencies([missions['viking-1'], missions['viking-2']])[0].missions.length, 2);
  assert.deepEqual(spacecraftAgencies([]), []);
});

test('every migrated capture stays bound to its source; the full prepared graph is deterministic', async () => {
  const objects = []; let captured = 0, authored = 0;
  for (const object of OBJECTS) {
    const document = await provenance(object.id);
    const manifest = await json(`../../src/planets/${object.id}/source/manifest.json`);
    const inputs = new Map(manifest.inputs.map(input => [input.id, input]));
    authored += manifest.inputs.filter(input => input.capture).length;
    for (const source of document.sources.filter(source => source.capture)) {
      assert.deepEqual(source.capture, inputs.get(source.id).capture); captured++;
    }
    objects.push(await objectInput(object.id, document));
  }
  assert.ok(authored >= 374); assert.ok(captured > 300 && captured <= authored);
  const graph = compileContributions(objects, catalog);
  assert.deepEqual(graph, prepared.graph);
  assert.deepEqual(compileContributions(objects, catalog), graph);
  for (const [id, edgeIds] of Object.entries(graph.bySpacecraft)) {
    assert.ok(edgeIds.every(index => graph.edges[index].attribution.spacecraftId === id));
    const views = contributionViews(graph, edgeIds);
    for (const view of views) assert.ok(graph.byObject[view.objectId].some(index => edgeIds.includes(index) && graph.edges[index].lensIds.includes(view.lensId)));
  }
});

test('OSIRIS-REx retains Bennu observations and successor participation creates no APEX observations', () => {
  assert.ok(prepared.graph.byMission['osiris-rex'].length);
  assert.equal(prepared.graph.byMission['osiris-apex'], undefined);
  assert.deepEqual(catalog.missions.filter(mission => mission.participants.some(member => member.spacecraftId === 'osiris-rex')).map(mission => mission.id), ['osiris-rex', 'osiris-apex']);
  assert.ok(contributionViews(prepared.graph, prepared.graph.bySpacecraft['osiris-rex']).every(view => view.objectId === 'bennu'));
  assert.equal(prepared.graph.bySpacecraft.huygens, undefined);
  assert.equal(prepared.graph.bySpacecraft['galileo-probe'], undefined);
});

test('approved artwork and emblems retain source bytes, dimensions and transparency', async () => {
  for (const [file, images] of [['render-library', prepared.images], ['emblem-library', prepared.emblems]]) {
    const library = await json(`../source/spacecraft/${file}.json`);
    assert.deepEqual(Object.keys(images), library.entries.map(image => image.id));
    for (const approved of library.entries) {
      const image = images[approved.id], bytes = await readFile(new URL(`../../public${image.src}`, import.meta.url));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), approved.sha256);
      assert.equal(image.sha256, approved.sha256); assert.equal(image.bytes, bytes.length);
      const metadata = await sharp(bytes).metadata();
      assert.equal(metadata.width, image.width); assert.equal(metadata.height, image.height);
      assert.equal(image.sourceUrl, approved.source.sourcePage ?? approved.source.sourceUrl);
      assert.equal(image.credit, approved.source.credit);
      if (file === 'emblem-library') {
        assert.equal(metadata.format, 'png'); assert.equal(metadata.hasAlpha, true);
        const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let transparent = 0, opaque = 0;
        for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
          const alpha = data[(y * info.width + x) * 4 + 3];
          if (alpha === 0) transparent++; if (alpha === 255) opaque++;
          if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) assert.equal(alpha, 0, `${image.id}: exterior pixels`);
        }
        assert.ok(transparent > info.width * info.height * .03); assert.ok(opaque > info.width * info.height * .1);
        const source = await readFile(new URL(`../source/spacecraft/emblems/${approved.source.localSource}`, import.meta.url));
        assert.equal(createHash('sha256').update(source).digest('hex'), approved.source.inputSha256);
      }
    }
  }
  for (const id of ['grail-a', 'grail-b', 'viking-1-lander', 'viking-2-lander']) assert.equal(catalog.spacecraft.find(vehicle => vehicle.id === id).imageId, undefined);
});

test('unknown identities, impossible capture pairs, stale lenses and damaged indexes fail closed', async () => {
  const document = await provenance('mercury');
  for (const source of document.sources) delete source.capture;
  assert.deepEqual(ids(await graphFor('mercury', document), 'normal'), []);
  const source = document.sources.find(source => source.id === 'usgs-messenger-bdr-global-z3');
  source.capture = { attributions: [{ kind: 'spacecraft', spacecraftId: 'unknown-probe', evidence: source.origin }] };
  await assert.rejects(graphFor('mercury', document), /Unknown capture spacecraft/);
  source.capture.attributions[0] = { kind: 'spacecraft', spacecraftId: 'messenger', missionId: 'juno', evidence: source.origin };
  await assert.rejects(graphFor('mercury', document), /participating pair/);
  source.capture.attributions.push(source.capture.attributions[0]); assert.throws(() => validateObjectProvenance(document));
  const object = await objectInput('mercury'); object.controls = [];
  assert.throws(() => compileContributions([object], catalog), /Unknown prepared dataset/);
  const graph = structuredClone(prepared.graph); graph.bySpacecraft.messenger = [];
  assert.throws(() => parseContributionGraph(graph, catalog), /Inconsistent contribution index/);
});
