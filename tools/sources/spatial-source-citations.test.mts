import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { resolve } from 'node:path';
import { readSourceCatalog } from './read-source-catalogue.mts';
import { sourceResolver } from '../../src/platform/source-catalog.mts';
import { compileSourceUsage } from '../../src/platform/source-usage.mts';
import { spatialSourceCitations } from './spatial-source-citations.mts';

test('published spatial measurements join canonical Sources and remain citations', async () => {
  const root = resolve(import.meta.dirname, '../..'), sources = sourceResolver(await readSourceCatalog(root));
  const edges = await spatialSourceCitations(root, sources), usage = compileSourceUsage([], sources, edges);
  assert.equal(new Set(edges.map(e => e.catalogueId)).size, 216);
  assert.ok(edges.every(e => e.kind === 'citation' && e.consumerKind === 'spatial-measurement' && e.lensIds.length === 0));
  const distance = edges.find(e => e.consumerId === 'andromeda_01/distance')!;
  assert.equal(distance.catalogueId, 'publication-savino2022apj-938-101s');
  assert.ok(usage.bySource[distance.catalogueId]!.some(index => usage.edges[index]!.consumerId === 'andromeda_01/distance'));
  assert.ok(usage.byObject.andromeda_01?.length);
  assert.equal(usage.datasets.length, 0, 'a citation cannot fabricate an observed dataset');
  await assert.rejects(spatialSourceCitations(root, sources, async path => {
    const bytes = await readFile(resolve(root, path));
    if (!path.includes('/local-group/')) return bytes;
    const raw = JSON.parse(bytes.toString('utf8'));
    raw.sources.find((s: { references?: unknown[] }) => s.references?.length).references[0].catalogueId = 'missing-publication';
    return Buffer.from(JSON.stringify(raw));
  }), /Unbound spatial publication/);
});
