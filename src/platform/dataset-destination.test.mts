import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { datasetDestination, parseDatasetDestination } from './dataset-destination.mts';
import { compileContributions, parseContributionGraph } from './exploration-contributions.mts';
import { compileSourceUsage, parseSourceUsage } from './source-usage.mts';
import { parseSourceCatalog, sourceResolver } from './source-catalog.mts';
import { parseAgencies, parseExplorationCatalog } from './exploration-catalog.mts';
import type { ProvenanceDocument } from './object-provenance.mts';

const sources = sourceResolver(parseSourceCatalog({ schema: 'cssearth-source-catalog@1', records: [{
  id: 'observation', title: 'Observed image', kind: 'data-product', identityLevel: 'work',
  identifiers: [], relations: [], statements: [],
  links: [{ role: 'landing', url: 'https://example.org/image', label: 'Image' }],
  evidence: [{ url: 'https://example.org/image', checkedOn: '2026-09-13', locator: 'Image credit' }],
}] }));
const catalog = parseExplorationCatalog({ schema: 'cssearth-facility-catalog@4', missions: [], facilities: [] }, parseAgencies({}), sources);
const pin = 'a'.repeat(64);
const provenance = (objectId: string): ProvenanceDocument => ({
  schema: 'cssearth-object-provenance@3', objectId, basis: 'recovered',
  manifest: { path: 'source/manifest.json' },
  generator: { path: 'tools/prepare/prepare-volume-provenance.mts' },
  sources: [{ id: 'image', kind: 'source-input', path: 'observed.fits', origin: 'https://example.org/image',
    credit: 'Observatory', acquisition: 'Pinned source image', sha256: pin, bytes: 1, dependencies: [], verification: 'retained-pin',
    sourceBinding: { kind: 'catalogued', references: [{ catalogueId: 'observation', role: 'material', evidence: 'Native image identity' }] },
    capture: { attributions: [{ kind: 'unresolved', label: 'Observatory', reason: 'Individual telescope not identified.', evidence: 'Native image credit.' }] },
  }],
  recipes: [{ id: 'volume', path: 'source/recipe.json', sha256: pin, parameters: { method: 'measured-image-model' } }],
  products: [{ observationAttribution: 'source-lineage', id: 'volume', label: 'Optical volume', process: 'Reconstruct observed image', recipe: 'volume', selector: '',
    recipeDependencies: ['volume'], inputs: ['image'], parents: [], lensIds: ['optical'],
    outputs: [{ url: 'prepared/lenses.json', sha256: pin, bytes: 1, verification: 'retained-pin' }],
  }],
  coverage: { scope: 'object-datasets-and-bound-rendering-products', unresolved: [] },
});
const object = (id: string, route: string, base: string) => ({ id, name: id, route, base,
  controls: [{ id: 'optical', label: 'Optical' }], provenance: provenance(id) });

test('observation attribution is explicit and independent of descriptive processing labels', () => {
  const volume = object('m42', '/sun/?focus=m42', 'src/objects/m42');
  const product = volume.provenance.products[0]!;
  const withProduct = (change: Partial<typeof product>) => [{ ...volume, provenance: { ...volume.provenance, products: [{ ...product, ...change }] } }];
  assert.equal(compileContributions(withProduct({ interpretation: { kind: 'future-processing-name' } }), catalog).edges.length, 1);
  assert.equal(compileContributions(withProduct({ observationAttribution: 'none' }), catalog).edges.length, 0);
  assert.throws(() => compileContributions(withProduct({ observationAttribution: undefined }), catalog), /Undeclared observation attribution/);
  const doubled = { ...volume, provenance: { ...volume.provenance, products: [product, { ...product, id: 'second-product' }] } };
  const graph = compileContributions([doubled], catalog);
  assert.equal(graph.edges.length, 2);
  assert.equal(graph.datasets.length, 1, 'a selectable view count is not a source or product count');
  const preview = { ...product, id: 'preview', inputs: [], parents: [product.id] };
  const excludedParent = { ...volume, provenance: { ...volume.provenance, products: [{ ...product, observationAttribution: 'none' as const }, preview] } };
  assert.equal(compileContributions([excludedParent], catalog).edges.length, 0, 'a derived preview cannot reintroduce excluded illustration credit');
});

