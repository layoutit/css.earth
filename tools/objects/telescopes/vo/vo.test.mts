import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { astroquery, VoAccessError } from '../../astronomy-packages/client.mts';
import { canonical, digest, parseMetadata, parseLimits, parseRegion, recordKey, acquisitionKey, type DiscoverySnapshot, type MetadataResponse, type Resource } from './contracts.mts';
import { associateTarget, normalizeSnapshot, SERVICES, targetQuery } from './discovery.mts';
import { mediaType, planAccess, sodaParameters } from './access.mts';

const root = resolve(import.meta.dirname, '../../../..'), fixtures = resolve(root, 'tests/fixtures/telescope-vo');
const profile = SERVICES[1]!;
const target = { id: 'betelgeuse', names: ['Betelgeuse'], classification: 'star', classificationSource: 'fixture catalogue' };
const request = { target: target.id, wavelengthMicrometres: [0.78, 0.85] as const, kind: 'image' as const, result: 'telescope-product' as const };
const circle = { frame: 'icrs' as const, shape: 'circle' as const, raDegrees: 88.792938, decDegrees: 7.407063, radiusDegrees: 0.3 / 3600 };
const parse = async (file: string) => (await astroquery({ operation: 'vo-parse', file: resolve(fixtures, file), url: 'https://example.org/links', byteLimit: 1e6, timeFormat: 'mjd', timeScale: 'utc' })).vo!;
const almaPromise = parse('alma-obscore.xml'), esoPromise = parse('eso-links.xml');
function snapshot(response: MetadataResponse): DiscoverySnapshot { return { schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model,
  request, query: 'SELECT TOP 2 * FROM ivoa.obscore', scope: 'two-row sample', sampleLimit: 2, response, completeness: 'bounded-sample' }; }
function esoDescriptor(response: MetadataResponse) { return response.resources.find(r => r.parameters.some(p => p.value === 'ivo://ivoa.net/std/SODA#sync-1.0'))!; }

