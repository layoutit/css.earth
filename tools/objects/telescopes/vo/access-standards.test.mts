import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { astroquery } from '@cssearth/telescope/node';
import { planAccess, sodaParameters, type MetadataLoader } from './access.mts';
import type { CapabilityRequest } from '../recipe-request.mts';
import { jsonValue, parseLimits, type DiscoverySnapshot, type Json, type MetadataResponse, type Resource } from '@cssearth/telescope/node';
import { normalizeSnapshot, SERVICES } from './discovery.mts';
const test = sourceTest();

const fixtures = resolve(import.meta.dirname, '../../../../tests/fixtures/telescope-vo');
const target = { id: 'betelgeuse', names: ['Betelgeuse'], classification: 'star', classificationSource: 'fixture catalogue' };
const request: CapabilityRequest = { target: target.id, wavelengthMicrometres: [0.78, 0.85], kind: 'image', result: 'telescope-product' };
const circle = { frame: 'icrs' as const, shape: 'circle' as const, raDegrees: 88.792938, decDegrees: 7.407063, radiusDegrees: 0.01 };

async function source(): Promise<{ readonly snapshot: DiscoverySnapshot; readonly observation: ReturnType<typeof normalizeSnapshot>[number] }> {
  const response = (await astroquery({ operation: 'vo-parse', file: resolve(fixtures, 'eso-obscore.xml'), url: SERVICES[0]!.service, byteLimit: 1e6, timeFormat: 'mjd', timeScale: 'utc' })).vo!;
  const snapshot: DiscoverySnapshot = { schema: 'cssearth-vo-discovery@1', service: SERVICES[0]!.service, table: SERVICES[0]!.table, model: SERVICES[0]!.model,
    request: jsonValue(request), query: 'fixture', scope: 'bounded fixture', sampleLimit: 1, response, completeness: 'bounded-sample' };
  const observation = normalizeSnapshot(snapshot, SERVICES[0]!, target, [target])[0]!;
  return { snapshot, observation: { ...observation, kind: 'image', target: { status: 'confirmed', target: target.id, reason: 'fixture' },
    access: { url: 'https://example.org/root-links', mime: 'application/x-votable+xml; content=datalink', estimatedKilobytes: null } } };
}

function parameter(name: string, datatype: string, arraysize: string | null, unit: string | null, ucd: string | null, value: Json = null) {
  return { name, id: null, datatype, arraysize, unit, ucd, utype: null, xtype: null, ref: null, value };
}
function descriptor(id: string, standardID: string): Resource {
  return { id, type: 'meta', utype: 'adhoc:service', parameters: [parameter('standardID', 'char', '*', null, null, standardID)], groups: [] };
}
function response(base: MetadataResponse, name: string, rows: readonly Readonly<Record<string, Json>>[], resources: readonly Resource[] = [], bindings: MetadataResponse['bindings'] = []): MetadataResponse {
  return { ...base, raw: { path: `/fixture/${name}.xml`, bytes: name.length, sha256: name.padEnd(64, '0').slice(0, 64) }, effectiveUrl: `https://example.org/${name}`,
    rows, resources, bindings, times: rows.map(() => ({})) };
}

test('SODA accepts only normative parameter triples, apart from the pinned ESO legacy ID declaration', () => {
  // SODA 1.0 §3.1: https://www.ivoa.net/documents/SODA/20170517/REC-SODA-1.0.html
  const base: Resource = { id: 'soda', type: 'meta', utype: 'adhoc:service', parameters: [parameter('standardID', 'char', '*', null, null, 'ivo://ivoa.net/std/SODA#sync-1.0')], groups: [{ name: 'inputParams', parameters: [
    parameter('ID', 'char', '*', null, 'meta.ref.url;meta.curation'), { ...parameter('BAND', 'double', '2', 'm', 'em.wl;stat.interval'), xtype: 'interval' },
  ] }] };
  const band = sodaParameters(base, { ...request, spectralFrame: 'barycentric' }, { ID: 'ivo://example.org/product' }).BAND;
  assert.ok(Array.isArray(band)); assert.ok(Math.abs(Number(band[0]) - 7.8e-7) < 1e-20); assert.ok(Math.abs(Number(band[1]) - 8.5e-7) < 1e-20);
  for (const changed of [
    { ...base, groups: [{ ...base.groups[0]!, parameters: [{ ...base.groups[0]!.parameters[0]!, ucd: 'meta.id;meta.main' }, base.groups[0]!.parameters[1]!] }] },
    { ...base, groups: [{ ...base.groups[0]!, parameters: [base.groups[0]!.parameters[0]!, { ...base.groups[0]!.parameters[1]!, datatype: 'float' }] }] },
    { ...base, groups: [{ ...base.groups[0]!, parameters: [base.groups[0]!.parameters[0]!, { ...base.groups[0]!.parameters[1]!, ucd: 'em.wl' }] }] },
  ]) assert.throws(() => sodaParameters(changed, { ...request, spectralFrame: 'barycentric' }, { ID: 'ivo://example.org/product' }));
  const eso = { ...base, parameters: [...base.parameters, parameter('accessURL', 'char', '*', null, 'meta.ref.url', 'https://dataportal.eso.org/dataPortal/soda/sync')], groups: [{ ...base.groups[0]!, parameters: [
    { ...base.groups[0]!.parameters[0]!, ucd: 'meta.id;meta.dataset', value: 'ivo://eso.org/ID?ADP.fixture' }, base.groups[0]!.parameters[1]!,
  ] }] };
  assert.ok(sodaParameters(eso, { ...request, spectralFrame: 'barycentric' }, { ID: 'ivo://eso.org/ID?ADP.fixture' }).BAND);
});

