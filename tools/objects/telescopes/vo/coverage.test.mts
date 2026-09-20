import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { astroquery } from '../../astronomy-packages/client.mts';
import { jsonValue, type DiscoverySnapshot, type MetadataResponse } from './contracts.mts';
import { loadVoInputs } from './bridge.mts';
import { SERVICES } from './discovery.mts';
import { sodaParameters } from './access.mts';

const fixtures = resolve(import.meta.dirname, '../../../../tests/fixtures/telescope-vo');
const request = { target: 'betelgeuse', wavelengthMicrometres: [0.78, 0.85] as const, kind: 'image' as const, result: 'telescope-product' as const,
  time: { any: true } as const, angularResolutionArcsec: 1 };
const catalogue = [{ id: request.target, name: 'Betelgeuse', aliases: [], archiveClass: 'star', classificationSource: 'fixture' }];

async function metadata(file: string, url: string): Promise<MetadataResponse> {
  return (await astroquery({ operation: 'vo-parse', file: resolve(fixtures, file), url, byteLimit: 1e6, timeFormat: 'mjd', timeScale: 'utc' })).vo!;
}
function snapshot(profile: typeof SERVICES[number], response: MetadataResponse, completeness: DiscoverySnapshot['completeness']): DiscoverySnapshot {
  return { schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model, request: jsonValue(request),
    query: 'fixture', scope: 'exact bounded fixture scope', sampleLimit: 1, response, completeness };
}

test('independent discovery outcomes retain empty, overflow-unsupported, and failed service states', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-coverage-'));
  try {
    const eso = await metadata('eso-obscore.xml', SERVICES[0]!.service), alma = await metadata('alma-obscore.xml', SERVICES[1]!.service);
    const empty = snapshot(SERVICES[0]!, { ...eso, rows: [], times: [] }, 'bounded-sample');
    const unsupported = snapshot(SERVICES[1]!, { ...alma, queryStatus: 'OVERFLOW', rows: [{ ...alma.rows[0]!, dataproduct_type: 'spectrum' }], times: [alma.times[0]!] }, 'overflow');
    const inputs = await loadVoInputs(root, request, catalogue, undefined, async (_root, profile) => {
      if (profile === SERVICES[0]) return empty;
      if (profile === SERVICES[1]) return unsupported;
      throw new Error('fixture service unavailable');
    });
    assert.deepEqual(inputs.services.map(service => service.state), ['empty-in-scope', 'overflow', 'unavailable']);
    assert.equal(inputs.records.length, 1); assert.equal(inputs.records[0]!.products.length, 0);
    assert.match(inputs.records[0]!.issues.join('\n'), /No native decoder/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('PyVO binds a ref-derived SODA ID from the selected DataLink row', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-ref-id-')), file = resolve(root, 'links.xml');
  const xml = `<?xml version="1.0"?><VOTABLE version="1.3" xmlns="http://www.ivoa.net/xml/VOTable/v1.3"><RESOURCE type="results"><TABLE>
    <FIELD ID="ID" name="ID" datatype="char" arraysize="*" ucd="meta.id;meta.main"/><FIELD ID="service_def" name="service_def" datatype="char" arraysize="*"/><FIELD ID="semantics" name="semantics" datatype="char" arraysize="*"/>
    <DATA><TABLEDATA><TR><TD>ivo://fixture/parent-1</TD><TD>fixture-soda</TD><TD>#cutout</TD></TR></TABLEDATA></DATA></TABLE><INFO name="QUERY_STATUS" value="OK"/></RESOURCE>
    <RESOURCE ID="fixture-soda" type="meta" utype="adhoc:service"><PARAM name="accessURL" datatype="char" arraysize="*" value="https://example.org/soda"/><PARAM name="standardID" datatype="char" arraysize="*" value="ivo://ivoa.net/std/SODA#sync-1.0"/><GROUP name="inputParams"><PARAM name="ID" datatype="char" arraysize="*" ucd="meta.ref.url;meta.curation" ref="ID"/><PARAM name="CIRCLE" datatype="double" arraysize="3" unit="deg" ucd="pos.outline;obs" xtype="circle" value="0 0 0"/></GROUP></RESOURCE></VOTABLE>`;
  try {
    await writeFile(file, xml);
    const response = (await astroquery({ operation: 'vo-parse', file, url: 'https://example.org/links', byteLimit: 100_000 })).vo!;
    const descriptor = response.resources.find(resource => resource.id === 'fixture-soda')!, binding = response.bindings[0]!;
    assert.equal(binding.error, null); assert.equal(binding.parameters.ID, 'ivo://fixture/parent-1');
    assert.equal(sodaParameters(descriptor, { ...request, region: { frame: 'icrs', shape: 'circle', raDegrees: 1, decDegrees: 2, radiusDegrees: 0.1 } }, binding.parameters).ID, 'ivo://fixture/parent-1');
  } finally { await rm(root, { recursive: true, force: true }); }
});
