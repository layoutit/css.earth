import { parsePreparedSources } from '../../src/platform/prepared-sources.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { SCENE_OBJECTS } from '../objects.mts';
import { validateObjectProvenance } from '../../src/platform/object-provenance.mts';
import { parsePreparedExploration } from '../../src/platform/prepared-exploration.mts';
import { compileContributions, contributionViews, parseContributionGraph } from '../../src/platform/exploration-contributions.mts';
import type { ContributionGraph, ContributionObject } from '../../src/platform/exploration-contributions.mts';
import type { ProvenanceDocument } from '../../src/platform/object-provenance.mts';
import { explorationArray, explorationId, explorationRecord, explorationText } from '../../src/platform/exploration-catalog.mts';
import type { Capture } from '../../src/platform/exploration-catalog.mts';
import type { ExplorationImage } from '../../src/platform/prepared-exploration.mts';
import { sourceTestVolumes as prepareVolumeProvenance } from '../../tools/source-test-inputs.mts';

const json = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const { sources } = parsePreparedSources(await json('../prepared-sources.json'));
const prepared = parsePreparedExploration(await json('../prepared-facilities.json'), sources);
const catalog = prepared.catalog;
const provenance = async (id: string): Promise<ProvenanceDocument> => validateObjectProvenance(await json(`../../src/objects/${id}/prepared/provenance.json`), id);
const missions = Object.fromEntries(catalog.missions.map(mission => [mission.id, mission]));
interface PreparedPage { readonly controls: { readonly lenses?: { readonly controls: readonly { readonly id: string; readonly label: string }[] } } }
interface ArtworkSource { readonly sourcePage?: string; readonly sourceUrl?: string; readonly credit: string; readonly localSource?: string; readonly inputSha256?: string; }
interface ArtworkEntry { readonly id: string; readonly sha256: string; readonly source: ArtworkSource; }
const positiveInteger = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new TypeError(`${label} must be a positive integer.`);
  return value;
};
const artworkLibrary = (value: unknown, emblem: boolean): readonly ArtworkEntry[] => {
  const library = explorationRecord(value);
  const schema = emblem ? 'cssearth-facility-emblems@3' : 'cssearth-facility-render-library@3';
  if (library.schema !== schema) throw new TypeError('Unsupported artwork library.');
  return explorationArray(library.entries, raw => {
    const image = explorationRecord(raw), source = explorationRecord(image.source);
    const id = explorationId(image.id), sha256 = explorationText(image.sha256);
    if (!/^[a-f0-9]{64}$/u.test(sha256)) throw new TypeError('Invalid artwork hash.');
    positiveInteger(image.width, 'Artwork width'); positiveInteger(image.height, 'Artwork height'); positiveInteger(image.bytes, 'Artwork bytes');
    const credit = explorationText(source.credit);
    const sourcePage = source.sourcePage === undefined ? undefined : explorationText(source.sourcePage);
    const sourceUrl = source.sourceUrl === undefined ? undefined : explorationText(source.sourceUrl);
    if (emblem && (sourceUrl === undefined || source.localSource === undefined || source.inputSha256 === undefined)) throw new TypeError('Incomplete emblem source.');
    return { id, sha256, source: { credit, ...(sourcePage === undefined ? {} : { sourcePage }), ...(sourceUrl === undefined ? {} : { sourceUrl }),
      ...(source.localSource === undefined ? {} : { localSource: explorationText(source.localSource) }),
      ...(source.inputSha256 === undefined ? {} : { inputSha256: explorationText(source.inputSha256) }) } };
  });
};
async function objectInput(id: string, document: ProvenanceDocument | null = null): Promise<ContributionObject> {
  const object = SCENE_OBJECTS.find(object => object.id === id);
  assert.ok(object, `${id}: registered object`);
  const rawPage = explorationRecord(await json(`../../src/objects/${id}/prepared/page.json`));
  const rawControls = explorationRecord(rawPage.controls);
  const rawLenses = rawControls.lenses === undefined ? undefined : explorationRecord(rawControls.lenses);
  const page: PreparedPage = { controls: rawLenses === undefined ? {} : { lenses: { controls: explorationArray(rawLenses.controls, raw => {
    const control = explorationRecord(raw); return { id: explorationId(control.id), label: explorationText(control.label) };
  }) } } };
  return { id, name: object.name, route: object.route, controls: page.controls.lenses?.controls ?? [], provenance: document ?? await provenance(id) };
}
async function graphFor(id: string, document: ProvenanceDocument | null = null): Promise<ContributionGraph> { return compileContributions([await objectInput(id, document)], catalog); }
const ids = (graph: ContributionGraph, lens: string, domain: 'mission' | 'facility' = 'mission'): string[] => [...new Set(graph.edges.filter(edge => edge.lensIds.includes(lens)).flatMap(edge => {
  const a = edge.attribution;
  if (domain === 'mission') return a.kind !== 'unresolved' && a.missionId ? [a.missionId] : [];
  return a.kind === 'facility' ? [a.facilityId] : [];
}))];

