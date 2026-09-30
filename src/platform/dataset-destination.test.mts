import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { DATASET_ROUTES, datasetDestination, parseDatasetDestination } from './dataset-destination.mts';
import { compileContributions, parseContributionGraph } from '@cssearth/objects/provenance';
import { compileSourceUsage, parseSourceUsage } from '@cssearth/objects/provenance';
import { parseSourceCatalog, sourceResolver } from '@cssearth/objects/sources';
import { parseAgencies, parseExplorationCatalog } from '@cssearth/objects/provenance';
import type { ObjectLineage } from '@cssearth/objects/provenance';

const sources = sourceResolver(parseSourceCatalog({ schema: 'cssearth-source-catalog@1', records: [{
  id: 'observation', title: 'Observed image', kind: 'data-product', identityLevel: 'work',
  identifiers: [], relations: [], statements: [],
  links: [{ role: 'landing', url: 'https://example.org/image', label: 'Image' }],
  evidence: [{ url: 'https://example.org/image', checkedOn: '2026-09-13', locator: 'Image credit' }],
}] }));
const catalog = parseExplorationCatalog({ schema: 'cssearth-facility-catalog@4', missions: [], facilities: [] }, parseAgencies({}), sources);
const lineage = (objectId: string): ObjectLineage => ({
  objectId, manifestPath: 'source/manifest.json',
  sources: [{ id: 'image', path: 'observed.fits', credit: 'Observatory', dependencies: [],
    sourceBinding: { kind: 'catalogued', references: [{ catalogueId: 'observation', role: 'material', evidence: 'Native image identity' }] },
    capture: { attributions: [{ kind: 'unresolved', label: 'Observatory', reason: 'Individual telescope not identified.', evidence: 'Native image credit.' }] },
  }],
  products: [{ observationAttribution: 'source-lineage', id: 'volume', label: 'Optical volume', inputs: ['image'], parents: [], datasetIds: ['optical'] }],
});
const object = (id: string, route: string, base: string) => ({ id, name: id, route, base,
  controls: [{ id: 'optical', label: 'Optical' }], lineage: lineage(id) });

test('observation attribution is explicit and independent of descriptive processing labels', () => {
  const volume = object('m42', '/m42/', 'src/objects/m42');
  const product = volume.lineage.products[0]!;
  const withProduct = (change: Partial<typeof product>) => [{ ...volume, lineage: { ...volume.lineage, products: [{ ...product, ...change }] } }];
  assert.equal(compileContributions(withProduct({ interpretation: { kind: 'future-processing-name' } }), catalog, DATASET_ROUTES).edges.length, 1);
  assert.equal(compileContributions(withProduct({ observationAttribution: 'none' }), catalog, DATASET_ROUTES).edges.length, 0);
  const doubled = { ...volume, lineage: { ...volume.lineage, products: [product, { ...product, id: 'second-product' }] } };
  const graph = compileContributions([doubled], catalog, DATASET_ROUTES);
  assert.equal(graph.edges.length, 2);
  assert.equal(graph.datasets.length, 1, 'a selectable view count is not a source or product count');
  const preview = { ...product, id: 'preview', inputs: [], parents: [product.id] };
  const excludedParent = { ...volume, lineage: { ...volume.lineage, products: [{ ...product, observationAttribution: 'none' as const }, preview] } };
  assert.equal(compileContributions([excludedParent], catalog, DATASET_ROUTES).edges.length, 0, 'a derived preview cannot reintroduce excluded illustration credit');
});

test('both graph compilers give bodies and catalogue focuses the same page dataset URLs', () => {
  const objects = [object('mercury', '/mercury/', 'src/objects/mercury'), object('m42', '/m42/', 'src/objects/m42')];
  const usage = compileSourceUsage(objects, sources, DATASET_ROUTES), contributions = compileContributions(objects, catalog, DATASET_ROUTES);
  assert.deepEqual(usage.datasets, contributions.datasets);
  assert.deepEqual(usage.datasets.map(view => view.href), ['/mercury/?dataset=optical', '/m42/?dataset=optical']);
  assert.deepEqual(usage.edges.map(edge => edge.ownerPath), ['src/objects/mercury/source/manifest.json', 'src/objects/m42/source/manifest.json']);
  assert.deepEqual(parseContributionGraph(contributions, catalog, DATASET_ROUTES), contributions);
  assert.deepEqual(parseSourceUsage(usage, sources, DATASET_ROUTES), usage);
});

