import assert from 'node:assert/strict';
import test from 'node:test';
import { enrichImageMetadata, readDataLink, selectEnrichmentCandidates } from './enrich-messier';
import { applyEnrichments, originalAccessKey } from './enrich-messier-catalogue';
import type { ArchiveImage, MessierInventory } from './types';

const published = 'ivo://irsa.ipac/example?m42';
function image(overrides: Partial<ArchiveImage> = {}): ArchiveImage {
  return { id: `${published}#1234567890abcdef`, provider: 'irsa', collection: 'example', title: 'M42',
    instrument: 'camera', facility: 'observatory', calibrationLevel: 2, raDegrees: 83, decDegrees: -5,
    fieldDegrees: 1, footprint: null, resolutionArcsec: 1, width: 100, height: 100,
    wavelengthMinMeters: 1e-6, wavelengthMaxMeters: 2e-6, exposureSeconds: 20, estimatedBytes: null,
    accessUrl: 'https://irsa.ipac.caltech.edu/datalink/links?ID=example',
    accessFormat: 'application/x-votable+xml;content=datalink', sourceUrl: 'https://irsa.ipac.caltech.edu/', previewUrl: null, ...overrides };
}
const row = (id: string, url: string, semantics: string, mime = 'image/fits', error = '') =>
  `<TR><TD>${id}</TD><TD>${url}</TD><TD>${semantics}</TD><TD>${mime}</TD><TD>1234</TD><TD>${error}</TD></TR>`;
function table(rows: string) {
  return `<VOTABLE><RESOURCE type="results"><INFO name="QUERY_STATUS" value="OK"/><TABLE>
    <FIELD name="ID"/><FIELD name="access_url"/><FIELD name="semantics"/>
    <FIELD name="content_type"/><FIELD name="content_length" unit="byte"/><FIELD name="error_message"/>
    <DATA><TABLEDATA>${rows}</TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>`;
}

test('DataLink preserves matching identity, units and compound science links', () => {
  const xml = table(row(published, 'https://example.org/a.fits?a=1&amp;b=2', '#this') +
    row('ivo://unrelated', 'https://example.org/other.fits', '#this') + row(published, 'https://example.org/p.jpg', '#preview', 'image/jpeg'));
  const links = readDataLink(xml, published);
  assert.equal(links.length, 2); assert.equal(links[0]!.url, 'https://example.org/a.fits?a=1&b=2');
  assert.equal(links[0]!.contentLength, 1234);
  assert.throws(() => readDataLink(xml.replace('unit="byte"', 'unit="kbyte"'), published));
  assert.throws(() => readDataLink(xml.replace('value="OK"', 'value="OVERFLOW"'), published));
  assert.throws(() => readDataLink(`<!DOCTYPE VOTABLE [<!ENTITY bad SYSTEM "file:///etc/passwd">]>${xml}`, published));
  assert.throws(() => readDataLink(table(row(published, '', '#this', '', 'Internal error')), published), /Internal error/);
});

test('enrichment never GETs science pixels; validates preview and records original discovery', async () => {
  const calls: { url: string; method: string }[] = [], original = image();
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input), method = init?.method ?? 'GET'; calls.push({ url, method });
    if (url.includes('/datalink/')) return new Response(table(row(published, 'https://example.org/a.fits', '#this') + row(published, 'https://example.org/p.jpg', '#preview', 'image/jpeg')),
      { headers: { 'content-type': 'application/x-votable+xml' } });
    assert.equal(method, 'HEAD');
    return new Response(null, { headers: { 'content-type': url.endsWith('.fits') ? 'application/fits' : 'image/jpeg', 'content-length': '5678' } });
  };
  const result = await enrichImageMetadata(original, undefined, fetcher);
  assert.equal(result.id, original.id); assert.equal(result.sourceUrl, original.sourceUrl);
  assert.equal(result.metadataOriginal.accessUrl, original.accessUrl);
  assert.equal(result.accessUrl, 'https://example.org/a.fits'); assert.equal(result.estimatedBytes, 5678);
  assert.equal(result.previewUrl, 'https://example.org/p.jpg'); assert.equal(result.metadataEvidence.length, 3);
  assert.equal(result.metadataEvidence[0]!.responseSha256?.length, 64);
  assert.equal(calls.filter(call => call.method === 'GET').length, 1);
  assert.equal(original.previewUrl, null);
});

test('compound datasets and unverified previews remain unresolved rather than selecting arbitrary files', async () => {
  const original = image(), fetcher: typeof fetch = async (input, init) => {
    if ((init?.method ?? 'GET') === 'GET') return new Response(table(row(published, 'https://example.org/a.fits', '#this') +
      row(published, 'https://example.org/b.fits', '#this') + row(published, 'https://example.org/p.jpg', '#preview', 'image/jpeg')),
      { headers: { 'content-type': 'application/xml' } });
    assert.equal(String(input), 'https://example.org/p.jpg');
    return new Response(null, { headers: { 'content-type': 'text/html', 'content-length': '500' } });
  };
  const result = await enrichImageMetadata(original, undefined, fetcher);
  assert.equal(result.accessUrl, original.accessUrl); assert.equal(result.previewUrl, null);
  assert.equal(result.metadataEvidence[0]!.status, 'unavailable');
});