test('metadata preserves raw evidence, nulls, field widths and distinct observations sharing one dataset', async () => {
  const response = await almaPromise, saved = snapshot(response);
  assert.equal(response.queryStatus, 'OK'); assert.equal(response.rows.length, 2);
  assert.equal(response.raw.sha256, 'ea9d3eda733a4299d5b98fb2110b2f0cf26e410fafc0fcbbeb5b84621f49226f');
  assert.equal(response.fields.find(f => f.name === 'access_format')!.arraysize, '9');
  assert.equal(response.rows[0]!.access_format, 'applicati');
  assert.equal(response.rows[0]!.obs_publisher_did, response.rows[1]!.obs_publisher_did);
  assert.notEqual(recordKey(saved, response.rows[0]!, profile.identityColumns), recordKey(saved, response.rows[1]!, profile.identityColumns));
  assert.ok(response.issues.some(i => i.includes('too long')));
  assert.equal(response.times[0]!.t_min, '2023-08-03T11:12:29.578Z');
  assert.throws(() => parseMetadata({ ...response, rows: undefined }), /array/u);
  assert.throws(() => parseMetadata({ ...response, rows: [{}] }), /fields/u);
});
test('canonical identities preserve opaque strings and reject lossy or undefined values', () => {
  assert.equal(canonical({ b: 2, a: null }), canonical({ a: null, b: 2 }));
  assert.notEqual(digest({ id: 'ABC/1' }), digest({ id: 'abc/1' }));
  assert.notEqual(digest({ a: null }), digest({}));
  assert.throws(() => canonical({ a: undefined })); assert.throws(() => canonical(2 ** 54)); assert.throws(() => canonical(NaN));
  const limits = parseLimits();
  assert.notEqual(acquisitionKey('p', { BAND: [1, 2] }, {}, limits, 'v1'), acquisitionKey('p', { BAND: [1, 3] }, {}, limits, 'v1'));
  assert.notEqual(acquisitionKey('p', {}, {}, limits, 'v1'), acquisitionKey('p', {}, {}, { ...limits, scienceBytes: 123 }, 'v1'));
});
test('Astropy boundary distinguishes JD and MJD, converts declared time scales and preserves unsafe integers', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'vo-time-'));
  const file = resolve(directory, 'time.xml');
  await writeFile(file, `<VOTABLE version="1.3" xmlns="http://www.ivoa.net/xml/VOTable/v1.3"><RESOURCE type="results"><INFO name="QUERY_STATUS" value="OK"/><TABLE><FIELD name="time_min" ID="time_min" datatype="double" unit="d"/><FIELD name="id" ID="id" datatype="long"/><DATA><TABLEDATA><TR><TD>2451545</TD><TD>9007199254740993</TD></TR></TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>`);
  try {
    const result = (await astroquery({ operation: 'vo-parse', file, url: 'https://example.org/tap', byteLimit: 10000, timeFormat: 'jd', timeScale: 'tt' })).vo!;
    assert.equal(result.times[0]!.time_min, '2000-01-01T11:58:55.816Z');
    assert.deepEqual(result.rows[0]!.id, { integer: '9007199254740993' });
    const unscaled = (await astroquery({ operation: 'vo-parse', file, url: 'https://example.org/tap', byteLimit: 10000, timeFormat: 'jd' })).vo!;
    assert.equal(unscaled.times[0]!.time_min, null);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('target association respects catalogue class collisions and does not equate sky position with identity', () => {
  const moon = { id: 'io', names: ['Io'], classification: 'satellite', classificationSource: 'package' };
  const asteroid = { id: 'asteroid-85-io', names: ['85 Io','Io'], classification: 'asteroid', classificationSource: 'package' };
  assert.equal(associateTarget('Io', null, moon, [moon, asteroid]).status, 'ambiguous');
  assert.equal(associateTarget('Io', 'satellite', moon, [moon, asteroid]).status, 'confirmed');
  assert.notEqual(associateTarget('Io', 'asteroid', moon, [moon, asteroid]).status, 'confirmed');
  assert.equal(associateTarget('Io#Europa', 'satellite', moon, [moon]).status, 'ambiguous');
  assert.equal(associateTarget('Jupiter', null, moon, [moon]).status, 'unmatched');
});
test('normalization retains unknown time and malformed MIME without promoting archive flags', async () => {
  const response = await almaPromise, saved = snapshot(response), row = response.rows[0]!;
  const t = { id: 'test', names: [String(row.target_name)] };
  const result = normalizeSnapshot(saved, profile, t, [t])[0]!;
  assert.ok(result.issues.some(i => i.includes('Malformed'))); assert.equal(result.access.mime, 'applicati');
  assert.equal('verified' in result, false);
  const noTimes = { ...response, times: response.rows.map(() => ({})) };
  assert.equal(normalizeSnapshot(snapshot(noTimes), profile, t, [t])[0]!.startIso, null);
});
test('EPN frequency bounds reverse, body coordinates remain body coordinates, and missing bounds remain null', async () => {
  const base = await almaPromise;
  const values = { spectral_range_min: 1e14, spectral_range_max: 2e14, target_name: 'Betelgeuse', target_class: 'star', spatial_frame_type: 'body', c1min: 350, c1max: 10, granule_uid: 'Case:1', dataproduct_type: 'im' };
  const fields = Object.keys(values).map(name => ({ name, id: name, datatype: name.includes('spectral') ? 'double' : 'char', arraysize: null, unit: name.includes('spectral') ? 'Hz' : null, ucd: null, utype: null, xtype: null, ref: null }));
  const response = { ...base, fields, rows: [values], times: [{}], bindings: [] };
  const p = SERVICES[2]!, s = { ...snapshot(response), service: p.service, table: p.table, model: p.model };
  const result = normalizeSnapshot(s, p, target, [target])[0]!;
  assert.deepEqual(result.wavelengthsMicrometres, [1.49896229, 2.99792458]); assert.equal(result.spatial.frame, 'body');
  assert.equal(result.spatial.coordinates.c1min, 350); assert.equal(result.spatial.coordinates.c1max, 10);
  assert.equal(result.startIso, null); assert.equal(result.kind, 'image');
  assert.equal(normalizeSnapshot({ ...s, response: { ...response, rows: [{ ...values, spectral_range_max: 0 }] } }, p, target, [target])[0]!.wavelengthsMicrometres[0], null);
});
test('bounded queries escape literals and invalid requests cannot manufacture archive-wide completeness', () => {
  assert.match(targetQuery(profile, ["Barnard's star"]), /Barnard''s star/u);
  assert.throws(() => targetQuery({ ...profile, table: 'x;DROP TABLE x' }, ['a']));
  assert.throws(() => parseLimits({ scienceBytes: 0 })); assert.throws(() => parseRegion({ ...circle, frame: 'body' }));
  assert.equal(mediaType('applicati'), null); assert.equal(mediaType('application/x-votable+xml; content=datalink')!.parameters.content, 'datalink');
});
test('live-captured ESO and PSA scalar masks decode without losing the response', async () => {
  for (const file of ['eso-obscore.xml', 'psa-epn.xml']) {
    const response = await parse(file);
    assert.equal(response.queryStatus, file === 'psa-epn.xml' ? 'OVERFLOW' : 'OK', response.issues.join('\n'));
    assert.equal(response.rows.length, 1); assert.ok(Object.values(response.rows[0]!).some(v => v === null));
  }
});
test('ESO fixed-ID and CIRCLE resolve via PyVO; a nonexistent BAND capability is refused', async () => {
  const eso = await esoPromise, descriptor = esoDescriptor(eso), binding = eso.bindings.find(b => b.serviceId === descriptor.id)!;
  assert.equal(binding.error, null); assert.equal(binding.parameters.ID, 'ivo://eso.org/ID?ADP.2026-08-19T13:19:07.647');
  assert.deepEqual(sodaParameters(descriptor, { ...request, region: circle }, binding.parameters).CIRCLE, [circle.raDegrees, circle.decDegrees, circle.radiusDegrees]);
  assert.throws(() => sodaParameters(descriptor, { ...request, spectralFrame: 'barycentric' }, binding.parameters), /BAND/u);
  assert.throws(() => sodaParameters({ ...descriptor, groups: [] }, { ...request, region: circle }, binding.parameters), /missing/u);
});
test('BAND includes continuum support and requires the explicit spectral frame', async () => {
  const descriptor = esoDescriptor(await esoPromise);
  const band: Resource = { ...descriptor, groups: descriptor.groups.map(g => ({ ...g, parameters: [...g.parameters, { name: 'BAND', id: null, datatype: 'double', arraysize: '2', unit: 'm', ucd: 'em.wl;stat.interval', utype: null, xtype: 'interval', ref: null, value: null }] })) };
  const r = { ...request, kind: 'cube' as const, wavelengthMicrometres: [2.30, 2.34] as const, continuumMicrometres: [[2.2, 2.25], [2.4, 2.45]] as const };
  assert.throws(() => sodaParameters(band, r, { ID: 'opaque' }), /explicit/u);
  const values = sodaParameters(band, { ...r, spectralFrame: 'barycentric' }, { ID: 'opaque' }).BAND;
  assert.ok(Array.isArray(values));
  assert.ok(Math.abs(Number(values[0]) - 2.2e-6) < 1e-20); assert.ok(Math.abs(Number(values[1]) - 2.45e-6) < 1e-20);
});
test('multiple science links stay distinct, previews are excluded, cycles are bounded, and subsets never become direct access', async () => {
  const base = await almaPromise, saved = snapshot(base), obs = { ...normalizeSnapshot(saved, profile, target, [target])[0]!, kind: 'image', target: { status: 'confirmed' as const, target: target.id, reason: 'fixture' }, access: { url: 'https://example.org/links', mime: 'application/x-votable+xml;content=datalink', estimatedKilobytes: null } };
  const response = { ...base, bindings: [], rows: [
    { semantics: '#this', access_url: 'one.fits', content_type: 'image/fits' },
    { semantics: '#this', access_url: 'two.fits', content_type: 'image/fits' },
    { semantics: '#preview', access_url: 'preview.fits', content_type: 'image/fits' },
    { semantics: '#this', access_url: '/links', content_type: 'application/x-votable+xml;content=datalink' },
  ] };
  let calls = 0;
  const plan = await planAccess(root, obs, saved, request, async () => { calls++; return response; });
  assert.equal(plan.products.length, 2); assert.equal(calls, 1); assert.notEqual(plan.products[0]!.key, plan.products[1]!.key);
  assert.equal(plan.products[0]!.operation.url, 'https://example.org/one.fits');
  assert.equal((await planAccess(root, obs, saved, { ...request, region: circle }, async () => response)).products.length, 0);
});
test('archive product kind only proposes a family route; tables and events remain acquirable', async () => {
  const base = await almaPromise, saved = snapshot(base), normalized = normalizeSnapshot(saved, profile, target, [target])[0]!;
  for (const kind of ['table', 'events'] as const) {
    const observation = { ...normalized, kind, target: { status: 'confirmed' as const, target: target.id, reason: 'fixture' }, access: { url: `https://example.org/${kind}.fits`, mime: 'application/fits', estimatedKilobytes: 1 } };
    const plan = await planAccess(root, observation, saved, { ...request, kind });
    assert.equal(plan.products.length, 1, plan.issues.join('\n'));
    assert.equal(plan.products[0]!.decoder, 'family-pending');
    assert.equal(plan.products[0]!.kind, kind);
  }
});
test('bounded transfer rejects chunked oversized and error bodies without publishing partial files', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'vo-transfer-')), fixture = await readFile(resolve(fixtures, 'eso-circle.fits'));
  const requests: string[] = [];
  const server = createServer((req, res) => { requests.push(req.url!); if (req.url === '/error') { res.end('<VOTABLE>error</VOTABLE>'); return; } res.write(fixture.subarray(0,100)); res.end(fixture.subarray(100)); });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test server port.');
  const url = `http://127.0.0.1:${address.port}`;
  try {
    await assert.rejects(astroquery({ operation: 'vo-download', url: `${url}/large`, destination: resolve(directory,'large.fits'), byteLimit: 1024, parameters: {} }), /byte limit/u);
    await assert.rejects(astroquery({ operation: 'vo-download', url: `${url}/error`, destination: resolve(directory,'error.fits'), byteLimit: 1e6, parameters: {} }));
    const result = await astroquery({ operation: 'vo-download', url: `${url}/small`, destination: resolve(directory,'small.fits'), byteLimit: 1e6, parameters: {} });
    assert.equal(result.transfer!.file.bytes, 290880); assert.equal(result.transfer!.file.sha256, 'fd2a2d371e121bb50f64d781ac57b60f2f76d2c25d71f1c6a5ab9b5e262def60');
    assert.deepEqual(await readdir(directory), ['small.fits']); assert.deepEqual(requests, ['/large','/error','/small']);
  } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await rm(directory, { recursive: true, force: true }); }
});
test('failed SODA requests never ask for the whole product and never publish a partial file', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'vo-soda-failure-')), requests: string[] = [];
  const server = createServer((req, res) => { requests.push(req.url!); res.writeHead(503); res.end('deliberate subset failure'); });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test server port.');
  const url = `http://127.0.0.1:${address.port}/soda`;
  try {
    const original = await readFile(resolve(fixtures, 'eso-links.xml'), 'utf8'), file = resolve(directory, 'links.xml');
    await writeFile(file, original.replaceAll('https://dataportal.eso.org/dataPortal/soda/sync', url));
    const metadata = (await astroquery({ operation: 'vo-parse', file, url, byteLimit: 100000 })).vo!;
    const binding = metadata.bindings.find(b => b.url === url)!;
    await assert.rejects(astroquery({ operation: 'vo-download', url, destination: resolve(directory, 'science.fits'), byteLimit: 1e6,
      descriptor: { file: metadata.raw, row: binding.row, serviceId: binding.serviceId }, parameters: { ...binding.parameters, CIRCLE: [circle.raDegrees, circle.decDegrees, circle.radiusDegrees] } }), /503/u);
    assert.equal(requests.length, 1); assert.match(requests[0]!, /^\/soda\?/u); assert.ok(!requests.some(r => r.includes('/file') || r.includes('/parent')));
    assert.deepEqual(await readdir(directory), ['links.xml']);
  } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await rm(directory, { recursive: true, force: true }); }
});


