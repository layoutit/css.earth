import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseFactsheet, verifyFactsheetSources } from './factsheet-sources.mts';
import { factsheetCitations } from './source-catalogue-inputs.mts';
import { parseSourceCatalog, sourceResolver } from '../src/platform/source-catalog.mts';
import { compileSourceUsage, parseSourceUsage, sourceUsageIndexes } from '../src/platform/source-usage.mts';

const citation = { catalogueId: 'radius-table', url: 'https://example.invalid/radii', label: 'Radius table',
  checked: '2026-09-10', path: 'source/review.json', locator: '/references/0' };
const panel = { facts: [{ id: 'radius', label: 'Mean radius', value: '10 km', source: citation }],
  moreFacts: [{ id: 'rotation-period', label: 'Rotation period', value: '8 h',
    source: { ...citation, catalogueId: 'rotation-table', url: 'https://example.invalid/rotation', locator: '/references/1' } },
  { id: 'discovery', label: 'Discovery', value: 'Uncited fixture fact' }] };
const sources = sourceResolver(parseSourceCatalog({ schema: 'cssearth-source-catalog@1', records: ['radius-table', 'rotation-table'].map(id => ({
  id, kind: 'reference-page', identityLevel: 'work', title: id, identifiers: [],
  links: [{ role: 'landing', url: `https://example.invalid/${id}`, label: id }],
  evidence: [{ url: `https://example.invalid/${id}`, checkedOn: '2026-09-10', locator: 'Fixture identity' }], relations: [], statements: [],
})) }));

test('facts sharing one evidence file retain separate claim citations and create no dataset destinations', () => {
  const parsed = parseFactsheet(panel);
  assert.deepEqual(parsed, panel);
  const edges = factsheetCitations(parsed, 'src/planets/body/source/content.json', { id: 'body' });
  const usage = compileSourceUsage([], sources, edges);
  assert.deepEqual(edges.map(edge => edge.catalogueId), ['radius-table', 'rotation-table']);
  assert.equal(edges[0].locator, '/panel/facts/0/source');
  assert.equal(edges[1].locator, '/panel/moreFacts/0/source');
  assert.equal(edges[1].citationUrl, 'https://example.invalid/rotation');
  assert.deepEqual(usage.datasets, []);
  assert.equal(edges.length, 2, 'the uncited fact acquires no inferred source');
  for (const mutation of [{ kind: 'product-input' }, { lensIds: ['surface'] }, { productId: 'surface' }, { objectId: undefined }, { citationUrl: undefined }]) {
    const invalid = structuredClone(edges);
    Object.assign(invalid[0], mutation);
    assert.throws(() => parseSourceUsage({ edges: invalid, datasets: [], ...sourceUsageIndexes(invalid) }, sources), /factsheet citation/);
  }
});

test('all factsheet preparation rejects unsafe links, impossible dates, escaping paths and duplicate facts', () => {
  for (const mutation of [
    { url: 'javascript:alert(1)' }, { url: 'https://name:secret@example.invalid/' },
    { checked: '2026-02-30' }, { checked: '0000-01-01' },
    { path: 'source/../README.md' }, { path: '/tmp/evidence.json' }, { path: 'prepared/content.json' },
    { catalogueId: undefined },
  ]) assert.throws(() => parseFactsheet({ facts: [{ ...panel.facts[0], source: { ...citation, ...mutation } }] }));
  assert.throws(() => parseFactsheet({ facts: panel.facts, moreFacts: panel.facts }), /duplicated/);
});

test('cited local evidence must match one manifest pin and stay inside the package', async t => {
  const objectDirectory = await mkdtemp(resolve(tmpdir(), 'cssearth-fact-evidence-'));
  t.after(() => rm(objectDirectory, { recursive: true, force: true }));
  await mkdir(resolve(objectDirectory, 'source'));
  const file = resolve(objectDirectory, 'source/review.json');
  const bytes = Buffer.from('{"references":[{"radiusKm":10},{"rotationHours":8}]}');
  await writeFile(file, bytes);
  const entry = { path: 'review.json', expectedBytes: bytes.length, expectedSha256: createHash('sha256').update(bytes).digest('hex') };
  const manifest = { documents: [entry] };
  let reads = 0;
  const read = async (path: string) => { reads++; return readFile(resolve(objectDirectory, path)); };
  assert.deepEqual(await verifyFactsheetSources(panel, { objectDirectory, manifest, sources, read }), panel);
  assert.equal(reads, 1, 'the shared evidence bytes are read once');
  await assert.rejects(verifyFactsheetSources(panel, { objectDirectory, manifest, sources: {} }), /Unknown fact source/);
  await assert.rejects(verifyFactsheetSources(panel, { objectDirectory, manifest: { documents: [] } }), /one manifest entry/);
  await assert.rejects(verifyFactsheetSources(panel, { objectDirectory, manifest: { documents: [entry, entry] } }), /one manifest entry/);
  await writeFile(file, bytes.toString().replace('10', '20'));
  await assert.rejects(verifyFactsheetSources(panel, { objectDirectory, manifest }), /pin differs/);
  await rm(file);
  await assert.rejects(verifyFactsheetSources(panel, { objectDirectory, manifest }), /ENOENT/);
  await writeFile(resolve(objectDirectory, 'outside.json'), bytes);
  await symlink('../outside.json', file);
  await assert.rejects(verifyFactsheetSources(panel, { objectDirectory, manifest }), /escapes/);
});
