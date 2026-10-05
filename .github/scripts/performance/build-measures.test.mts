/** Synthetic emitted sites exercise measurements, metadata cross-checks and every one-way comparison rule. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { parseEnvironment } from '../build-compare/records.mts';
import { measure, sortedJson, imports, startup, startupDeclarations, parseMeasures, localFile } from './build-measures.mts';
import { compare, subsequence, summary, failureCounts } from './compare-measures.mts';
import { representativeRoutes } from './measure.mts';
import type { Measures } from './build-measures.mts';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'counted-build-'));
  const dist = join(root, 'dist'), metadata = join(root, 'metadata');
  await mkdir(join(dist, '_astro'), { recursive: true }); await mkdir(join(dist, 'objects/a'), { recursive: true }); await mkdir(metadata);
  const code = new Map([
    ['entry', 'import "./shared.js"; export { x } from "./shared.js"; import(`./other.js`); import("./lazy.js");'],
    ['shared', 'export const x=1;'], ['lazy', 'import "./shared.js"; import("./other.js");'], ['other', 'export const y=2;']
  ]);
  const chunks = [...code].map(([name, source]) => ({ fileName: `_astro/${name}.js`, name, isEntry: name === 'entry', isDynamicEntry: name === 'lazy', facadeModuleId: `${name}.mts`, imports: [...new Set(imports(source).static)].map(path => '_astro/' + path.slice(2)), dynamicImports: imports(source).dynamic.map(path => '_astro/' + path.slice(2)), modules: [], importedCss: [], importedAssets: [] }));
  for (const [name, source] of code) await writeFile(join(dist, `_astro/${name}.js`), source);
  await writeFile(join(metadata, 'client.json'), JSON.stringify({ environment: 'client-1', chunks, assets: [] }));
  await writeFile(join(dist, 'objects/a/first-view.json'), '{"tree":[]}'); await writeFile(join(dist, 'objects/a/entry.json'), '{}');
  await writeFile(join(dist, '_astro/page.css'), 'body{color:red}');
  const html = '<html><head><link href="/image.webp" rel="preload" as="image" fetchpriority="high"><link rel="preload" as="font" href="/font.woff2"><link rel="modulepreload" href="/_astro/shared.js"><link rel="prefetch" href="/objects/a/entry.json"><link rel="preconnect" href="https://assets.example"><link rel="dns-prefetch" href="//assets.example"><link rel="stylesheet" href="/_astro/page.css"><style>body{color:blue}</style><script type="module" src="/_astro/entry.js" async defer></script><script src="/classic.js" defer></script><script>(function startStartupRequests(window,urls,transportUrl,sceneRoute){for(const url of [transportUrl,...urls])fetch(url);})(window,["/objects/a/entry.json"],"/objects/a/first-view.json","/a/");</script></head></html>';
  await writeFile(join(dist, 'index.html'), html);
  return { root, dist, metadata, html };
}
test('all declared resource counts, compressed bytes, graph depths and source orders are deterministic', async () => {
  const f = await fixture();
  try {
    const result = await measure(f.dist, f.metadata, ['/']); const again = await measure(f.dist, f.metadata, ['/']);
    assert.equal(sortedJson(result), sortedJson(again));
    const route = result.routes['/']!, c = route.counts;
    for (const rel of ['modulepreload', 'prefetch', 'preconnect', 'dns-prefetch', 'stylesheet']) assert.equal(c[`links.${rel}`], 1);
    assert.equal(c['links.preload'], 2); assert.equal(c['hint.image'], 1); assert.equal(c['hint.font'], 1);
    assert.equal(c['scripts.module'], 1); assert.equal(c['scripts.classic'], 1); assert.equal(c['scripts.async'], 1); assert.equal(c['scripts.defer'], 2);
    assert.equal(c['inline.script.count'], 1); assert.equal(c['inline.style.count'], 1); assert.equal(c['inline.style.raw'], 16);
    assert.equal(c['document.raw'], Buffer.byteLength(f.html)); assert.equal(c['document.gzip'], gzipSync(f.html).length);
    assert.equal(c['document.brotli'], brotliCompressSync(f.html, { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }).length);
    assert.equal(c['static.count'], 2); assert.equal(c['static.chain'], 2); assert.equal(c['dynamic.count'], 2);
    assert.deepEqual(route.sequences['imports.entry.mts'], ['other.mts', 'lazy.mts']);
    assert.deepEqual(route.sequences.startup, ['GET /objects/a/first-view.json', 'GET /objects/a/entry.json']);
    assert.equal(c['startup.requests'], 2); assert.equal(c['startup.parallelRounds'], 1); assert.equal(c['startup.sequentialRoundTrips'], 2);
    assert.equal(result.global['astro.count'], 4); assert.equal(result.global['css.count'], 1); assert.equal(result.global['transports.count'], 2);
    assert.equal(c['stylesheet.raw'], 15); assert.equal(c['css.raw'], 31); assert.equal(c['astro.count'], 4); assert.equal(c['transports.count'], 2); assert.equal(c['transports.raw'], 13); assert.equal(c['lazy.staticClosure.count'], 4);
    assert.ok(c['lazy.lazy.mts.raw']! > 0); assert.equal(c['startup.raw'], 13);
    assert.deepEqual(parseMeasures(JSON.parse(sortedJson(result))), result);
    await writeFile(join(f.dist, 'index.html'), f.html.replace('</head>', '<link rel="preload" href="/extra"></head>'));
    const regressed = await measure(f.dist, f.metadata, ['/']);
    assert.ok(compare(result, regressed).findings.some(item => item.measure === 'links.preload' && item.verdict === 'FAILURE'));
    await writeFile(join(f.dist, 'index.html'), f.html.replace('</head>', '<script>fetch("/objects/a/entry.json")</script></head>'));
    assert.ok(compare(result, await measure(f.dist, f.metadata, ['/'])).findings.some(item => item.measure === 'startup.requests' && item.verdict === 'FAILURE'));
    await assert.rejects(measure(f.dist, f.metadata, ['/missing/']), /ENOENT/u);
    await writeFile(join(f.dist, '_astro/entry.js'), 'import "./other.js";');
    await assert.rejects(measure(f.dist, f.metadata, ['/']), /mismatch/u);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
const sample = (): Measures => ({ schema: 'build-measures@1', global: { raw: 10 }, routes: { '/': { counts: { 'links.preload': 2, 'dynamic.count': 2, raw: 10, chain: 2 }, sequences: { lazy: ['a', 'b', 'c'], startup: ['GET /a', 'GET /b'] }, declarations: [] } } });
test('equality passes; every increase fails; every decrease is an accepted, listed improvement', () => {
  const base = sample(); assert.equal(compare(base, sample()).pass, true);
  for (const key of Object.keys(base.routes['/']!.counts)) {
    const head = sample(); head.routes['/']!.counts[key]!++;
    assert.equal(compare(base, head).pass, false, key);
    assert.ok(compare(base, head).findings.some(item => item.measure === key && item.verdict === 'FAILURE'));
    head.routes['/']!.counts[key]! -= 2;
    assert.equal(compare(base, head).pass, true); assert.match(summary(compare(base, head)), /IMPROVEMENT/u);
  }
  const head = sample(); head.global.raw = 11; assert.equal(compare(base, head).pass, false); head.global.raw = 9; assert.equal(compare(base, head).pass, true);
});
test('only strict ordered deletion improves sequences; shorter reordered chains still fail', () => {
  const base = sample();
  for (const order of [['b', 'a', 'c'], ['c', 'a'], ['a', 'b', 'c', 'd'], ['x'], ['a', 'a']]) {
    const head = sample(); head.routes['/']!.sequences.lazy = order; assert.equal(compare(base, head).pass, false, JSON.stringify(order));
  }
  for (const order of [[], ['a'], ['b', 'c']]) { const head = sample(); head.routes['/']!.sequences.lazy = order; assert.equal(compare(base, head).pass, true); }
  assert.equal(subsequence(['a', 'a', 'b'], ['a', 'b']), true);
  const head = sample(); head.routes['/']!.sequences.startup.reverse(); assert.equal(compare(base, head).pass, false);
});
test('added and removed routes fail closed and are reported; missing measures mean zero', () => {
  const base = sample(), head = sample(); head.routes['/new/'] = head.routes['/']!;
  assert.deepEqual(compare(base, head).addedRoutes, ['/new/']); assert.equal(compare(base, head).pass, false);
  delete head.routes['/new/']; delete head.routes['/']; assert.deepEqual(compare(base, head).removedRoutes, ['/']); assert.equal(compare(base, head).pass, false);
  const next = sample(); delete next.routes['/']!.counts['links.preload']; assert.equal(compare(base, next).pass, true);
  next.routes['/']!.counts.new = 1; assert.equal(compare(base, next).pass, false);
});
test('validation, unknown imports and nondefault fetch methods cannot silently disappear', () => {
  assert.throws(() => parseMeasures({ schema: 'other' })); const invalid = sample(); invalid.global.raw = -1; assert.throws(() => parseMeasures(invalid));
  assert.throws(() => localFile('/tmp/dist', '/../escape')); assert.throws(() => localFile('/tmp/dist', '//host/file'));
  assert.deepEqual(imports('// import("fake")\nimport(x);').unresolved, ['x']);
  assert.deepEqual(startup('fetch("/extra")'), ['/extra']); assert.deepEqual(startupDeclarations('fetch("/extra",{method:"POST"})'), [{ url: '/extra', method: 'POST' }]); assert.throws(() => startupDeclarations('fetch("/extra",{method:unknown})')); assert.throws(() => startup('fetch(unknown)'));
});

test('system routes defer the body transport; altered bootstrap loops fail analysis', () => {
  const code = '(function startStartupRequests(window,urls,transportUrl,sceneRoute){const location=window.location,query=new URLSearchParams(location.search);const defaultView=(location.pathname === "/" || location.pathname === sceneRoute) && !["dataset","feature","v","settings","q"].some((key)=>query.has(key));for(const url of defaultView ? [transportUrl,...urls] : urls){fetch(url);}})(window,["/world.json"],"/object.json","/earth/");';
  const deferred: {url: string; method: string}[] = [];
  assert.deepEqual(startupDeclarations(code, '/earth-system/', deferred), [{ url: '/world.json', method: 'GET' }]);
  assert.deepEqual(deferred, [{ url: '/object.json', method: 'GET' }]);
  assert.equal(startupDeclarations(code, '/earth/').length, 2); assert.equal(startupDeclarations(code, '/').length, 2);
  assert.throws(() => startupDeclarations(code.replace('fetch(url);', 'fetch(url);fetch(url);')), /loop/u);
  assert.throws(() => startupDeclarations(code.replace('fetch(url);', 'fetch(url,{method:"POST"});')), /fetch/u);
  assert.throws(() => startupDeclarations(code.replace('fetch(url);', 'window.fetch(url);')), /fetch/u);
});

test('metadata-derived startup queue, shared dependency reuse and lost laziness are counted', async () => {
  const f = await fixture();
  try {
    const member = (id: string, code: string, dynamic: string[] = []) => ({ id, code, renderedLength: code.length, originalLength: code.length, importedIds: [], dynamicallyImportedIds: dynamic, importers: [], importedCss: [], importedAssets: [] });
    const codes = new Map([['entry', 'import "./shared.js";import("./runtime.js");import("./router.js");import("./registry.js");import("./world.js");'], ['shared', 'export const x=1'], ['runtime', 'import "./shared.js";export const x=1'], ['router', 'export const x=2'], ['registry', 'export const x=3'], ['world', 'export const x=4']]);
    const writeGraph = async () => {
      const chunks = [...codes].map(([name, code]) => ({ fileName: `_astro/${name}.js`, name, facadeModuleId: `${name}.mts`, isEntry: name === 'entry', isDynamicEntry: name !== 'entry', imports: imports(code).static.map(path => '_astro/' + path.slice(2)), dynamicImports: imports(code).dynamic.map(path => '_astro/' + path.slice(2)), importedCss: [], importedAssets: [], modules: [member(`${name}.mts`, code)] }));
      chunks[0]!.modules.push(member('moved/startup-boot.mts', 'function startBodyCode(document){importRuntime()}function startViewCode(document){importRegistry();importWorld()}'), member('moved/layout.mts', 'startBodyCode(document);loadStartupWorld(window).then(importRouter).then(()=>startViewCode(document));'), member('moved/queue.mts', 'var importRuntime=queuedImport(()=>import("./runtime.js"));var importRouter=queuedImport(()=>import("./router.js"));var importRegistry=queuedImport(()=>import("./registry.js"));var importWorld=queuedImport(()=>import("./world.js"));', ['runtime.mts', 'router.mts', 'registry.mts', 'world.mts']));
      for (const [name, code] of codes) await writeFile(join(f.dist, `_astro/${name}.js`), code);
      await rm(join(f.dist, '_astro/lazy.js')); await rm(join(f.dist, '_astro/other.js'));
      await writeFile(join(f.metadata, 'client.json'), JSON.stringify({ environment: 'client-1', chunks, assets: [] }));
    };
    await writeGraph();
    const base = await measure(f.dist, f.metadata, ['/']), route = base.routes['/']!;
    assert.deepEqual(route.sequences['startup.queue'], ['runtime.mts', 'router.mts', 'registry.mts', 'world.mts']);
    assert.equal(route.counts['startup.queue.count'], 4); assert.equal(route.counts['startup.sequentialRoundTrips'], 6);
    codes.set('entry', codes.get('entry')!.replace('import("./runtime.js")', 'import "./runtime.js"'));
    // Recreate the two fixture files before the graph writer's cleanup.
    await writeFile(join(f.dist, '_astro/lazy.js'), ''); await writeFile(join(f.dist, '_astro/other.js'), ''); await writeGraph();
    const head = await measure(f.dist, f.metadata, ['/']);
    assert.equal(head.routes['/']!.counts['static.count'], 3); assert.equal(head.routes['/']!.counts['dynamic.count'], 3);
    assert.ok(compare(base, head).findings.some(finding => finding.measure === 'static.count' && finding.verdict === 'FAILURE'));
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('same-name chunks cannot overwrite bytes; a compensating decrease cannot hide an increase', async () => {
  const f = await fixture();
  try {
    const env = parseEnvironment(JSON.parse(await readFile(join(f.metadata, 'client.json'), 'utf8')));
    for (const [index, owner] of [[0, 'engine'], [1, 'core']] as const) {
      const chunk = env.chunks[index]!; chunk.name = 'dist'; chunk.facadeModuleId = null;
      chunk.modules.push({ id: `packages/${owner}/dist/index.js`, code: '', renderedLength: 0, originalLength: 0, importedIds: [], dynamicallyImportedIds: [], importers: [], importedCss: [], importedAssets: [] });
    }
    await writeFile(join(f.metadata, 'client.json'), JSON.stringify(env));
    const base = await measure(f.dist, f.metadata, ['/']);
    assert.ok(base.global['chunk.dist[core].raw']! > 0); assert.ok(base.global['chunk.dist[engine].raw']! > 0);
    const head = structuredClone(base); head.global['chunk.dist[core].raw']!++; head.global['chunk.dist[engine].raw']!--;
    assert.equal(compare(base, head).pass, false);
    env.chunks[0]!.modules = []; env.chunks[1]!.modules = [];
    await writeFile(join(f.metadata, 'client.json'), JSON.stringify(env));
    await assert.rejects(measure(f.dist, f.metadata, ['/']), /Ambiguous/u);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('inline module imports, embedded data and cyclic static graphs remain counted', async () => {
  const f = await fixture();
  try {
    await writeFile(join(f.dist, 'index.html'), f.html.replace('</head>', '<script type="module">import "./_astro/lazy.js";import("./_astro/other.js")</script></head>'));
    let result = await measure(f.dist, f.metadata, ['/']);
    assert.equal(result.routes['/']!.counts['static.count'], 3); assert.equal(result.routes['/']!.counts['dynamic.count'], 2);
    assert.deepEqual(result.routes['/']!.sequences['imports.inline'], ['other.mts']);
    await writeFile(join(f.dist, 'index.html'), f.html.replace('"/objects/a/entry.json"],', '"data:application/json;base64,e30="],'));
    result = await measure(f.dist, f.metadata, ['/']);
    assert.equal(result.routes['/']!.counts['startup.requests'], 1); assert.equal(result.routes['/']!.counts['transport.embedded-summary.raw'], 2);
    const env = parseEnvironment(JSON.parse(await readFile(join(f.metadata, 'client.json'), 'utf8')));
    env.chunks[1]!.imports = ['_astro/entry.js']; await writeFile(join(f.dist, '_astro/shared.js'), 'import "./entry.js";export const x=1;'); await writeFile(join(f.metadata, 'client.json'), JSON.stringify(env));
    result = await measure(f.dist, f.metadata, ['/']); assert.equal(result.routes['/']!.counts['static.chain'], 2);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});


test('inline startup script byte growth fails its own raw measure', async () => {
  const f = await fixture();
  try {
    const base = await measure(f.dist, f.metadata, ['/']);
    const addition = '/* more startup bytes */';
    await writeFile(join(f.dist, 'index.html'), f.html.replace('(function startStartupRequests', addition + '(function startStartupRequests'));
    const head = await measure(f.dist, f.metadata, ['/']);
    assert.equal(head.routes['/']!.counts['inline.script.raw'], base.routes['/']!.counts['inline.script.raw']! + Buffer.byteLength(addition));
    const result = compare(base, head);
    assert.equal(result.pass, false);
    assert.ok(result.findings.some(item => item.measure === 'inline.script.raw' && item.verdict === 'FAILURE' && item.kind === 'increase'));
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('nonalphabetical dynamic import source order fails on alphabetical reorder', async () => {
  const f = await fixture();
  try {
    const base = await measure(f.dist, f.metadata, ['/']);
    assert.deepEqual(base.routes['/']!.sequences['imports.entry.mts'], ['other.mts', 'lazy.mts']);
    const head = structuredClone(base);
    head.routes['/']!.sequences['imports.entry.mts']!.sort();
    const result = compare(base, head);
    assert.equal(result.pass, false);
    assert.ok(result.findings.some(item => item.measure === 'imports.entry.mts' && item.kind === 'order' && item.verdict === 'FAILURE'));
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

for (const key of ['startup.methods.GET', 'startup.methods.POST', 'static.chain', 'startup.sequentialRoundTrips']) {
  test(`real numeric key ${key} rejects an isolated increase`, () => {
    const base = sample(); base.routes['/']!.counts[key] = 2;
    const head = structuredClone(base); head.routes['/']!.counts[key] = 3;
    const result = compare(base, head);
    assert.equal(result.pass, false);
    assert.deepEqual(failureCounts(result), { increase: 1, order: 0, declaration: 0, 'removed-route': 0 });
    assert.ok(result.findings.some(item => item.measure === key && item.verdict === 'FAILURE'));
    head.routes['/']!.counts[key] = 1;
    assert.equal(compare(base, head).pass, true);
  });
}

for (const [name, before, after] of [
  ['href', 'href="/image.webp"', 'href="/replacement.webp"'],
  ['fetchpriority', 'fetchpriority="high"', ''],
  ['async', ' async defer', ' defer'],
  ['defer', ' async defer', ' async'],
  ['as', 'as="image"', 'as="fetch"'],
  ['rel', 'rel="preload" as="image"', 'rel="prefetch" as="image"']
]) {
  test(`declaration ${name} change fails independently of counts and sequences`, async () => {
    const f = await fixture();
    try {
      const base = await measure(f.dist, f.metadata, ['/']);
      await writeFile(join(f.dist, 'index.html'), f.html.replace(before!, after!));
      const measured = await measure(f.dist, f.metadata, ['/']);
      // Isolate the recorded declaration so byte/count/order failures cannot mask a missing check.
      const head = structuredClone(base); head.routes['/']!.declarations = measured.routes['/']!.declarations;
      const result = compare(base, head);
      assert.equal(result.pass, false);
      assert.deepEqual(failureCounts(result), { increase: 0, order: 0, declaration: 1, 'removed-route': 0 });
    } finally { await rm(f.root, { recursive: true, force: true }); }
  });
}

test('declarations permit only pure multiset removal, preserving duplicate occurrences', () => {
  const base = sample(); base.routes['/']!.declarations = [{ href: '/a', as: 'image' }, { href: '/a', as: 'image' }, { src: '/b', async: true }];
  const head = structuredClone(base);
  head.routes['/']!.declarations.reverse(); assert.equal(compare(base, head).pass, true);
  head.routes['/']!.declarations.pop();
  let result = compare(base, head); assert.equal(result.pass, true);
  assert.ok(result.findings.some(item => item.kind === 'declaration' && item.verdict === 'IMPROVEMENT'));
  head.routes['/']!.declarations = []; assert.equal(compare(base, head).pass, true);
  head.routes['/']!.declarations = [{ href: '/a', as: 'fetch' }]; assert.equal(compare(base, head).pass, false);
  head.routes['/']!.declarations = [...base.routes['/']!.declarations, { href: '/a', as: 'image' }];
  assert.equal(compare(base, head).pass, false);
  head.routes['/']!.declarations = [{ as: 'image', href: '/a' }, { as: 'image', href: '/a' }, { async: true, src: '/b' }];
  result = compare(base, head); assert.equal(result.pass, true); assert.deepEqual(result.findings, []);
});

test('finding kinds and failure counts distinguish order, declarations and route loss', () => {
  const base = sample(), head = sample();
  head.routes['/']!.counts.raw!++; head.routes['/']!.sequences.lazy.reverse();
  head.routes['/']!.declarations = [{ href: '/new' }];
  base.routes['/removed/'] = structuredClone(base.routes['/']!);
  const result = compare(base, head);
  assert.deepEqual(failureCounts(result), { increase: 1, order: 1, declaration: 1, 'removed-route': 1 });
  assert.match(summary(result), /Failures by kind: increase: 1, order: 1, declaration: 1, removed-route: 1/u);
  assert.match(summary(result), /FAILURE \| order/u);
});

test('shipped default coverage includes both Earth pages and fifteen unique routes', async () => {
  const routes = await representativeRoutes();
  assert.equal(routes.length, 15); assert.equal(new Set(routes).size, 15);
  assert.ok(routes.includes('/earth/')); assert.ok(routes.includes('/earth-system/')); assert.ok(routes.includes('/'));
});
