import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SourceRecord } from '../sources/catalog.js';
import { parseSourceCredits, sourceCredits, sourceIconKey } from './source-credits.js';
import { sourceUsageIndexes, type SourceUse } from './source-usage.js';

const record = (id: string, fields: Partial<SourceRecord>): SourceRecord => ({ id, kind: 'data-product', identityLevel: 'work', title: id,
  identifiers: [], links: [{ role: 'landing', url: `https://archive.example.org/${id}`, label: id }], evidence: [], relations: [], statements: [], ...fields });
const use = (catalogueId: string, kind: SourceUse['kind'], fields: Partial<SourceUse> = {}): SourceUse => ({ catalogueId, kind, consumerKind: 'object-product', consumerId: 'body/map',
  consumerLabel: 'Body · Map', ownerPath: 'src/objects/body/source/manifest.json', locator: 'map.tif', evidence: 'manifest', objectId: 'body',
  datasetIds: [], limitations: [], ...fields });

test('an object lists each source once, its inputs before its citations, with what it is and who publishes it', () => {
  const sources = { paper: record('paper', { kind: 'publication', title: 'A paper', publisher: 'A journal' }), map: record('map', { title: 'A map' }) };
  const edges = [use('paper', 'citation'), use('map', 'product-input'), use('paper', 'citation')];
  const credits = sourceCredits({ edges, datasets: [], ...sourceUsageIndexes(edges) }, sources);
  assert.deepEqual(credits.sources, { body: ['map', 'paper'] });
  assert.deepEqual(credits.records.map, { title: 'A map', detail: 'Data product · archive.example.org', url: 'https://archive.example.org/map', icon: 'archive.example.org' });
  assert.deepEqual(credits.records.paper, { title: 'A paper', detail: 'Publication · A journal', url: 'https://archive.example.org/paper', icon: 'archive.example.org' });
  assert.deepEqual(parseSourceCredits(JSON.parse(JSON.stringify(credits))), credits);
});

test('a source list that names a row the file does not hold is refused by object and ID', () => {
  assert.throws(() => parseSourceCredits({ schema: 'cssearth-prepared-source-credits@2', providers: {}, records: {}, sources: { body: ['map'] }, icons: {} }), /body: sources names map/u);
});

test('files without a published title are listed once per credit, with their count and the datasets they feed', () => {
  const sources = { 'source-body-a': record('source-body-a', {}), 'source-body-b': record('source-body-b', {}), 'source-body-c': record('source-body-c', {}),
    atlas: record('atlas', { title: 'An atlas' }) };
  const edges = [use('source-body-a', 'product-input', { credit: 'A survey team' }),
    use('source-body-b', 'product-input', { credit: 'A survey team', consumerLabel: 'Body · Elevation' }),
    use('source-body-c', 'product-input', { credit: 'An observatory' }), use('atlas', 'product-input', { credit: 'An agency' })];
  const credits = sourceCredits({ edges, datasets: [], ...sourceUsageIndexes(edges) }, sources);
  assert.deepEqual(credits.sources, { body: ['body#0', 'body#1', 'atlas'] });
  assert.deepEqual(credits.records['body#0'], { title: 'A survey team', detail: '2 files · Map, Elevation', icon: 'archive.example.org' });
  assert.deepEqual(credits.records['body#1'], { title: 'An observatory', detail: 'Data product · Map', url: 'https://archive.example.org/source-body-c', icon: 'archive.example.org' });
  assert.equal(credits.records.atlas?.title, 'An atlas');
  assert.deepEqual(credits.icons, { 'archive.example.org': 'https://archive.example.org/atlas' });
  assert.deepEqual(parseSourceCredits(JSON.parse(JSON.stringify(credits))), credits);
});

test('a DOI is keyed by its registrant, any other link by its host', () => {
  assert.equal(sourceIconKey('https://doi.org/10.3847/2041-8213/aa64d8'), 'doi:10.3847');
  assert.equal(sourceIconKey('https://Archive.STScI.edu/hlsp/opal'), 'archive.stsci.edu');
});
