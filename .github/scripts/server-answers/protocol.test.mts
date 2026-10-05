/** Check protocol expectations against their actual route, find handler and Worker fallback owners. */
import assert from 'node:assert/strict';
import test from 'node:test';
import handleFindRequest from '../../../netlify/functions/find.ts';
import handleSearchRequest from '../../../netlify/functions/search.ts';
import edgeRoute from '../../../netlify/edge-functions/search-route.ts';
import worker from '../../../cloudflare/worker.ts';
import { expectation } from './expectations.mts';

test('fixed find expectation statuses and types come from the real handler, through deployed Netlify entrypoints', async () => {
  const cases = [
    ['missing', ''], ['invalid', 'object=../earth&q=x'], ['offset', 'object=earth&q=x&offset=-1'], ['place', 'object=earth&place=invalid'], ['both', 'object=earth&q=x&place=1'],
  ];
  for (const [shape, query] of cases) {
    const response = await handleFindRequest(new Request('https://answers.invalid/.netlify/functions/find?' + query));
    const expected = expectation('netlify', { id: `find-${shape}` });
    assert.equal(response.status, expected.status, shape);
    assert.equal(response.headers.get('content-type')?.split(';')[0], expected.type, shape);
  }
  for (const method of ['OPTIONS', 'POST']) {
    const response = await handleFindRequest(new Request('https://answers.invalid/.netlify/functions/find?object=earth&q=europa', { method }));
    assert.equal(response.status, expectation('netlify', { id: `find-${method.toLowerCase()}` }).status);
  }
});

test('search unknown object and method expectations agree with actual handler branches', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(null, { status: 404 });
  let missing: Response;
  try { missing = await handleSearchRequest(new Request('https://answers.invalid/.netlify/functions/search?object=no-such-object')); }
  finally { globalThis.fetch = original; }
  assert.equal(missing.status, expectation('netlify', { id: 'search-unknown-object' }).status);
  assert.equal(missing.headers.get('content-type'), expectation('netlify', { id: 'search-unknown-object' }).type);
  const denied = await handleSearchRequest(new Request('https://answers.invalid/.netlify/functions/search?object=earth&q=europa', { method: 'POST' }));
  assert.equal(denied.status, expectation('netlify', { id: 'earth-query-post' }).status);
  assert.equal(denied.headers.get('content-type')?.split(';')[0], expectation('netlify', { id: 'earth-query-post' }).type);
});

test('real Netlify edge entry routes query pages without slash and keeps method-independent query semantics', () => {
  for (const method of ['GET', 'HEAD', 'POST']) {
    const route = edgeRoute(new Request('https://answers.invalid/earth?q=europa&view=system', { method }));
    assert.equal(route?.pathname, '/.netlify/functions/search');
    assert.equal(route?.searchParams.get('object'), 'earth');
    assert.equal(route?.searchParams.get('q'), 'europa');
  }
  for (const query of ['', '?view=body', '?browse=planets']) assert.equal(edgeRoute(new Request('https://answers.invalid/earth/' + query)), undefined);
});

test('real Worker redirects www and explicitly reports its static fallback after a handler failure', async context => {
  const messages: string[] = [];
  context.mock.method(console, 'error', (message: unknown) => messages.push(String(message)));
  const pending: Promise<unknown>[] = [];
  let calls = 0;
  const assets = { fetch: async () => { calls++; return new Response('<html>Broken prepared shell</html>', { headers: { 'content-type': 'text/html' } }); } };
  const env = { ASSETS: assets }, runtime = { waitUntil: (work: Promise<unknown>) => { pending.push(work); } };
  const redirect = await worker.fetch(new Request('https://www.answers.invalid/earth/?q=europa'), env, runtime);
  assert.equal(redirect.status, expectation('cloudflare', { id: 'cloudflare-www' }).status);
  assert.equal(redirect.headers.get('location'), 'https://answers.invalid/earth/?q=europa');
  assert.equal(calls, 0);
  const fallback = await worker.fetch(new Request('https://answers.invalid/earth/?q=europa'), env, runtime);
  await Promise.all(pending);
  assert.equal(fallback.status, 200);
  assert.equal(await fallback.text(), '<html>Broken prepared shell</html>');
  assert.ok(calls >= 2, 'Handler fetch and fallback must both run');
  assert.ok(messages.some(message => message.startsWith('page-handler-fallback ') && message.includes('Prepared search shell is missing')), 'Worker failure must be visible in the diagnostic log');
});

// Minimal native-search shell follows the real handler fixture; no built page is required.
test('real rewritten page removes every static validator and transport header', async () => {
  const page = '<!doctype html><html><body><!--search-shell:start-->' +
    '<form class="object-sidebar-search-card" data-search-object="earth"><input class="object-sidebar-search" name="q"></form>' +
    '<input class="object-sheet-handle" type="checkbox"><div class="object-drawer-content">' +
    '<nav class="object-browser"><div id="object-category-results"><ul data-catalogue-list></ul><p data-search-empty></p></div></nav>' +
    '<div class="object-selected-content"><section class="object-information-panel"></section></div></div>' +
    '<!--search-shell:end--></body></html>';
  const headers = { 'content-type': 'text/html', 'content-length': String(page.length), 'content-encoding': 'gzip', etag: '"static"', 'last-modified': 'Tue, 01 Jan 2000 00:00:00 GMT', expires: 'Tue, 01 Jan 2000 00:00:00 GMT' };
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(page, { headers });
  let response: Response;
  try { response = await handleSearchRequest(new Request('https://answers.invalid/.netlify/functions/search?object=earth&q=europa')); }
  finally { globalThis.fetch = original; }
  assert.equal(response.status, 200);
  for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified', 'expires']) assert.equal(response.headers.get(name), null, name);
});