test('capture attribution follows the selected dataset, including derived maps', async () => {
  const mercury = await graphFor('mercury'), moon = await graphFor('moon'), mars = await graphFor('mars');
  for (const lens of ['normal', 'enhanced', 'topography']) assert.deepEqual(ids(mercury, lens), ['messenger']);
  for (const lens of ['surface', 'topography']) assert.deepEqual(ids(moon, lens), ['lro']);
  assert.deepEqual(ids(moon, 'crust'), ['grail']);
  assert.deepEqual(ids(moon, 'crust', 'facility'), [], 'mission attribution must not imply a vehicle observation');
  assert.deepEqual(ids(mars, 'normal'), []);
  assert.ok(mars.edges.some(edge => edge.lensIds.includes('normal') && edge.attribution.kind === 'unresolved' && edge.attribution.label === 'Viking orbiters'));
  assert.deepEqual(ids(mars, 'elevation'), ['mars-global-surveyor']);
  assert.deepEqual(ids(mars, 'thermal'), ['odyssey']);
  const pluto = await graphFor('pluto');
  for (const lens of ['surface', 'monochrome', 'topography']) assert.deepEqual(ids(pluto, lens), ['new-horizons']);
});

test('Didymos LUKE frames keep their DART mission credit; stripping capture removes it', async () => {
  const didymos = await graphFor('didymos');
  assert.deepEqual(ids(didymos, 'luke'), ['dart'], 'the LUKE lens must credit the DART mission LICIACube flew with');
  // Mutation check: a provenance document with every LUKE source's capture stripped must lose the credit,
  // proving this assertion actually depends on the capture data rather than passing unconditionally.
  const original = await provenance('didymos');
  const stripped: ProvenanceDocument = { ...original,
    sources: original.sources.map(source => { const { capture, ...rest } = source; return capture ? rest : source; }) };
  assert.deepEqual(ids(await graphFor('didymos', stripped), 'luke'), [], 'the mutation check must actually remove the credit');
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
  // Adrastea's shape is an authored IAU ellipsoid stand-in, so it stays empty.
  assert.deepEqual((await graphFor('adrastea')).datasets, []);
  // Juno and Pallas do carry a real VLT/SPHERE shape, and the asteroid Juno's
  // observations never mix with the identically named spacecraft's.
  for (const object of ['juno', 'pallas']) {
    assert.deepEqual(ids(await graphFor(object), 'elevation', 'facility'), ['vlt-ut3'],
      `${object} credits the telescope that produced its shape`);
  }
});

test('every migrated capture stays bound to its source; the full prepared graph is deterministic', async () => {
  const objects = []; let captured = 0, authored = 0;
  for (const object of SCENE_OBJECTS) {
    const document = await provenance(object.id);
    const manifest = explorationRecord(await json(`../../src/objects/${object.id}/source/manifest.json`));
    const inputs = explorationArray(manifest.inputs, raw => {
      const input = explorationRecord(raw); return { id: explorationText(input.id), capture: input.capture };
    });
    const inputsById = new Map(inputs.map(input => [input.id, input]));
    authored += inputs.filter(input => input.capture !== undefined).length;
    for (const source of document.sources.filter(source => source.capture)) {
      assert.deepEqual(source.capture, inputsById.get(source.id)?.capture); captured++;
    }
    objects.push(await objectInput(object.id, document));
  }
  assert.ok(authored >= 374); assert.ok(captured > 300 && captured <= authored);
  objects.push(...await prepareVolumeProvenance());
  const graph = compileContributions(objects, catalog);
  assert.deepEqual(graph, prepared.graph);
  assert.deepEqual(compileContributions(objects, catalog), graph);
  for (const [id, edgeIds] of Object.entries(graph.byFacility)) {
    assert.ok(edgeIds.every(index => {
      const attribution = graph.edges[index]?.attribution;
      return attribution?.kind === 'facility' && attribution.facilityId === id;
    }));
    const views = contributionViews(graph, edgeIds);
    for (const view of views) assert.ok(graph.byObject[view.objectId].some(index => edgeIds.includes(index) && graph.edges[index].lensIds.includes(view.lensId)));
  }
});