test('top-level TIMESYS/COOSYS survive and unresolved explicit references never inherit a profile time scale', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'vo-timesys-')), file = resolve(directory, 'systems.xml');
  const xml = (ref: string) => `<VOTABLE version="1.4" xmlns="http://www.ivoa.net/xml/VOTable/v1.3"><TIMESYS ID="clock" timescale="TT" refposition="GEOCENTER" timeorigin="0"/><COOSYS ID="sky" system="ICRS"/><RESOURCE type="results"><INFO name="QUERY_STATUS" value="OK"/><TABLE><FIELD name="time_min" ID="time_min" datatype="double" unit="d" ref="${ref}"/><DATA><TABLEDATA><TR><TD>2451545</TD></TR></TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>`;
  try {
    await writeFile(file, xml('clock'));
    const request = { operation: 'vo-parse' as const, file, url: 'https://example.org/tap', byteLimit: 10000, timeFormat: 'jd' as const, timeScale: 'utc' as const };
    const declared = (await astroquery(request)).vo!;
    assert.equal(declared.times[0]!.time_min, '2000-01-01T11:58:55.816Z');
    assert.equal(declared.timeSystems.length, 1); assert.equal(declared.coordinateSystems.length, 1);
    await writeFile(file, xml('missing'));
    const unresolved = (await astroquery(request)).vo!;
    assert.equal(unresolved.times[0]!.time_min, null);
    assert.ok(unresolved.issues.some(i => i.includes('unresolved or ambiguous TIMESYS')));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('transfer failures distinguish authentication, no content, error payloads and interrupted streams', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'vo-failure-states-'));
  const server = createServer((req, res) => {
    if (req.url === '/auth') { res.writeHead(403); res.end('private'); }
    else if (req.url === '/empty') { res.writeHead(204); res.end(); }
    else if (req.url === '/broken') { res.writeHead(200, { 'Content-Length': '10000' }); res.write('SIMPLE  ='); setTimeout(() => res.destroy(), 10); }
    else res.end('<html>not science</html>');
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No port.');
  try {
    for (const [path, code] of [['auth','authentication'], ['empty','no-content'], ['html','protocol'], ['broken','interrupted']]) {
      await assert.rejects(astroquery({ operation: 'vo-download', url: `http://127.0.0.1:${address.port}/${path}`, destination: resolve(directory, `${path}.fits`), byteLimit: 100000, parameters: {} }),
        error => error instanceof VoAccessError && error.code === code);
    }
    assert.deepEqual(await readdir(directory), []);
  } finally { server.closeAllConnections(); await new Promise<void>(done => server.close(() => done())); await rm(directory, { recursive: true, force: true }); }
});
