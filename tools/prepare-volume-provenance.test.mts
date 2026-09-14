import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { datasetContext } from '../site/dataset-context.mts';
import { parseSourceCatalog, sourceObject, sourceResolver } from '../src/platform/source-catalog.mts';
import { compileSourceUsage } from '../src/platform/source-usage.mts';
import { parseAgencies, parseExplorationCatalog } from '../src/platform/exploration-catalog.mts';
import { compileContributions } from '../src/platform/exploration-contributions.mts';
import { productSourceIds } from '../src/platform/object-provenance.mts';
import { prepareVolumeProvenance } from './prepare-volume-provenance.mts';

const root = resolve(import.meta.dirname, '..');
test('all installed volume lenses produce standard source cards with real source-to-product edges', async () => {
  const closure = new Set<string>();
  const entries = await prepareVolumeProvenance({ root, input: async path => { closure.add(path); return readFile(resolve(root, path)); } });
  assert.deepEqual(entries.map(entry => [entry.id, entry.controls.length]), [
    ['helix', 3], ['lmc', 3], ['m1', 6], ['m2-9', 1], ['m42', 2], ['m45', 5], ['m8', 3],
  ]);
  assert.equal(entries.find(entry => entry.id === 'm45')?.defaultLens, 'optical-composite');
  assert.ok([...closure].every(path => !path.startsWith('.local/') && !path.endsWith('/prepared/lenses.json')));
  const sourceFiles = await readdir(resolve(root, 'src/sources'));
  const sources = sourceResolver(parseSourceCatalog({ schema: 'cssearth-source-catalog@1', records: await Promise.all(sourceFiles.filter(path => path.endsWith('.json')).map(async path => JSON.parse(await readFile(resolve(root, 'src/sources', path), 'utf8')))) }));
  const agencies = parseAgencies(JSON.parse(await readFile(resolve(root, 'site/source/agency-logos.json'), 'utf8')));
  const catalog = parseExplorationCatalog(JSON.parse(await readFile(resolve(root, 'site/source/machines/catalog.json'), 'utf8')), agencies, sources);
  const usage = compileSourceUsage(entries, sources), graph = compileContributions(entries, catalog);
  for (const entry of entries) {
    assert.equal(entry.provenance.basis, 'recovered');
    assert.equal(entry.route, `/sun/?focus=${entry.id}`);
    assert.ok(entry.controls.some(control => control.id === entry.defaultLens));
    for (const control of entry.controls) {
      assert.notEqual(control.title, control.label);
      assert.notEqual(control.title, control.description);
      assert.notEqual(control.title, control.summary);
      const product = entry.provenance.products.find(product => product.lensIds?.includes(control.id));
      assert.ok(product);
      const inputs = productSourceIds(entry.provenance, product.id);
      const own = entry.provenance.sources.find(source => source.lensId === control.id);
      assert.ok(own && inputs.includes(own.id));
      const context = datasetContext(entry.id, control.id, entry.provenance, graph, catalog, usage, sources);
      assert.ok(context.sources.some(group => group.links.length));
      assert.ok(context.sources.some(group => group.supporting.length));
      const output = entry.outputs.find(output => output.path.endsWith(control.thumbnailUrl));
      assert.ok(output && output.text instanceof Uint8Array);
      const image = await sharp(output.text).metadata();
      assert.equal(image.format, 'webp');
      assert.ok(image.width && image.width <= 768 && image.height && image.height <= 768);
      assert.deepEqual([control.texture?.width, control.texture?.height], [image.width, image.height]);
    }
  }
  const m45 = entries.find(entry => entry.id === 'm45')!;
  assert.equal(m45.provenance.products.find(p => p.id === 'noirlab-optical')?.inputEvidence?.find(e => e.sourceId === 'distance')?.role, 'placement');
  const observationEdge = graph.edges.find(e => e.objectId === 'm45' && e.productId === 'noirlab-optical' && e.sourceId === 'noirlab-optical')!;
  assert.deepEqual(observationEdge.roles, ['appearance']);
  assert.equal(observationEdge.observation?.id, 'noao-m45');
  assert.equal(observationEdge.observation?.observedAt, null);
  assert.equal(observationEdge.observation?.instrument, null);
  const helix = entries.find(entry => entry.id === 'helix');
  assert.ok(helix);
  for (const product of helix.provenance.products) assert.ok(product.inputs.includes('hco-components'));
  const lmc = entries.find(entry => entry.id === 'lmc');
  assert.ok(lmc);
  for (const product of lmc.provenance.products) for (const id of ['density-prior', 'catalogue-stars', 'sky-registration']) assert.ok(product.inputs.includes(id));
  const hubble = graph.edges.filter(edge => edge.objectId === 'm2-9' && edge.attribution.kind === 'machine');
  assert.ok(hubble.some(edge => edge.attribution.kind === 'machine' && edge.attribution.machineId === 'hubble'));
  const captures = entries.flatMap(entry => entry.provenance.sources.flatMap(source => source.lensId ? (source.capture?.attributions ?? []).map(attribution => ({ objectId: entry.id, lensId: source.lensId, attribution })) : []));
  const legacyCaptures = captures.filter(capture => ['helix', 'lmc', 'm2-9', 'm42'].includes(capture.objectId));
  assert.equal(legacyCaptures.length, 9);
  assert.deepEqual(legacyCaptures.filter(capture => capture.attribution.kind === 'unresolved').map(capture => `${capture.objectId}/${capture.lensId}`), ['lmc/horalek-widefield']);
  assert.deepEqual([...new Set(legacyCaptures.flatMap(capture => capture.attribution.kind === 'machine' ? [capture.attribution.machineId] : []))].sort(), ['eso-3-6m', 'hubble', 'mpg-eso-2-2m', 'vista', 'vst', 'wise']);
  const newEntries = entries.filter(entry => ['m1', 'm45', 'm8'].includes(entry.id));
  const newLenses = newEntries.flatMap(entry => entry.controls.map(control => `${entry.id}/${control.id}`)).sort();
  assert.equal(newLenses.length, 14);
  const newCaptures = captures.filter(capture => ['m1', 'm45', 'm8'].includes(capture.objectId));
  assert.deepEqual([...new Set(newCaptures.map(capture => `${capture.objectId}/${capture.lensId}`))].sort(), newLenses,
    'All fourteen added observations name their actual known observing equipment.');
  assert.deepEqual(newCaptures.map(capture => [
    `${capture.objectId}/${capture.lensId}`, capture.attribution.kind,
    capture.attribution.kind === 'machine' ? capture.attribution.machineId : null,
  ]).sort((left, right) => String(left[0]).localeCompare(String(right[0]))), [
    ['m1/chandra-xray', 'machine', 'chandra'],
    ['m1/hubble-optical', 'machine', 'hubble'],
    ['m1/spitzer-infrared', 'machine', 'spitzer'],
    ['m1/vla-radio', 'machine', 'vla'],
    ['m1/webb-components', 'machine', 'webb'],
    ['m1/webb-infrared', 'machine', 'webb'],
    ['m45/noirlab-optical', 'machine', 'wiyn-0-9m'],
    ['m45/optical-composite', 'machine', 'niittee-sharpstar-61edph-iii'],
    ['m45/spitzer-irac', 'machine', 'spitzer'],
    ['m45/spitzer-irac-mips', 'machine', 'spitzer'],
    ['m45/wise-four-band', 'machine', 'wise'],
    ['m8/eso-optical', 'machine', 'mpg-eso-2-2m'],
    ['m8/eso-vista', 'machine', 'vista'],
    ['m8/spitzer-mid-infrared', 'machine', 'spitzer'],
  ]);
});

test('source-lens binding and recipe pins fail closed when their properties are removed', async () => {
  const mutations: { file: string; mutate: (value: Record<string, unknown>) => void; error: RegExp }[] = [
    { file: 'src/objects/helix/source/manifest.json', mutate(value) {
      if (!Array.isArray(value.inputs)) throw new TypeError('Missing source inputs.');
      delete sourceObject(value.inputs[0]).lensId;
    }, error: /Unbound volume lens image/ },
    { file: 'src/objects/helix/object.json', mutate(value) {
      sourceObject(value.prepared).sha256 = '0'.repeat(64);
    }, error: /Changed installed volume bank/ },
    { file: 'labs/nebula/models/helix/joint-fit.json', mutate(value) { delete value.molecularSource; }, error: /Changed volume recipe/ },
  ];
  for (const mutation of mutations) await assert.rejects(prepareVolumeProvenance({ root, input: async path => {
    const bytes = await readFile(resolve(root, path));
    if (path !== mutation.file) return bytes;
    const value = sourceObject(JSON.parse(bytes.toString('utf8'))); mutation.mutate(value);
    return Buffer.from(JSON.stringify(value));
  } }), mutation.error);
});
