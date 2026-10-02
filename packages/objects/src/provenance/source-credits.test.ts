import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SourceRecord } from '../sources/catalog.js';
import { parseSourceCredits, sourceCredits } from './source-credits.js';
import { sourceUsageIndexes, type SourceUse } from './source-usage.js';

const record = (id: string, fields: Partial<SourceRecord>): SourceRecord => ({ id, kind: 'data-product', identityLevel: 'work', title: id,
  identifiers: [], links: [{ role: 'landing', url: `https://archive.example.org/${id}`, label: id }], evidence: [], relations: [], statements: [], ...fields });
const use = (catalogueId: string, kind: SourceUse['kind']): SourceUse => ({ catalogueId, kind, consumerKind: 'object-product', consumerId: 'body/map',
  consumerLabel: 'Body · Map', ownerPath: 'src/objects/body/source/manifest.json', locator: 'map.tif', evidence: 'manifest', objectId: 'body',
  datasetIds: [], limitations: [] });

test('an object lists each source once, its inputs before its citations, with what it is and who publishes it', () => {
  const sources = { paper: record('paper', { kind: 'publication', title: 'A paper', publisher: 'A journal' }), map: record('map', { title: 'A map' }) };
  const edges = [use('paper', 'citation'), use('map', 'product-input'), use('paper', 'citation')];
  const credits = sourceCredits({ edges, datasets: [], ...sourceUsageIndexes(edges) }, sources);
  assert.deepEqual(credits.sources, { body: ['map', 'paper'] });
  assert.deepEqual(credits.records.map, { title: 'A map', detail: 'Data product · archive.example.org', url: 'https://archive.example.org/map' });
  assert.deepEqual(credits.records.paper, { title: 'A paper', detail: 'Publication · A journal', url: 'https://archive.example.org/paper' });
  assert.deepEqual(parseSourceCredits(JSON.parse(JSON.stringify(credits))), credits);
});

test('a source list that names a row the file does not hold is refused by object and ID', () => {
  assert.throws(() => parseSourceCredits({ schema: 'cssearth-prepared-source-credits@2', providers: {}, records: {}, sources: { body: ['map'] } }), /body: sources names map/u);
});