test('DataLink descriptors recurse with PyVO-bound parameters, while direct links remain supported', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-access-standards-'));
  try {
    const { snapshot, observation } = await source(), base = snapshot.response;
    const rootLinks = response(base, 'root', [
      { semantics: '#this', service_def: 'one' }, { semantics: '#this', service_def: 'two' }, { semantics: '#this', service_def: 'malformed' },
      { semantics: '#this', access_url: '/direct-links', content_type: 'application/x-votable+xml; content=datalink' },
    ], [descriptor('one', 'ivo://ivoa.net/std/DataLink#links-1.0'), descriptor('two', 'ivo://ivoa.net/std/DataLink#links-1.0'), descriptor('malformed', 'ivo://ivoa.net/std/DataLink#links-1.0')], [
      { row: 0, serviceId: 'one', url: 'https://example.org/descriptor-links', parameters: { ID: 'one' }, error: null },
      { row: 1, serviceId: 'two', url: 'https://example.org/descriptor-links', parameters: { ID: 'two' }, error: null },
      { row: 2, serviceId: 'malformed', url: 'file:///not-a-vo-link', parameters: {}, error: null },
    ]);
    const descriptorOne = response(base, 'descriptor-one', [{ semantics: '#this', access_url: 'one.fits', content_type: 'image/fits' }]);
    const descriptorTwo = response(base, 'descriptor-two', [{ semantics: '#this', access_url: 'two.fits', content_type: 'image/fits' }]);
    const direct = response(base, 'direct', [{ semantics: '#this', access_url: 'direct.fits', content_type: 'image/fits' }]);
    const calls: { url: string; parameters: Readonly<Record<string, Json>> | undefined }[] = [];
    const load: MetadataLoader = async (url, parameters) => {
      calls.push({ url, parameters });
      if (url === 'https://example.org/root-links') return rootLinks;
      if (url === 'https://example.org/descriptor-links') return parameters?.ID === 'one' ? descriptorOne : descriptorTwo;
      if (url === 'https://example.org/direct-links') return direct;
      throw new Error(`Unexpected ${url}`);
    };
    const plan = await planAccess(root, observation, snapshot, request, load);
    assert.deepEqual(calls, [
      { url: 'https://example.org/root-links', parameters: {} }, { url: 'https://example.org/descriptor-links', parameters: { ID: 'one' } },
      { url: 'https://example.org/descriptor-links', parameters: { ID: 'two' } }, { url: 'https://example.org/direct-links', parameters: {} },
    ]);
    assert.deepEqual(plan.products.map(product => product.operation.url), ['https://example.org/one.fits', 'https://example.org/two.fits', 'https://example.org/direct.fits']);
    assert.match(plan.issues.join('\n'), /Unsupported VO access URL/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('DataLink depth and request caps prevent recursion, and a subset never falls back to a direct product', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-access-standards-'));
  try {
    const { snapshot, observation } = await source(), base = snapshot.response;
    const first = response(base, 'first', [{ semantics: '#this', access_url: '/second', content_type: 'application/x-votable+xml; content=datalink' }]);
    const second = response(base, 'second', [{ semantics: '#this', access_url: 'whole.fits', content_type: 'image/fits' }]);
    let calls = 0;
    const load: MetadataLoader = async url => { calls++; return url.endsWith('root-links') ? first : second; };
    const depth = await planAccess(root, observation, snapshot, { ...request, transferLimits: parseLimits({ nestedEdges: 0 }) }, load);
    assert.equal(calls, 1); assert.equal(depth.products.length, 0); assert.match(depth.issues.join('\n'), /nesting bound/u);
    calls = 0;
    const budget = await planAccess(root, observation, snapshot, { ...request, transferLimits: parseLimits({ metadataRequests: 1 }) }, load);
    assert.equal(calls, 1); assert.equal(budget.products.length, 0); assert.match(budget.issues.join('\n'), /request bound/u);
    const subset = await planAccess(root, observation, snapshot, { ...request, region: circle }, async () => second);
    assert.equal(subset.products.length, 0); assert.match(subset.issues.join('\n'), /whole-product access is not an alternative/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
