/** No-build regression tests for normalisation, complete comparison and baseline rejection. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { canonicalHtml, compactHtml, recordAnswer, serialise, readRecording } from './model.mts';
import { assertNoFallback } from './record.mts';
import { compare, dimensions } from './diff.mts';
import { expectation, expectationTable, targetTables } from './expectations.mts';
import { check, covered } from './check.mts';
import edgeRoute from '../../../deploy/netlify/edge-functions/search-route.ts';
const origin = 'http://127.0.0.1:12345';
test('text bytes stay exact; JSON key order is deterministic; arrays retain order', async () => {
  const html = '<html>\r\n unchanged \t</html>';
  assert.deepEqual((await recordAnswer('text', new Response(html, { headers: { 'content-type': 'text/html' } }), origin)).body, { kind: 'text', value: html });
  const a = await recordAnswer('json', new Response('{"b":2,"a":{"y":1,"x":[2,1]}}', { headers: { 'content-type': 'application/json' } }), origin);
  const b = await recordAnswer('json', new Response('{"a":{"x":[2,1],"y":1},"b":2}', { headers: { 'content-type': 'application/json' } }), origin);
  assert.equal(serialise(a), serialise(b));
});
test('binary records length, prefix and md5; volatile headers omitted and retained headers compared', async () => {
  const response = new Response(new Uint8Array([0, 255, 2]), { headers: { 'content-type': 'application/octet-stream', 'etag': 'time-based', 'content-length': '3', 'date': 'yesterday', 'vary': 'Accept-Encoding', 'access-control-allow-origin': '*', 'location': origin + '/earth/' } });
  const answer = await recordAnswer('binary', response, origin);
  assert.deepEqual(answer.body, { kind: 'binary', length: 3, prefix: '00ff02', md5: '0fe560236813811a4db6d709d121bf6b' });
  assert.equal(answer.headers.date, undefined); assert.equal(answer.headers.etag, 'present:strong');
  assert.equal(answer.headers['content-length'], 'nonzero'); assert.equal(answer.headers.location, 'https://answers.invalid/earth/');
  assert.equal(answer.headers['access-control-allow-origin'], '*'); assert.equal(answer.headers.vary, 'Accept-Encoding');
});
test('every status/header/body/closure difference and missing request is reported', () => {
  const changes = dimensions('answer.json', { status: 200, headers: { type: 'json', cache: 'public' }, body: 'a' }, { status: 400, headers: { type: 'text' }, body: 'b' });
  assert.deepEqual(changes.map(change => change.dimension), ['body', 'headers.cache', 'headers.type', 'status']);
  assert.equal(dimensions('closure.json', { find: ['a'] }, { find: ['b'] })[0]?.dimension, 'find');
  assert.equal(dimensions('gone.json', {}, undefined)[0]?.dimension, 'presence');
});
test('included_files glob matches complete path segments', () => {
  assert.ok(covered('site/public/scenes/earth/earth-places.json', ['site/public/scenes/*/*-places.json']));
  assert.ok(!covered('site/public/scenes/earth/deeper/earth-places.json', ['site/public/scenes/*/*-places.json']));
  assert.ok(!covered('dist/catalogue/index.json', ['dist/catalogue/other.json']));
});
async function fixture(dir: string, status = 200, files: string[] = []) {
  await writeFile(resolve(dir, 'index.json'), serialise({ target: 'preview', requests: ['probe-navigation'], catalogue: [{ id: 'probe-navigation', expected: 200 }] }));
  await writeFile(resolve(dir, 'closure.json'), serialise({ functions: { find: files }, included: ['site/public/*.json'] }));
  await writeFile(resolve(dir, 'probe-navigation.json'), serialise({ id: 'probe-navigation', status, headers: { 'content-type': 'text/html' }, body: { kind: 'text', value: 'ok' } }));
}
test('real directory checker rejects broken baselines, missing records and uncovered closure', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'answers-test-'));
  try {
    await fixture(dir); await check(dir); assert.deepEqual(await compare(dir, dir), []);
    await fixture(dir, 502); await assert.rejects(check(dir), /server failure/u);
    await fixture(dir, 201); await assert.rejects(check(dir), /status/u);
    await fixture(dir, 200, ['private/missing.json']); await assert.rejects(check(dir), /unpackaged/u);
    await rm(resolve(dir, 'probe-navigation.json')); await assert.rejects(readRecording(dir));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('differ CLI exits 0 identical, 1 changed, 2 invalid directory', async () => {
  const base = await mkdtemp(resolve(tmpdir(), 'answers-base-')), head = await mkdtemp(resolve(tmpdir(), 'answers-head-'));
  const run = () => spawnSync(process.execPath, [resolve(import.meta.dirname, 'diff.mts'), '--base', base, '--head', head], { encoding: 'utf8' });
  try {
    await fixture(base); await fixture(head); assert.equal(run().status, 0);
    await fixture(head, 201); assert.equal(run().status, 1);
    await rm(resolve(head, 'index.json')); assert.equal(run().status, 2);
  } finally { await Promise.all([rm(base, { recursive: true, force: true }), rm(head, { recursive: true, force: true })]); }
});
test('Netlify edge entry preserves supported query shapes and passes static assets through', () => {
  for (const query of ['q=europa', 'dataset=normal', 'settings=1&shadows=on', 'feature=1159321043', 'v=damaged', 'q=planets&view=system&category=planet']) {
    const route = edgeRoute(new Request(`https://answers.invalid/earth/?${query}`));
    assert.equal(route?.pathname, '/.netlify/functions/search');
    assert.equal(route?.searchParams.get('object'), 'earth');
    for (const [name, value] of new URLSearchParams(query)) assert.equal(route?.searchParams.get(name), value);
  }
  assert.equal(edgeRoute(new Request('https://answers.invalid/earth/?view=system')), undefined);
  assert.equal(edgeRoute(new Request('https://answers.invalid/objects/earth/object.json?q=x')), undefined);
});

test('only the observed brand commit counter is pinned; other HTML text remains exact', async () => {
  const ask = async (counter: string) => recordAnswer('html', new Response(`<a class="explorer-brand-version" aria-label="GitHub v0.${counter}">v0.${counter}</a><p>v0.42</p>`, { headers: { 'content-type': 'text/html' } }), origin);
  assert.equal(serialise(await ask('6602')), serialise(await ask('6603')));
  assert.ok(serialise(await ask('6602')).includes('<p>v0.42</p>'));
});

test('sanity rejects missing HTML first-view markup, titles, response types and Europa features', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'answers-sanity-'));
  try {
    await fixture(dir);
    const htmlIndex = { target: 'preview', requests: ['probe-navigation'], catalogue: [{ id: 'probe-navigation', expected: 200, html: true, title: 'Earth' }] };
    await writeFile(resolve(dir, 'index.json'), serialise(htmlIndex));
    const html = async (value: string, type = 'text/html') => writeFile(resolve(dir, 'probe-navigation.json'), serialise({ id: 'probe-navigation', status: 200, headers: { 'content-type': type }, body: { kind: 'text', value } }));
    await html('Earth data-prepared-descriptor'); await check(dir);
    await html('Earth'); await assert.rejects(check(dir), /first-view/u);
    await html('data-prepared-descriptor'); await assert.rejects(check(dir), /title/u);
    await html('Earth data-prepared-descriptor', 'text/plain'); await assert.rejects(check(dir), /content type/u);
    await rm(resolve(dir, 'probe-navigation.json'));
    await writeFile(resolve(dir, 'index.json'), serialise({ target: 'preview', requests: ['find-valid'], catalogue: [{ id: 'find-valid', expected: 200 }] }));
    const find = async (features: unknown) => writeFile(resolve(dir, 'find-valid.json'), serialise({ id: 'find-valid', status: 200, headers: { 'content-type': 'application/json' }, body: { kind: 'json', value: { objects: { total: 2 }, features } } }));
    await find([{}]); await check(dir);
    await find(null); await assert.rejects(check(dir), /no features/u);
    await find([]); await assert.rejects(check(dir), /no features/u);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('target tables encode middleware versus direct-handler contracts', () => {
  for (const target of ['netlify', 'cloudflare'] as const) {
    assert.deepEqual(targetTables[target]['find-options'], { status: 405, type: 'text/plain' });
    assert.deepEqual(targetTables[target]['search-get'], { status: 200, type: 'text/html' });
    assert.deepEqual(targetTables[target]['report-post'], { status: 204, type: null });
  }
  assert.deepEqual(targetTables.preview['find-options'], { status: 204, type: null });
  for (const id of ['search-get', 'search-post', 'report-post']) assert.deepEqual(targetTables.preview[id], { status: 404, type: null });
  assert.deepEqual(targetTables.preview['static-range'], { status: 206, type: 'text/javascript' });
  assert.deepEqual(targetTables.preview['static-range-invalid'], { status: 416, type: null });
  assert.deepEqual(targetTables.preview['static-etag'], { status: 304, type: null });
  assert.deepEqual(targetTables.preview['static-modified'], { status: 200, type: 'text/javascript' });
  assert.deepEqual(targetTables.preview['prepared-range'], { status: 200, type: 'application/json' });
  assert.equal(targetTables.preview.sitemap?.type, 'text/xml');
  assert.equal(targetTables.cloudflare.sitemap?.type, 'application/xml');
  assert.deepEqual(expectationTable('preview', [{ id: 'earth-plain', path: '/earth/', html: true }, { id: 'earth-first-view', path: '/objects/earth/first-view.json' }]), { 'earth-plain': { status: 200, type: 'text/html' }, 'earth-first-view': { status: 200, type: 'application/json' } });
  assert.throws(() => expectation('preview', { id: 'unknown' }), /No preview expectation/u);
});

test('a single changed byte beyond 64 KiB remains visible in full HTML', async () => {
  const before = 'x'.repeat(70 * 1024) + 'a';
  const after = before.slice(0, -1) + 'b';
  const answer = async (text: string) => recordAnswer('large-html', new Response(text, { headers: { 'content-type': 'text/html' } }), origin);
  const changes = dimensions('large-html.json', await answer(before), await answer(after));
  assert.deepEqual(changes.map(change => change.dimension), ['body.value']);
});

test('compact HTML catches a static byte flip and handler-only rewrite while ignoring bundle hashes', () => {
  const base = '<title>Earth</title>' + 'x'.repeat(70 * 1024) + '<!--search-shell:start-->old<!--search-shell:end--><!--prepared-scene:start-->scene<!--prepared-scene:end--><script src="/_astro/ObjectLayout.abc123.js"></script>';
  const record = (actual: string, page = base) => compactHtml(actual, page, 'earth/index.html');
  const unchanged = record(base);
  assert.equal(serialise(unchanged), serialise(record(base.replace('abc123', 'def456'), base.replace('abc123', 'def456'))));
  const staticFlip = base.replace('<title>Earth', '<title>earth');
  assert.ok(dimensions('answer.json', unchanged, record(staticFlip, staticFlip)).some(item => item.dimension === 'static.md5'));
  const rewrite = base.replace('start-->old', 'start-->new');
  assert.ok(dimensions('answer.json', unchanged, record(rewrite)).some(item => item.dimension.includes('regions.search-shell')));
  assert.equal(serialise(unchanged).length < 1500, true);
  assert.equal(JSON.parse(serialise(record(base.replace('<title>', '<title class="changed">')))).outside.equal, false);
});
test('version normalization crosses commit 10000 and unknown headers stay visible', async () => {
  const link = (version: string) => `<a class="explorer-brand-version" aria-label="GitHub ${version}">${version}</a>`;
  assert.equal(canonicalHtml(link('v0.9999')), canonicalHtml(link('v1.0')));
  const strong = await recordAnswer('probe', new Response('a', { headers: { etag: '"one"', 'x-new-header': 'yes', 'content-security-policy': "default-src 'none'", 'set-cookie': 'a=b', 'x-content-type-options': 'nosniff' } }), origin);
  const weak = await recordAnswer('probe', new Response('a', { headers: { etag: 'W/"two"' } }), origin);
  assert.equal(strong.headers['x-new-header'], 'yes'); assert.equal(strong.headers['set-cookie'], 'a=b');
  assert.equal(strong.headers.etag, 'present:strong'); assert.equal(weak.headers.etag, 'present:weak');
});

test('fallback diagnostic can never pass the recorder guard', () => {
  assertNoFallback('client-error ordinary report');
  assert.throws(() => assertNoFallback('page-handler-fallback {"reason":"timeout"}'), /fallback rejected/u);
});

test('source-link commit normalization covers bodies and headers but preserves paths and unrelated hex', async () => {
  const commitA = 'a'.repeat(40), commitB = 'b'.repeat(40);
  const link = (commit: string, path = 'src/objects/earth/README.md') => `https://github.com/layoutit/cssEarth/blob/${commit}/${path}`;
  for (const type of ['text/html', 'text/plain', 'application/json']) {
    const ask = (commit: string, path?: string) => recordAnswer('source', new Response(type.includes('json') ? JSON.stringify({ objects: { rows: [{ source: { document: link(commit, path) } }] } }) : `<a href="${link(commit, path)}">source</a>`, { headers: { 'content-type': type, 'x-source': link(commit, path) } }), origin);
    assert.equal(serialise(await ask(commitA)), serialise(await ask(commitB)));
    assert.notEqual(serialise(await ask(commitA)), serialise(await ask(commitB, 'src/objects/mars/README.md')));
  }
  const untouched = `${commitA} https://github.com/other/cssEarth/blob/${commitA}/x https://github.com/layoutit/cssEarth/blob/${'A'.repeat(40)}/x`;
  const answer = await recordAnswer('source', new Response(untouched, { headers: { 'content-type': 'text/plain' } }), origin);
  assert.deepEqual(answer.body, { kind: 'text', value: untouched });
});

test('source-link normalization precedes static and remainder lengths and md5 and rewritten region storage', () => {
  const link = (commit: string) => `https://github.com/layoutit/cssEarth/blob/${commit}/src/objects/earth/README.md`;
  const html = (commit: string, region = 'static') => `<a data-source-document="${link(commit)}">source</a><!--search-shell:start-->${region} ${link(commit)}<!--search-shell:end-->`;
  const before = html('a'.repeat(40)), after = html('b'.repeat(40));
  assert.equal(canonicalHtml(before).length, before.length);
  assert.equal(serialise(compactHtml(before, before, 'earth/index.html')), serialise(compactHtml(after, after, 'earth/index.html')));
  assert.equal(serialise(compactHtml(after, before, 'earth/index.html')), serialise(compactHtml(before, before, 'earth/index.html')));
  const recorded = JSON.parse(serialise(compactHtml(before, before, 'earth/index.html')));
  assert.equal(recorded.static.length, Buffer.byteLength(canonicalHtml(before)));
  assert.equal(serialise(compactHtml(html('a'.repeat(40), 'rewritten'), before, 'earth/index.html')), serialise(compactHtml(html('b'.repeat(40), 'rewritten'), after, 'earth/index.html')));
  assert.notEqual(serialise(compactHtml(before, before, 'earth/index.html')), serialise(compactHtml(before.replace('/earth/', '/mars/'), before.replace('/earth/', '/mars/'), 'earth/index.html')));
});