test('both graph compilers retain body URLs and admit shared-camera focus URLs with explicit source owners', () => {
  const objects = [object('mercury', '/mercury/', 'src/objects/mercury'), object('m42', '/sun/?focus=m42', 'src/objects/m42')];
  const usage = compileSourceUsage(objects, sources), contributions = compileContributions(objects, catalog);
  assert.deepEqual(usage.datasets, contributions.datasets);
  assert.deepEqual(usage.datasets.map(view => view.href), ['/mercury/?dataset=optical', '/sun/?focus=m42&focusLens=optical']);
  assert.deepEqual(usage.edges.map(edge => edge.ownerPath), ['src/objects/mercury/source/manifest.json', 'src/objects/m42/source/manifest.json']);
  assert.deepEqual(parseContributionGraph(contributions, catalog), contributions);
  assert.deepEqual(parseSourceUsage(usage, sources), usage);
});

test('dataset destinations reject external URLs, cross-object or cross-lens selections and ambiguous query state', () => {
  const volume = object('m42', '/sun/?focus=m42', 'src/objects/m42');
  const usage = compileSourceUsage([volume], sources), contributions = compileContributions([volume], catalog);
  const invalid = [
    'https://example.org/sun/?focus=m42&focusLens=optical', '//example.org/sun/?focus=m42&focusLens=optical',
    '/sun/?focus=helix&focusLens=optical', '/sun/?focus=m42&focusLens=infrared',
    '/sun/?focus=m42&focus=m42&focusLens=optical', '/sun/?focus=m42&focusLens=optical&focusLens=optical',
    '/sun/?focus=m42&focusLens=optical&v=other', '/sun/?focus=m42&focusLens=optical#dataset=optical',
    '/sun/?focus=m42#dataset=optical', '/sun/#dataset=optical', '/helix/#dataset=optical',
    '/sun/?focus=m%34%32&focusLens=optical', '/sun/?focus=m42&focusLens=%6fptical',
  ];
  for (const href of invalid) {
    assert.throws(() => parseDatasetDestination(href, 'm42', 'optical'), /Invalid dataset/);
    assert.throws(() => parseSourceUsage({ ...usage, datasets: [{ ...usage.datasets[0], href }] }, sources), /Invalid dataset/);
    assert.throws(() => parseContributionGraph({ ...contributions, datasets: [{ ...contributions.datasets[0], href }] }, catalog), /Invalid dataset/);
  }
  for (const route of ['/helix/', '/sun/?focus=helix', '/sun/?focus=m42&focusLens=optical', '//example.org/']) {
    assert.throws(() => compileSourceUsage([{ ...volume, route }], sources), /Invalid dataset/);
    assert.throws(() => compileContributions([{ ...volume, route }], catalog), /Invalid dataset/);
  }
  assert.throws(() => datasetDestination('../m42', '/sun/?focus=../m42', 'optical'));
  assert.throws(() => datasetDestination('m42', '/sun/?focus=m42', 'optical&focus=helix'));
});

test('source usage derives manifest ownership from the package and rejects escaping or cross-object owners', () => {
  const volume = object('m42', '/sun/?focus=m42', 'src/objects/m42');
  for (const base of ['src/objects/helix', '../src/objects/m42', '/src/objects/m42', 'src/objects/m42/..']) {
    assert.throws(() => compileSourceUsage([{ ...volume, base }], sources));
  }
  assert.throws(() => compileSourceUsage([{ ...volume, provenance: { ...volume.provenance,
    manifest: { ...volume.provenance.manifest, path: '../helix/source/manifest.json' },
  } }], sources));
});
