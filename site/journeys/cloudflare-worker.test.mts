import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../../deploy/cloudflare/worker.ts';
import { readAssetJson, siteFetcher, useAssets, type Assets } from '../../deploy/cloudflare/assets.ts';
import { readBuiltCatalogue, readPublicFile } from '../../deploy/cloudflare/search-data.ts';
import { answerOrFallback } from '../../deploy/cloudflare/fallback.ts';

// The Worker's own parts: its routing of what needs no handler, and the modules that stand in for a disk. The handlers
// it calls are Netlify's, with their own tests (search-response.test.mts, search-api.test.mts); the bundle step answers a
// search and a page from the bundled script (deploy/cloudflare/bundle-worker.mts).
const built = (files: Readonly<Record<string, unknown>>): Assets & { readonly asked: string[] } => {
  const asked: string[] = [];
  return { asked, async fetch(input, init) {
    const { pathname, search } = new URL(new Request(input, init).url);
    asked.push(pathname + search);
    return Object.hasOwn(files, pathname) ? Response.json(files[pathname]) : new Response(null, { status: 404 });
  } };
};
const context = { waitUntil() {} };

test('an address with no query is answered by the built site, untouched', async () => {
  const assets = built({ '/earth/': { page: 'earth' } });
  const answer = await worker.fetch(new Request('https://css.test/earth/'), { ASSETS: assets }, context);
  assert.deepEqual(await answer.json(), { page: 'earth' });
  const missing = await worker.fetch(new Request('https://css.test/objects/none.json?x=1'), { ASSETS: assets }, context);
  assert.equal(missing.status, 404);
  assert.deepEqual(assets.asked, ['/earth/', '/objects/none.json?x=1']);
});

test('a page report is logged and answered with no content', async t => {
  const logged = t.mock.method(console, 'error', () => {});
  const assets = built({});
  const post = await worker.fetch(new Request('https://css.test/.netlify/functions/report', { method: 'POST', body: 'x'.repeat(4000),
    headers: { 'user-agent': 'test agent' } }), { ASSETS: assets }, context);
  assert.equal(post.status, 204);
  const line = String(logged.mock.calls[0]?.arguments[0]);
  assert.match(line, /^client-error \{"agent":"test agent","report":"x{2500}"\}$/u);
  assert.equal((await worker.fetch(new Request('https://css.test/.netlify/functions/report'), { ASSETS: assets }, context)).status, 405);
  assert.deepEqual(assets.asked, []);
});

test('a Worker deployed without its assets binding says which setting names it', async () => {
  await assert.rejects(worker.fetch(new Request('https://css.test/earth/'), {}, context), /no ASSETS binding; deploy\/cloudflare\/wrangler\.jsonc `assets\.binding`/u);
});

test('the search data is read from the built site by its site path', async () => {
  const assets = useAssets(built({ '/features/index.json': { schema: 'index' } }));
  assert.deepEqual(await readPublicFile('/features/index.json'), { schema: 'index' });
  await assert.rejects(readPublicFile('/features/../secret.json'), /path is invalid/u);
  await assert.rejects(readPublicFile('https://elsewhere.test/a.json'), /path is invalid/u);
  // A file the bundle step did not stage is named, with the step that stages it.
  await assert.rejects(readAssetJson('/scenes/earth/earth-places.json'), /hold no \/scenes\/earth\/earth-places\.json \(HTTP 404\); deploy\/cloudflare\/bundle-worker\.mts/u);
  // A catalogue that could not be read is asked for again, not kept as a failure.
  await assert.rejects(readBuiltCatalogue(), /hold no \/catalogue\/index\.json/u);
  await assert.rejects(readBuiltCatalogue(), /hold no \/catalogue\/index\.json/u);
  assert.equal((assets as ReturnType<typeof built>).asked.filter(path => path === '/catalogue/index.json').length, 2);
});

test('a project file the bundle does not carry is named', async () => {
  Object.assign(globalThis, { CSSEARTH_PROJECT_FILES: { 'src/objects/observable-universe/prepared/world.json': '{"schema":"world"}' } });
  const { readProjectJson, nodeProjectFileUrl } = await import('../../deploy/cloudflare/project-files.ts');
  assert.deepEqual(await readProjectJson('file:///anywhere', 'src/objects/observable-universe/prepared/world.json'), { schema: 'world' });
  await assert.rejects(readProjectJson('file:///anywhere', 'src/objects/earth/prepared/members.json'), /holds no src\/objects\/earth\/prepared\/members\.json; FUNCTION_PROJECT_FILES \(deploy\/handlers\/function-project-files\.mts\)/u);
  await assert.rejects(readProjectJson('file:///anywhere', 'toString'), /holds no toString/u);
  assert.throws(() => nodeProjectFileUrl('file:///anywhere', 'src/objects/earth/prepared/members.json'), /no project directory/u);
});

test('a page whose handler fails or is late is answered with the static page, and the reason is reported', async () => {
  const fallback = async () => new Response('static page');
  const reasons: string[] = [];
  const report = (reason: string) => { reasons.push(reason); };
  // In time: the rendered page, and nothing to report.
  assert.equal(await (await answerOrFallback(Promise.resolve(new Response('rendered')), fallback, 50, report)).text(), 'rendered');
  // Failed.
  assert.equal(await (await answerOrFallback(Promise.reject(new TypeError('Prepared search shell is missing.')), fallback, 50, report)).text(), 'static page');
  // Never settles: the request that was loading the world for this instance was stopped.
  assert.equal(await (await answerOrFallback(new Promise<Response>(() => {}), fallback, 20, report)).text(), 'static page');
  assert.deepEqual(reasons, ['TypeError: Prepared search shell is missing.', 'no answer in 20 ms']);
});

test('the page handler reads this site from the assets and other origins from the network, refusing redirects', async () => {
  const assets: Assets = { async fetch(input, init) {
    const wanted = new Request(input, init);
    // The Workers runtime has no `redirect: 'error'`; the assets must never be asked with it.
    assert.notEqual(wanted.redirect, 'error');
    const { pathname } = new URL(wanted.url);
    return pathname === '/moved/' ? new Response(null, { status: 307, headers: { location: '/earth/' } }) : new Response(`asset ${pathname}`);
  } };
  const outside: typeof fetch = async input => new Response(`network ${new Request(input).url}`);
  const read = siteFetcher('https://css.test', assets, outside);
  assert.equal(await (await read(new URL('https://css.test/earth/'), { redirect: 'error' })).text(), 'asset /earth/');
  assert.equal(await (await read('https://assets.test/runtime-assets/a/b.json')).text(), 'network https://assets.test/runtime-assets/a/b.json');
  await assert.rejects(read(new URL('https://css.test/moved/'), { redirect: 'error' }), /https:\/\/css\.test\/moved\/ answered with a redirect \(HTTP 307\), which the request refuses/u);
  // A request that follows redirects is handed on as it is.
  assert.equal((await read(new URL('https://css.test/moved/'))).status, 307);
});

test('the www address moves to the site\'s one address, keeping the path and query', async () => {
  const assets = built({});
  const answer = await worker.fetch(new Request('https://www.css.test/saturn/?q=titan'), { ASSETS: assets }, context);
  assert.equal(answer.status, 301);
  assert.equal(answer.headers.get('location'), 'https://css.test/saturn/?q=titan');
  assert.deepEqual(assets.asked, []);
});