test('the graph compilers and parsers format and read dataset URLs only through the routes the application passes them', () => {
  const objects = [object('mercury', '/mercury/', 'src/objects/mercury'), object('m42', '/m42/', 'src/objects/m42')];
  const formatted: string[] = [], parsed: string[] = [];
  const routes = {
    destination: (objectId: string, route: string, datasetId: string) => { formatted.push(`${objectId} ${route} ${datasetId}`); return `/datasets/${objectId}/${datasetId}`; },
    parse: (value: unknown, ownerId: string, ownerDatasetId: string) => {
      parsed.push(`${ownerId}/${ownerDatasetId}`);
      if (value !== `/datasets/${ownerId}/${ownerDatasetId}`) throw new TypeError('Invalid dataset destination URL.');
      return value;
    },
  };
  const usage = compileSourceUsage(objects, sources, routes), contributions = compileContributions(objects, catalog, routes);
  assert.deepEqual(usage.datasets.map(view => view.href), ['/datasets/mercury/optical', '/datasets/m42/optical']);
  assert.deepEqual(contributions.datasets, usage.datasets);
  assert.deepEqual(formatted, ['mercury /mercury/ optical', 'm42 /m42/ optical', 'mercury /mercury/ optical', 'm42 /m42/ optical']);
  assert.deepEqual(parsed, ['mercury/optical', 'm42/optical']);
  assert.deepEqual(parseContributionGraph(contributions, catalog, routes), contributions);
  assert.deepEqual(parseSourceUsage(usage, sources, routes), usage);
  // The application's routes refuse a URL another host's routes produced, and the other routes refuse the application's.
  assert.throws(() => parseSourceUsage(usage, sources, DATASET_ROUTES), /Invalid dataset/);
  assert.throws(() => parseContributionGraph(contributions, catalog, DATASET_ROUTES), /Invalid dataset/);
  assert.throws(() => parseSourceUsage(compileSourceUsage(objects, sources, DATASET_ROUTES), sources, routes), /Invalid dataset/);
});

test('dataset destinations reject external URLs, cross-object or cross-dataset selections and ambiguous query state', () => {
  const volume = object('m42', '/m42/', 'src/objects/m42');
  const usage = compileSourceUsage([volume], sources, DATASET_ROUTES), contributions = compileContributions([volume], catalog, DATASET_ROUTES);
  const invalid = [
    'https://example.org/m42/?dataset=optical', '//example.org/m42/?dataset=optical',
    '/helix/?dataset=optical', '/m42/?dataset=infrared', '/m42/?dataset=optical&dataset=optical',
    '/m42/?dataset=optical&v=other', '/m42/?dataset=optical#dataset=optical',
    '/m42/#dataset=optical', '/helix/#dataset=optical', '/m%34%32/?dataset=optical', '/m42/?dataset=%6fptical',
    '/sun/?focus=m42&focusDataset=optical', '/m42/?focusDataset=optical',
  ];
  for (const href of invalid) {
    assert.throws(() => parseDatasetDestination(href, 'm42', 'optical'), /Invalid dataset/);
    assert.throws(() => parseSourceUsage({ ...usage, datasets: [{ ...usage.datasets[0], href }] }, sources, DATASET_ROUTES), /Invalid dataset/);
    assert.throws(() => parseContributionGraph({ ...contributions, datasets: [{ ...contributions.datasets[0], href }] }, catalog, DATASET_ROUTES), /Invalid dataset/);
  }
  for (const route of ['/helix/', '/sun/?focus=m42', '/m42/?dataset=optical', '//example.org/']) {
    assert.throws(() => compileSourceUsage([{ ...volume, route }], sources, DATASET_ROUTES), /Invalid dataset/);
    assert.throws(() => compileContributions([{ ...volume, route }], catalog, DATASET_ROUTES), /Invalid dataset/);
  }
  assert.throws(() => datasetDestination('../m42', '/../m42/', 'optical'));
  assert.throws(() => datasetDestination('m42', '/m42/', 'optical&dataset=infrared'));
});

test('source usage derives manifest ownership from the package and rejects escaping or cross-object owners', () => {
  const volume = object('m42', '/m42/', 'src/objects/m42');
  for (const base of ['src/objects/helix', '../src/objects/m42', '/src/objects/m42', 'src/objects/m42/..']) {
    assert.throws(() => compileSourceUsage([{ ...volume, base }], sources, DATASET_ROUTES));
  }
  assert.throws(() => compileSourceUsage([{ ...volume, lineage: { ...volume.lineage, manifestPath: '../helix/source/manifest.json' } }], sources, DATASET_ROUTES));
});