test('MAST uses returned jpegURI, keeps file identity and measures this file with HEAD', async () => {
  const original = image({ id: 'ivo://archive.stsci.edu/HST?abc#1234567890abcdef', provider: 'mast', collection: 'HST',
    accessUrl: 'https://mast.stsci.edu/api/v0.1/Download/file?uri=mast:HST/product/abc_drz.fits', accessFormat: 'image/fits' });
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('/invoke?')) return new Response(JSON.stringify({ status: 'COMPLETE', data: [
      { obs_id: 'abc', obs_collection: 'HST', jpegURL: 'mast:HST/product/provider-selected_mos.jpg' },
    ] }), { headers: { 'content-type': 'application/json' } });
    assert.equal(init?.method, 'HEAD');
    return new Response(null, { headers: { 'content-type': url.includes('.fits') ? 'text/plain' : 'image/jpeg', 'content-length': '10604160',
      'accept-ranges': 'bytes', etag: '"file-version"' } });
  };
  const result = await enrichImageMetadata(original, undefined, fetcher);
  assert.equal(result.accessUrl, original.accessUrl); assert.equal(result.estimatedBytes, 10604160);
  assert.ok(result.previewUrl?.includes('provider-selected_mos.jpg'));
  assert.equal(result.metadataEvidence[0]!.previewScope, 'observation');
  assert.ok(result.metadataEvidence.find(evidence => evidence.stage === 'science-head')?.note?.includes('text/plain'));
});

test('metadata MIME/length limits cannot fall through to a science download', async () => {
  const fetcher: typeof fetch = async () => new Response(null, { headers: { 'content-type': 'image/fits', 'content-length': '999999999' } });
  const result = await enrichImageMetadata(image(), undefined, fetcher);
  assert.equal(result.metadataEvidence[0]!.status, 'error'); assert.equal(result.estimatedBytes, null);
});

test('selection covers distinct bands before repeats, caps at 12 and excludes association/catalogue products', () => {
  const images: ArchiveImage[] = [];
  for (let band = 0; band < 5; band++) for (let n = 0; n < 5; n++) images.push(image({ id: `image-${band}-${n}`,
    wavelengthMinMeters: (band + 1) * 1e-6, wavelengthMaxMeters: (band + 2) * 1e-6 }));
  images.unshift(image({ id: 'catalogue', accessFormat: 'image/fits', accessUrl: 'https://example.org/a-mcat.fits.gz' }),
    image({ id: 'association', accessFormat: 'image/fits', accessUrl: 'https://example.org/a_asn.fits' }));
  const selected = selectEnrichmentCandidates(images);
  assert.equal(selected.length, 12); assert.equal(new Set(selected.slice(0, 5).map(row => row.wavelengthMinMeters)).size, 5);
  assert.ok(!selected.some(row => ['catalogue', 'association'].includes(row.id)));
  assert.ok([...new Set(selected.map(row => row.wavelengthMinMeters))].every(band => selected.filter(row => row.wavelengthMinMeters === band).length <= 3));
});

test('overlap copies keep their own identity and metadata while shared access updates avoid double counting', () => {
  const first = image(), copy = image({ id: 'copy-id', title: 'Another target receipt' });
  const query = { provider: 'irsa' as const, status: 'complete' as const, queriedAt: '2026-09-13', endpoint: 'https://irsa.ipac.caltech.edu/TAP/sync',
    query: 'original query', radiusDegrees: 1, matchedCount: 1, matchedEstimatedBytes: 0, matchedUnknownSizeCount: 1, images: [first] };
  const inventory: MessierInventory = { schema: 'cssearth-messier-inventory@1', generatedAt: '2026-09-13', catalogueSha256: '0'.repeat(64), policy: 'test',
    targets: [{ objectId: 'm1', queries: [query] }, { objectId: 'm2', queries: [{ ...query, status: 'truncated', matchedCount: null, images: [copy] }] }] };
  const update = { ...first, accessUrl: 'https://example.org/resolved.fits', accessFormat: 'image/fits', estimatedBytes: 100,
    metadataOriginal: { publishedId: published, accessUrl: first.accessUrl, accessFormat: first.accessFormat, estimatedBytes: null, previewUrl: null }, metadataEvidence: [] };
  const result = applyEnrichments(inventory, new Map([[originalAccessKey(first), update]]));
  const a = result.targets[0]!.queries[0]!, b = result.targets[1]!.queries[0]!;
  assert.equal(a.images[0]!.accessUrl, b.images[0]!.accessUrl); assert.equal(b.images[0]!.id, 'copy-id');
  assert.equal(b.images[0]!.title, 'Another target receipt'); assert.equal(b.query, 'original query');
  assert.equal(a.matchedEstimatedBytes, 100); assert.equal(a.matchedUnknownSizeCount, 0);
  assert.equal(b.matchedEstimatedBytes, null); assert.equal(b.matchedUnknownSizeCount, null);
  assert.equal(originalAccessKey(a.images[0]!), originalAccessKey(first));
  assert.equal(first.accessUrl, 'https://irsa.ipac.caltech.edu/datalink/links?ID=example');
});
