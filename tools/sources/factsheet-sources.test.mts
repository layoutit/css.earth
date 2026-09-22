import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createServer } from 'node:http';
import { restoreFactsheetEvidence } from '../assets/restore-factsheet-evidence.mts';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseFactsheet, verifyFactsheetSources } from './factsheet-sources.mts';
import { factsheetCitations } from './source-catalogue-inputs.mts';
import { parseSourceCatalog, sourceResolver } from '../../src/platform/source-catalog.mts';
import { compileSourceUsage, parseSourceUsage, sourceUsageIndexes } from '../../src/platform/source-usage.mts';

const citation = { catalogueId: 'radius-table', url: 'https://example.invalid/radii', label: 'Radius table',
  checked: '2026-09-10', path: 'source/review.json', locator: '/references/0' };
const panel = { facts: [{ id: 'radius', label: 'Mean radius', value: '10 km', source: citation }],
  moreFacts: [{ id: 'rotation-period', label: 'Rotation period', value: '8 h',
    source: { ...citation, catalogueId: 'rotation-table', url: 'https://example.invalid/rotation', locator: '/references/1' } }] };
const sources = sourceResolver(parseSourceCatalog({ schema: 'cssearth-source-catalog@1', records: ['radius-table', 'rotation-table'].map(id => ({
  id, kind: 'reference-page', identityLevel: 'work', title: id, identifiers: [],
  links: [{ role: 'landing', url: `https://example.invalid/${id}`, label: id }],
  evidence: [{ url: `https://example.invalid/${id}`, checkedOn: '2026-09-10', locator: 'Fixture identity' }], relations: [], statements: [],
})) }));

