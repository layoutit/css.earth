/** Build-dependent assertions: a broken answer cannot become an accepted baseline. */
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { matchesPatterns } from './deployment-config.mts';
import { catalogue, requestsForTarget } from './requests.mts';
import { expectation } from './expectations.mts';
import edgeRoute from '../../../netlify/edge-functions/search-route.ts';
import { canonicalHtml, object, readRecording, serialise } from './model.mts';
export const covered = matchesPatterns;
function stringPatterns(value: unknown, fallback: string[]): string[] {
  if (value === undefined) return fallback;
  assert.ok(Array.isArray(value) && value.every(item => typeof item === 'string'), 'Invalid function inclusion patterns');
  return value;
}
export async function check(dir: string, root?: string): Promise<void> {
  const records = await readRecording(dir);
  const index = object(records.get('index.json'));
  assert.ok(Array.isArray(index.catalogue), 'Missing catalogue');
  const target = index.target;
  if (target !== 'preview' && target !== 'netlify' && target !== 'cloudflare') throw new Error('Invalid recorded target');
  if (root) {
    assert.equal(serialise(index.catalogue), serialise(requestsForTarget(await catalogue(resolve(root, 'dist')), target).map(request => ({ ...request, path: canonicalHtml(request.path) }))), 'Recorded catalogue omits or changes a required request');
  }
  const ids = new Set<string>();
  for (const entry of index.catalogue) {
    const request = object(entry);
    assert.equal(typeof request.id, 'string');
    const id = String(request.id); assert.ok(!ids.has(id), `Duplicate ${id}`); ids.add(id);
    const answer = object(records.get(`${id}.json`));
    assert.ok(typeof answer.status === 'number' && answer.status < 500, `${id}: server failure ${String(answer.status)}`);
    const expected = expectation(target, request);
    assert.equal(answer.status, expected.status, `${id}: status`);
    const headers = object(answer.headers), body = object(answer.body);
    assert.equal(typeof headers['content-type'] === 'string' ? headers['content-type'].split(';')[0]?.trim() : null, expected.type, `${id}: content type`);
    if (body.kind === 'html') assert.equal(object(body.outside).equal, true, `${id}: static remainder changed`);
    if (request.html) {
      assert.match(String(headers['content-type']), /text\/html/u, `${id}: HTML type`);
      if (body.kind === 'html') {
        assert.equal(body.titlePresent, true, `${id}: title missing`);
        assert.equal(body.firstView, true, `${id}: first-view markup missing`);
        assert.equal(object(body.outside).equal, true, `${id}: static remainder changed`);
      } else {
        assert.equal(body.kind, 'text');
        assert.ok(typeof body.value === 'string');
        assert.ok(typeof request.title === 'string' && body.value.includes(request.title), `${id}: title missing`);
        assert.match(body.value, /data-startup-discovery|data-prepared-descriptor/u, `${id}: first-view markup missing`);
      }
    }
    if (typeof request.path === 'string') {
      const url = new URL(request.path, 'https://answers.invalid');
      const handled = url.pathname === '/.netlify/functions/search' ? target !== 'preview' : Boolean(edgeRoute(new Request(url)));
      if (handled && answer.status === 200) {
        assert.equal(headers['x-robots-tag'], 'noindex, follow', `${id}: rewritten page missing robots directive`);
        for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified', 'expires']) assert.equal(headers[name], undefined, `${id}: rewritten page kept stale ${name}`);
        if (url.searchParams.has('q') && request.method !== 'HEAD') {
          if (body.kind === 'html') assert.equal(body.searchSubmitted, true, `${id}: submitted-search marker missing`);
          else assert.match(String(body.value), /data-search-submitted/u, `${id}: submitted-search marker missing`);
        }
      }
    }
    if (id.startsWith('find-') && ['GET', 'HEAD'].includes(typeof request.method === 'string' ? request.method : 'GET')) assert.match(String(headers['content-type']), /application\/json/u, `${id}: find type`);
    if (typeof request.path === 'string' && request.path.includes('/.netlify/functions/search') && answer.status === 200) assert.match(String(headers['content-type']), /text\/html/u, `${id}: search type`);
    if (id === 'robots') assert.match(String(headers['content-type']), /text\/plain/u);
    if (id === 'sitemap') assert.match(String(headers['content-type']), /xml/u);
    if (id.endsWith('-first-view')) assert.match(String(headers['content-type']), /json/u);
    if (id === 'find-head' && index.target !== 'preview') assert.equal(body.kind, 'json', 'Direct find HEAD handler body was lost');
    if (id === 'find-valid') {
      assert.match(String(headers['content-type']), /application\/json/u);
      const value = object(body.value), objects = object(value.objects);
      assert.ok(typeof objects.total === 'number' && objects.total > 0, 'europa: no objects');
      assert.ok(Array.isArray(value.features) && value.features.length > 0, 'europa: no features');
    }
    if (id === 'find-second-features') {
      const value = object(body.value);
      assert.ok(Array.isArray(value.features) && value.features.some(feature => object(feature).objectId === 'dione'), 'Dione: no local features');
    }
    if (id === 'find-offset-positive') {
      const value = object(body.value), objects = object(value.objects);
      assert.equal(objects.offset, 2, 'Positive offset ignored');
      assert.ok(Array.isArray(objects.rows) && objects.rows.length > 0, 'Positive offset: no objects');
      assert.deepEqual(value.features, [], 'Offset pages should not repeat feature results');
    }
    if (id === 'find-illustrations') {
      const rows = object(object(body.value).objects).rows;
      assert.ok(Array.isArray(rows) && rows.length > 0, 'Illustration filter: no objects');
      if (root) {
        const source = object(JSON.parse(await readFile(resolve(root, 'dist/catalogue/index.json'), 'utf8')));
        assert.ok(Array.isArray(source.entries));
        const entries = new Map(source.entries.map(entry => [object(entry).id, object(entry)]));
        assert.ok(rows.every(row => entries.has(object(row).id)), 'Illustration-inclusive search returned an unknown object');
        assert.ok(rows.some(row => entries.get(object(row).id)?.illustration === true), 'Illustration-inclusive search omitted illustration objects');
      }
    }
    if (id === 'cloudflare-www') assert.equal(headers.location, 'https://answers.invalid/earth/?q=europa', 'Worker primary-domain redirect');
    if (id === 'static-range') assert.equal(answer.status, 206, 'Static byte range');
    if (id === 'static-range-invalid') assert.equal(answer.status, 416, 'Unsatisfiable range');
    if (id === 'static-etag') assert.equal(answer.status, 304, 'Conditional request');
    if (id === 'prepared-range') assert.equal(answer.status, 200, 'Prepared middleware currently ignores ranges');
    if (id === 'prepared') { assert.equal(answer.status, 200); assert.equal(body.kind, 'json'); }
    if (id === 'missing-page' || id === 'missing-file') assert.equal(answer.status, 404);
  }
  assert.deepEqual([...ids].sort(), Array.isArray(index.requests) ? [...index.requests].sort() : [], 'Catalogue/index mismatch');
  assert.equal(records.size, ids.size + 2, 'Unexpected or missing files');
  const closure = object(records.get('closure.json')), functions = object(closure.functions);
  assert.ok(Array.isArray(closure.included) && closure.included.every(item => typeof item === 'string'));
  const patterns: string[] = [];
  for (const item of closure.included) if (typeof item === 'string') patterns.push(item);
  if (index.target === 'netlify') {
    assert.deepEqual(Object.keys(functions).sort(), ['find', 'report', 'search']);
    for (const name of ['find', 'search']) assert.ok(Array.isArray(functions[name]) && functions[name].length > 0, `${name}: empty trace`);
  }
  for (const [name, files] of Object.entries(functions)) {
    assert.ok(Array.isArray(files));
    for (const file of files) { assert.equal(typeof file, 'string'); assert.ok(covered(String(file), closure.includedByFunction ? stringPatterns(object(closure.includedByFunction)[name], patterns) : patterns), `${name}: unpackaged ${String(file)}`);
      if (root) {
        assert.ok(!String(file).startsWith('/') && !String(file).split('/').includes('..'), `${name}: unsafe closure path`);
        assert.ok((await stat(resolve(root, String(file)))).isFile(), `${name}: missing closure file ${String(file)}`);
      } }
  }
  console.log(`Sane baseline: ${ids.size} ${String(index.target)} answers; closure covered`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { recorded: { type: 'string' } } });
    if (!values.recorded) throw new Error('Usage: check.mts --recorded <dir>');
    await check(values.recorded, process.cwd());
  } catch (error) { console.error(String(error)); process.exitCode = 1; }
}