test('OSIRIS-REx retains Bennu observations and successor participation creates no APEX observations', () => {
  assert.ok(prepared.graph.byMission['osiris-rex'].length);
  assert.equal(prepared.graph.byMission['osiris-apex'], undefined);
  assert.deepEqual(catalog.missions.filter(mission => mission.participants.some(member => member.facilityId === 'osiris-rex')).map(mission => mission.id), ['osiris-rex', 'osiris-apex']);
  assert.ok(contributionViews(prepared.graph, prepared.graph.byFacility['osiris-rex']).every(view => view.objectId === 'bennu'));
  assert.equal(prepared.graph.byFacility.huygens, undefined);
  assert.equal(prepared.graph.byFacility['galileo-probe'], undefined);
});

test('approved artwork and emblems retain source bytes, dimensions and transparency', async () => {
  const libraries: readonly [string, Readonly<Record<string, ExplorationImage>>][] = [['render-library', prepared.images], ['emblem-library', prepared.emblems]];
  for (const [file, images] of libraries) {
    const library = artworkLibrary(await json(`../source/facilities/${file}.json`), file === 'emblem-library');
    assert.deepEqual(Object.keys(images), library.map(image => image.id));
    for (const approved of library) {
      const image = images[approved.id], bytes = await readFile(new URL(`../../public${image.src}`, import.meta.url));
      assert.ok(image);
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
        assert.ok(approved.source.localSource); assert.ok(approved.source.inputSha256);
        const source = await readFile(new URL(`../source/facilities/emblems/${approved.source.localSource}`, import.meta.url));
        assert.equal(createHash('sha256').update(source).digest('hex'), approved.source.inputSha256);
      }
    }
  }
  for (const id of ['grail-a', 'grail-b', 'viking-1-lander', 'viking-2-lander']) {
    const facility = catalog.facilities.find(facility => facility.id === id);
    assert.ok(facility);
    assert.equal(facility.imageId, undefined);
  }
});

test('unknown identities, impossible capture pairs, stale lenses and damaged indexes fail closed', async () => {
  const document = await provenance('mercury');
  for (const source of document.sources) Reflect.deleteProperty(source, 'capture');
  assert.deepEqual(ids(await graphFor('mercury', document), 'normal'), []);
  const source = document.sources.find(source => source.id === 'usgs-messenger-bdr-global-z3');
  assert.ok(source);
  const unknownCapture: Capture = { attributions: [{ kind: 'facility', facilityId: 'unknown-probe', evidence: source.origin }] };
  Reflect.set(source, 'capture', unknownCapture);
  await assert.rejects(graphFor('mercury', document), /Unknown capture facility/);
  const impossibleCapture: Capture = { attributions: [{ kind: 'facility', facilityId: 'messenger', missionId: 'juno', evidence: source.origin }] };
  Reflect.set(source, 'capture', impossibleCapture);
  await assert.rejects(graphFor('mercury', document), /participating pair/);
  const duplicateCapture: Capture = { attributions: [impossibleCapture.attributions[0]!, impossibleCapture.attributions[0]!] };
  Reflect.set(source, 'capture', duplicateCapture); assert.throws(() => validateObjectProvenance(document));
  const object = await objectInput('mercury'); Reflect.set(object, 'controls', []);
  assert.throws(() => compileContributions([object], catalog), /Unknown prepared dataset/);
  const graph = structuredClone(prepared.graph); Reflect.set(graph.byFacility, 'messenger', []);
  assert.throws(() => parseContributionGraph(graph, catalog), /Inconsistent contribution index/);
});
