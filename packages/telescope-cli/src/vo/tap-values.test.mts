/** What `tap-query` returns for values a JSON reader cannot hold as the archive states them, and that it can run a query as an
 * archive job. A local server plays the TAP service, so no archive is asked. */
import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { createServer } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { astroquery, astroqueryToolchain, astroqueryRows } from '@cssearth/telescope/node';
test.before(async () => { await astroqueryToolchain(); });

// Gaia DR3 3404512999496164736 as GAVO serves it: the identifier is above 2**53 and pmra is a 32-bit column.
const VOTABLE = `<?xml version="1.0"?><VOTABLE version="1.3" xmlns="http://www.ivoa.net/xml/VOTable/v1.3"><RESOURCE type="results"><INFO name="QUERY_STATUS" value="OK"/>
<TABLE><FIELD name="source_id" datatype="long"/><FIELD name="pmra" datatype="float"/><FIELD name="ra" datatype="double"/>
<DATA><TABLEDATA><TR><TD>3404512999496164736</TD><TD>1.06506</TD><TD>83.4555209394563</TD></TR></TABLEDATA></DATA></TABLE></RESOURCE></VOTABLE>`;
const ROWS = [{ source_id: '3404512999496164736', pmra: 1.06506, ra: 83.4555209394563 }];

test('a 32-bit value and an integer above 2**53 arrive as the archive states them, from a direct query and from a job', async () => {
  const asked: string[] = [];
  let origin = '', phase = 'PENDING';
  const job = () => `<?xml version="1.0"?><uws:job xmlns:uws="http://www.ivoa.net/xml/UWS/v1.0" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1">
<uws:jobId>1</uws:jobId><uws:phase>${phase}</uws:phase><uws:results><uws:result id="result" xlink:type="simple" xlink:href="${origin}/tap/async/1/results/result"/></uws:results></uws:job>`;
  const server = createServer((request, response) => {
    const path = new URL(request.url!, origin).pathname, route = `${request.method} ${path}`;
    asked.push(route);
    const send = (type: string, body: string) => { response.writeHead(200, { 'Content-Type': type }); response.end(body); };
    const redirect = () => { response.writeHead(303, { Location: `${origin}/tap/async/1` }); response.end(); };
    request.resume().on('end', () => {
      if (route === 'POST /tap/sync' || route === 'GET /tap/async/1/results/result') send('application/x-votable+xml', VOTABLE);
      else if (route === 'POST /tap/async') redirect();
      else if (route === 'POST /tap/async/1/phase') { phase = 'COMPLETED'; redirect(); }
      else if (route === 'GET /tap/async/1') send('text/xml', job());
      else if (route === 'DELETE /tap/async/1' || route === 'POST /tap/async/1') send('text/plain', '');
      else { response.writeHead(404); response.end(); }
    });
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No HTTP port.');
  origin = `http://127.0.0.1:${address.port}`;
  try {
    const request = { operation: 'tap-query' as const, service: `${origin}/tap`, query: 'SELECT source_id, pmra, ra FROM gaia.dr3lite', allowedPrivateHosts: ['127.0.0.1'] };
    assert.deepEqual(await astroqueryRows(request), ROWS);
    assert.deepEqual(asked, ['POST /tap/sync']);
    assert.deepEqual(await astroqueryRows({ ...request, mode: 'async' }), ROWS);
    assert.ok(asked.includes('POST /tap/async') && asked.includes('POST /tap/async/1/phase') && asked.includes('GET /tap/async/1/results/result'), asked.join(', '));
  } finally { await new Promise(done => server.close(done)); }
});

test('the observation search states a 32-bit value as the archive holds it too', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'tap-values-'));
  try {
    await writeFile(resolve(directory, 'answer.xml'), VOTABLE);
    const vo = (await astroquery({ operation: 'vo-parse', file: resolve(directory, 'answer.xml'), url: 'https://example.org/tap', byteLimit: 1e6 })).vo!;
    assert.equal(vo.rows[0]!.pmra, 1.06506);
    assert.equal(vo.rows[0]!.ra, 83.4555209394563);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('an archive that drops the connection is asked again', async () => {
  let asked = 0;
  const server = createServer((request, response) => {
    asked++;
    request.resume().on('end', () => {
      if (asked === 1) { request.socket.destroy(); return; }
      response.writeHead(200, { 'Content-Type': 'application/x-votable+xml' }); response.end(VOTABLE);
    });
  });
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No HTTP port.');
  try {
    assert.deepEqual(await astroqueryRows({ operation: 'tap-query', service: `http://127.0.0.1:${address.port}/tap`, query: 'SELECT 1', allowedPrivateHosts: ['127.0.0.1'] }), ROWS);
    assert.equal(asked, 2);
  } finally { await new Promise(done => server.close(done)); }
});
