import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { astroquery } from '@cssearth/telescope/node';
// VO acquisition keeps the digests it computes for its own untracked responses (PR #531), so its pins are checked by hash.
import { sha256File } from '@cssearth/core/node';
import { loadVoInputs } from './bridge.mts';
import { SERVICES } from './discovery.mts';
import { jsonValue, type DiscoverySnapshot } from '@cssearth/telescope/node';

test('PyVO sends descriptor-bound DataLink parameters and retains the exact response', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'vo-links-boundary-'));
  const xml = await readFile(resolve(import.meta.dirname, '../../../../tests/fixtures/telescope-vo/eso-links.xml'));
  const requests: URL[] = [];
  const server = createServer((request, response) => {
    requests.push(new URL(request.url!, 'http://localhost'));
    response.writeHead(200, { 'Content-Type': 'application/x-votable+xml;content=datalink' });
    response.end(xml);
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No HTTP port.');
  try {
    const url = `http://127.0.0.1:${address.port}/links`;
    const parameters = { ID: 'ivo://fixture/a+b&member=1', RESPONSEFORMAT: 'application/x-votable+xml;content=datalink' };
    const answer = (await astroquery({ operation: 'vo-links', url, parameters, directory, byteLimit: 1_000_000, allowedPrivateHosts: ['127.0.0.1'] })).vo!;
    assert.equal(requests.length, 1);
    assert.equal(requests[0]!.searchParams.get('ID'), parameters.ID);
    assert.equal(requests[0]!.searchParams.get('RESPONSEFORMAT'), parameters.RESPONSEFORMAT);
    assert.equal(new URL(answer.effectiveUrl).searchParams.get('ID'), parameters.ID);
    assert.equal(answer.queryStatus, 'OK');
    assert.ok(answer.bindings.some(binding => binding.url?.includes('/soda/sync')));
    assert.deepEqual(await readFile(answer.raw.path), xml);
    assert.deepEqual(await sha256File(answer.raw.path), { bytes: answer.raw.bytes, sha256: answer.raw.sha256 });
  } finally {
    server.closeAllConnections();
    await new Promise<void>(done => server.close(() => done()));
    await rm(directory, { recursive: true, force: true });
  }
});

test('public VO query follows a descriptor-bound nested DataLink service', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'vo-public-links-'));
  const seen: URL[] = [];
  // DataLink 1.0 service descriptor: input ID references the selected table row.
  const document = (nested: boolean) => `<VOTABLE version="1.3" xmlns="http://www.ivoa.net/xml/VOTable/v1.3"><RESOURCE type="results"><INFO name="QUERY_STATUS" value="OK"/><TABLE>
    <FIELD name="ID" ID="dataset" datatype="char" arraysize="*"/><FIELD name="access_url" datatype="char" arraysize="*"/><FIELD name="service_def" datatype="char" arraysize="*"/><FIELD name="semantics" datatype="char" arraysize="*"/><FIELD name="content_type" datatype="char" arraysize="*"/>
    <DATA><TABLEDATA><TR><TD>ivo://fixture/member+1</TD><TD>${nested ? '' : '/science.fits'}</TD><TD>${nested ? 'nested' : ''}</TD><TD>#this</TD><TD>${nested ? '' : 'image/fits'}</TD></TR></TABLEDATA></DATA></TABLE></RESOURCE>
    ${nested ? '<RESOURCE ID="nested" type="meta" utype="adhoc:service"><PARAM name="standardID" datatype="char" arraysize="*" value="ivo://ivoa.net/std/DataLink#links-1.0"/><PARAM name="accessURL" datatype="char" arraysize="*" value="/nested"/><GROUP name="inputParams"><PARAM name="ID" datatype="char" arraysize="*" ref="dataset"/></GROUP></RESOURCE>' : ''}</VOTABLE>`;
  const server = createServer((request, response) => {
    const url = new URL(request.url!, 'http://localhost'); seen.push(url);
    response.writeHead(200, { 'Content-Type': 'application/x-votable+xml;content=datalink' });
    response.end(document(url.pathname === '/root'));
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No HTTP port.');
  try {
    const service = `http://127.0.0.1:${address.port}`;
    const response = (await astroquery({ operation: 'vo-parse', file: resolve(import.meta.dirname, '../../../../tests/fixtures/telescope-vo/eso-obscore.xml'),
      url: service, byteLimit: 1_000_000, timeFormat: 'mjd', timeScale: 'utc' })).vo!;
    const request = { target: 'betelgeuse', wavelengthMicrometres: [0.78, 0.85] as const, kind: 'image' as const,
      result: 'telescope-product' as const, time: { any: true } as const, angularResolutionArcsec: 1 };
    const inputs = await loadVoInputs(directory, request,
      [{ id: 'betelgeuse', name: 'Betelgeuse', aliases: [], archiveClass: 'star', classificationSource: 'fixture' }], undefined,
      async (_root, profile): Promise<DiscoverySnapshot> => ({ schema: 'cssearth-vo-discovery@1', service: profile.service, table: profile.table, model: profile.model,
        request: jsonValue(request), query: 'fixture', scope: 'synthetic descriptor traversal', sampleLimit: 1, completeness: 'bounded-sample',
        response: { ...response, rows: profile === SERVICES[0] ? [{ ...response.rows[0]!, target_name: 'Betelgeuse', dataproduct_type: 'image',
          access_url: `${service}/root`, access_format: 'application/x-votable+xml;content=datalink' }] : [], times: profile === SERVICES[0] ? response.times : [] } }),
      { allowedPrivateHosts: ['127.0.0.1'] }, undefined, async () => ({ names: [], complete: true, evidence: 'fixture', issues: [] }));
    assert.equal(seen.length, 2);
    assert.equal(seen[1]!.pathname, '/nested');
    assert.equal(seen[1]!.searchParams.get('ID'), 'ivo://fixture/member+1');
    assert.equal(inputs.records.length, 1);
    assert.deepEqual(inputs.records[0]!.issues, []);
    const products = inputs.records[0]!.products;
    assert.equal(products.length, 1);
    assert.equal(products[0]!.operation.url, `${service}/science.fits`);
    assert.equal(products[0]!.metadata.length, 4); // Discovery bytes, snapshot, and both DataLink responses.
    for (const pin of products[0]!.metadata) assert.deepEqual(await sha256File(pin.path), { bytes: pin.bytes, sha256: pin.sha256 });
  } finally {
    server.closeAllConnections();
    await new Promise<void>(done => server.close(() => done()));
    await rm(directory, { recursive: true, force: true });
  }
});