test('facts sharing one evidence file retain separate claim citations and create no dataset destinations', () => {
  const parsed = parseFactsheet(panel);
  assert.deepEqual(parsed, panel);
  const edges = factsheetCitations(parsed, 'src/objects/body/source/content.json', { id: 'body' });
  const usage = compileSourceUsage([], sources, edges);
  assert.deepEqual(edges.map(edge => edge.catalogueId), ['radius-table', 'rotation-table']);
  assert.equal(edges[0].locator, '/panel/facts/0/source');
  assert.equal(edges[1].locator, '/panel/moreFacts/0/source');
  assert.equal(edges[1].citationUrl, 'https://example.invalid/rotation');
  assert.deepEqual(usage.datasets, []);
  assert.equal(edges.length, 2);
  assert.throws(() => parseFactsheet({ facts: [...panel.facts, { id: 'discovery', label: 'Discovery', value: 'Uncited fixture fact' }] }), /a published fact names its source/);
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


const pin = (path: string, bytes: Uint8Array) => ({ path, expectedBytes: bytes.length,
  expectedSha256: createHash('sha256').update(bytes).digest('hex') });
async function restorationFixture(t: TestContext, url: string, path = 'review.json') {
  const objectDirectory = await mkdtemp(resolve(tmpdir(), 'cssearth-fact-restoration-'));
  t.after(() => rm(objectDirectory, { recursive: true, force: true }));
  const source = resolve(objectDirectory, 'source');
  await mkdir(resolve(source, 'preparation'), { recursive: true });
  const bytes = Buffer.from('pinned scientific paper');
  const plan = { schema: 'cssearth-acquisition-plan@1', operations: [
    { kind: 'download', groups: ['restore', 'refresh'], path, url },
    { kind: 'download', groups: ['restore', 'refresh'], path: 'uncited-large-image.tif', url: `${url}/uncited` },
  ] };
  const planBytes = Buffer.from(JSON.stringify(plan)), planPath = 'preparation/acquisition.json';
  await writeFile(resolve(source, planPath), planBytes);
  const input = (path: string, bytes: Uint8Array) => ({ ...pin(path, bytes), id: path.replaceAll(/[^a-z]/gu, '-'),
    origin: url, credit: 'Fixture paper', license: 'CC0', acquisition: 'Pinned download', redistribution: 'Allowed',
    consumers: ['physical'], sourceBinding: { kind: 'local', reason: 'Authored fixture' } });
  const manifest = { schema: 'cssearth-authoritative-sources@2', inputs: [input(path, bytes), input('uncited-large-image.tif', Buffer.from('unused'))],
    documents: [pin(planPath, planBytes)], generatedIntermediates: [] };
  const facts = { facts: panel.facts.map(fact => ({ ...fact, source: { ...citation, path: `source/${path}` } })),
    moreFacts: [{ ...panel.facts[0], id: 'rotation-period', source: { ...citation, path: `source/${path}` } }] };
  return { objectDirectory, source, bytes, manifest, facts, path: `source/${path}` };
}

test('source preparation restores only cited missing pins from a clean checkout, then works offline', async t => {
  const requests: (string | undefined)[] = [];
  const bytes = Buffer.from('pinned scientific paper');
  const server = createServer((req, res) => { requests.push(req.url); res.end(bytes); });
  await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept));
  t.after(() => new Promise<void>(accept => server.close(() => accept())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const fixture = await restorationFixture(t, `http://127.0.0.1:${address.port}/paper.pdf`);
  const { objectDirectory, manifest, facts, path } = fixture;
  await assert.rejects(verifyFactsheetSources(facts, { objectDirectory, manifest }), /ENOENT/);
  const restoreMissing = (path: string) => restoreFactsheetEvidence({ objectDirectory, manifest, path });
  assert.deepEqual(await verifyFactsheetSources(facts, { objectDirectory, manifest, restoreMissing }), facts);
  assert.deepEqual(await readFile(resolve(objectDirectory, path)), bytes);
  assert.deepEqual(requests, ['/paper.pdf'], 'shared citation restored once; uncited image is not requested');
  await assert.rejects(readFile(resolve(fixture.source, 'uncited-large-image.tif')), { code: 'ENOENT' });
  const offline = () => { throw new Error('Existing evidence must not be downloaded'); };
  await verifyFactsheetSources(facts, { objectDirectory, manifest, restoreMissing: offline });
  await writeFile(resolve(objectDirectory, path), Buffer.alloc(bytes.length, 0));
  await assert.rejects(verifyFactsheetSources(facts, { objectDirectory, manifest, restoreMissing: offline }), /pin differs/);
});

test('failed citation downloads and drifted acquisition recipes publish no evidence', async t => {
  const fixture = await restorationFixture(t, 'https://example.invalid/paper.pdf');
  const { objectDirectory, manifest, path } = fixture;
  for (const bytes of [Buffer.from('short'), Buffer.alloc(fixture.bytes.length, 0)]) {
    await assert.rejects(restoreFactsheetEvidence({ objectDirectory, manifest, path,
      transport: { fetch: async () => new Response(bytes) } }), /Source (size|hash) drifted/);
    await assert.rejects(readFile(resolve(objectDirectory, path)), { code: 'ENOENT' });
    assert.deepEqual(await readdir(fixture.source), ['preparation'], 'failed streams leave no partial evidence');
  }
  await writeFile(resolve(fixture.source, 'preparation/acquisition.json'), '{}');
  await assert.rejects(restoreFactsheetEvidence({ objectDirectory, manifest, path,
    transport: { fetch: async () => { throw new Error('Unverified recipe must not be fetched'); } } }), /Source size drifted/);
});

test('citation restoration rejects escaping and dangling symlinks before fetching', async t => {
  const fixture = await restorationFixture(t, 'https://example.invalid/paper.pdf', 'linked/review.json');
  const outside = resolve(fixture.objectDirectory, 'outside'); await mkdir(outside);
  const linked = resolve(fixture.source, 'linked'); await symlink(outside, linked, 'dir');
  let fetches = 0;
  const transport = { fetch: async () => { fetches++; return new Response(fixture.bytes); } };
  await assert.rejects(restoreFactsheetEvidence({ ...fixture, transport }), /escapes/);
  await rm(linked); await symlink(resolve(fixture.objectDirectory, 'absent'), linked, 'dir');
  await assert.rejects(restoreFactsheetEvidence({ ...fixture, transport }), /dangling/);
  await rm(linked); await mkdir(linked); await symlink(resolve(outside, 'absent.pdf'), resolve(linked, 'review.json'));
  await assert.rejects(restoreFactsheetEvidence({ ...fixture, transport }), /not a regular file/);
  assert.equal(fetches, 0);
});
