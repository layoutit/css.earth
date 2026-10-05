/** Independent mutations of every equality/report dimension, without real builds. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { compare } from './compare.mts';
import { parseEnvironment, parseMoves } from './records.mts';
import type { Build, Chunk, Module } from './records.mts';
function module(id: string, code = 'export const value = 1;'): Module { return { id, code, renderedLength: code.length, originalLength: code.length, importedIds: [], dynamicallyImportedIds: [], importers: [], importedCss: [], importedAssets: [] }; }
function chunk(name: string, modules: Module[], imports: string[] = []): Chunk { return { fileName: name, name: name.split('.')[0]!, isEntry: true, isDynamicEntry: false, facadeModuleId: modules[0]?.id ?? null, imports, dynamicImports: [], modules, importedCss: [], importedAssets: [] }; }
function fixture(): Build {
  return { environments: [{ environment: 'client-0', chunks: [chunk('_astro/a.111.js', [module('site/a.mts')]), chunk('_astro/b.111.js', [module('site/b.mts')])], assets: [{ fileName: '_astro/a.111.css', names: ['a.css'], originalFileNames: ['site/a.css'] }, { fileName: '_astro/icon.111.png', names: ['icon.png'], originalFileNames: ['site/icon.png'] }] }], files: new Map([
    ['index.html', Buffer.from('<script src="/_astro/a.111.js"></script>')], ['_astro/a.111.js', Buffer.from('export const value = 1;')], ['_astro/b.111.js', Buffer.from('export const value = 1;')],
    ['_astro/a.111.css', Buffer.from('body{color:red}')], ['_astro/icon.111.png', Buffer.from([1, 2])], ['catalog.json', Buffer.from('{"one":1}')], ['_headers', Buffer.from('immutable')],
  ]) };
}
const dim = async (base: Build, head: Build, expected: string) => { const report = await compare(base, head, {}, 'pure-move'); assert.equal(report.exitCode, 1); assert.ok(report.differences.some(diff => diff.dimension === expected), expected); return report; };
test('identical full build: both equalities, routes and classifications', async () => { const report = await compare(fixture(), fixture(), {}, 'pure-move'); assert.equal(report.semanticEqual, true); assert.equal(report.layoutEqual, true); assert.equal(report.exitCode, 0); assert.deepEqual(report.routes['index.html'], []); assert.equal(report.manifest.head['catalog.json'], 'data'); });
test('module code independently changes semantic equality', async () => { const head = fixture(); head.environments[0]!.chunks[0]!.modules[0]!.code = 'export const value = 2;'; const r = await dim(fixture(), head, 'modules'); assert.equal(r.semanticEqual, false); assert.equal(r.layoutEqual, true); });
test('resolved import edge independently changes semantic equality', async () => { const head = fixture(); head.environments[0]!.chunks[0]!.modules[0]!.importedIds.push('site/b.mts'); const r = await dim(fixture(), head, 'imports'); assert.equal(r.semanticEqual, false); });
test('dynamic resolved import edge is distinct from static edge', async () => { const base = fixture(), head = fixture(); base.environments[0]!.chunks[0]!.modules[0]!.importedIds.push('site/b.mts'); head.environments[0]!.chunks[0]!.modules[0]!.dynamicallyImportedIds.push('site/b.mts'); await dim(base, head, 'imports'); });
test('membership changes without semantic differences', async () => { const head = fixture(); const chunks = head.environments[0]!.chunks; chunks[0]!.modules.push(chunks[1]!.modules.pop()!); chunks[1]!.facadeModuleId = null; const r = await dim(fixture(), head, 'membership'); assert.equal(r.semanticEqual, true); assert.equal(r.layoutEqual, false); assert.equal((await compare(fixture(), head, {}, 'semantic', undefined, { paths: ['site/a.mts', 'site/a.css'] })).exitCode, 1); });
for (const [path, dimension] of [['_astro/a.111.css', 'css'], ['_astro/icon.111.png', 'asset'], ['index.html', 'html'], ['_astro/a.111.js', 'js'], ['catalog.json', 'data'], ['_headers', 'other']] as const) {
  test(`${dimension} byte independently changes its report dimension`, async () => { const head = fixture(); head.files.set(path, Buffer.from('different')); const r = await dim(fixture(), head, dimension); assert.equal(r.layoutEqual, false); assert.equal(r.semanticEqual, true); if (dimension === 'html') assert.equal(r.routes['index.html']!.length, 1); assert.equal((await compare(fixture(), head, {}, 'semantic')).exitCode, 1); });
}
for (const operation of ['add', 'remove']) test(`file ${operation} detected separately`, async () => { const head = fixture(); if (operation === 'add') head.files.set('extra.bin', Buffer.from('extra')); else head.files.delete('catalog.json'); await dim(fixture(), head, 'files'); });
test('hashed chunk renaming preserves equality', async () => { const base = fixture(), head = fixture(); const c = head.environments[0]!.chunks[0]!; c.fileName = '_astro/a.222.js'; head.files.set(c.fileName, head.files.get('_astro/a.111.js')!); head.files.delete('_astro/a.111.js'); head.files.set('index.html', Buffer.from('<script src="/_astro/a.222.js"></script>')); assert.equal((await compare(base, head, {}, 'pure-move')).equal, true); });
test('canonicalization cannot hide a wrong imported chunk', async () => { const base = fixture(), head = fixture(); head.files.set('index.html', Buffer.from('<script src="/_astro/b.111.js"></script>')); await dim(base, head, 'html'); });
test('chunk reference graph independently changes', async () => { const base = fixture(), head = fixture(); base.environments[0]!.chunks[0]!.imports.push('_astro/b.111.js'); head.environments[0]!.chunks[0]!.dynamicImports.push('_astro/b.111.js'); await dim(base, head, 'references'); });
test('move map renames ids and graph without hiding changed code', async () => { const base = fixture(), head = fixture(); const c = head.environments[0]!.chunks[0]!; c.modules[0]!.id = 'site/world/a.mts'; c.facadeModuleId = c.modules[0]!.id; const moves = { 'site/a.mts': 'site/world/a.mts' }; assert.equal((await compare(base, head, moves, 'pure-move')).equal, true); assert.equal((await compare(base, head, {}, 'pure-move')).equal, false); c.modules[0]!.code = 'changed'; assert.equal((await compare(base, head, moves, 'pure-move')).equal, false); });
test('client references and ancestors do not grant page closure', async () => {
  const base = fixture(), head = fixture();
  for (const build of [base, head]) {
    build.environments[0]!.chunks[0]!.imports.push('_astro/b.111.js');
    build.files.set('second/index.html', Buffer.from('<script src="/_astro/b.111.js"></script>'));
  }
  head.environments[0]!.chunks[1]!.modules[0]!.code = 'changed';
  head.files.set('_astro/b.111.js', Buffer.from('changed'));
  head.files.set('second/index.html', Buffer.from('<script src="/_astro/b.111.js"></script><h1>DROPPED NAV</h1>'));
  const r = await compare(base, head, {}, 'semantic', undefined, { paths: ['site/b.mts'] });
  assert.equal(r.exitCode, 1); assert.equal(r.closure.chunks.length, 1); assert.deepEqual(r.closure.pages, []);
  assert.equal(r.differences.find(diff => diff.identity === 'second/index.html')!.insideClosure, false);
});
test('closure cannot admit independent page, CSS or public asset changes', async () => { const base = fixture(), head = fixture(); head.environments[0]!.chunks[0]!.modules[0]!.code = 'changed'; head.files.set('_astro/icon.111.png', Buffer.from([3])); head.files.set('unrelated/index.html', Buffer.from('unrelated')); head.files.set('_astro/a.111.css', Buffer.from('wrong')); const r = await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts', 'site/a.css'] }); assert.equal(r.exitCode, 1); assert.ok(r.differences.filter(d => ['asset', 'css'].includes(d.dimension)).every(d => !d.insideClosure)); assert.ok(!r.closure.pages.includes('unrelated/index.html')); });
test('produced assets are inside closure through source module attribution', async () => { const base = fixture(), head = fixture(); for (const build of [base, head]) build.environments[0]!.chunks[0]!.modules.push(module('site/a.css')); head.environments[0]!.chunks[0]!.modules[1]!.code = 'changed'; head.files.set('_astro/a.111.css', Buffer.from('changed')); const r = await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts', 'site/a.css'], outputs: [{ glob: '_astro/*.css', reason: 'Changed source stylesheet' }] }); assert.equal(r.exitCode, 0); assert.equal(r.closure.assets.length, 1); });
test('report mode remains informational', async () => { const head = fixture(); head.files.set('catalog.json', Buffer.from('changed')); const r = await compare(fixture(), head); assert.equal(r.exitCode, 0); assert.equal(r.equal, false); });
test('external metadata and moves validated', () => { assert.throws(() => parseEnvironment({ environment: 'client', chunks: [{ modules: [] }], assets: [] })); for (const value of [{ '../a': 'b' }, { a: 'b', c: 'b' }, { a: 'b', b: 'a' }, { a: 7 }]) assert.throws(() => parseMoves(value)); assert.deepEqual(parseMoves({ 'site/a.mts': null }), { 'site/a.mts': null }); });

test('a worker transported as a parent asset retains its chunk identity', async () => { const base = fixture(), head = fixture(); for (const build of [base, head]) build.environments[0]!.assets.push({ fileName: '_astro/a.111.js', names: [], originalFileNames: [] }); assert.equal((await compare(base, head, {}, 'pure-move')).equal, true); });

test('sibling JavaScript references normalize filename churn and retain target identity', async () => {
  const base = fixture(), head = fixture();
  base.files.set('_astro/b.111.js', Buffer.from('import "./a.111.js";'));
  head.files.set('_astro/b.111.js', Buffer.from('import "./a.222.js";'));
  head.environments[0]!.chunks[0]!.fileName = '_astro/a.222.js';
  head.files.set('_astro/a.222.js', head.files.get('_astro/a.111.js')!); head.files.delete('_astro/a.111.js');
  head.files.set('index.html', Buffer.from('<script src="/_astro/a.222.js"></script>'));
  assert.equal((await compare(base, head, {}, 'pure-move')).equal, true);
  head.files.set('_astro/b.111.js', Buffer.from('import "./b.111.js";'));
  await dim(base, head, 'js');
});

test('empty facade chunks and source-member chunks have distinct identities', async () => { const base = fixture(), head = fixture(); for (const build of [base, head]) { const empty = chunk('_astro/empty.js', []); empty.facadeModuleId = 'site/a.mts'; build.environments[0]!.chunks.push(empty); build.files.set('_astro/empty.js', Buffer.from('')); } assert.equal((await compare(base, head, {}, 'pure-move')).equal, true); });

test('Vite asset references normalize only through their actual emitted-file binding', async () => {
  const base = fixture(), head = fixture();
  base.environments[0]!.references = { '__VITE_ASSET__base__': '_astro/icon.111.png' };
  head.environments[0]!.references = { '__VITE_ASSET__head__': '_astro/icon.111.png' };
  base.environments[0]!.chunks[0]!.modules[0]!.code = 'export default "__VITE_ASSET__base__"';
  head.environments[0]!.chunks[0]!.modules[0]!.code = 'export default "__VITE_ASSET__head__"';
  assert.equal((await compare(base, head, {}, 'pure-move')).equal, true);
  head.environments[0]!.references['__VITE_ASSET__head__'] = '_astro/a.111.css';
  await dim(base, head, 'modules');
  delete head.environments[0]!.references['__VITE_ASSET__head__'];
  await assert.rejects(compare(base, head), /Missing Vite asset reference binding/u);
});

test('mere chunk-name mentions cannot enlarge page closure', async () => {
  const base = fixture(), head = fixture();
  for (const build of [base, head]) build.files.set('unrelated/index.html', Buffer.from('<p>_astro/a.111.js</p>'));
  head.environments[0]!.chunks[0]!.modules[0]!.code = 'changed';
  head.files.set('unrelated/index.html', Buffer.from('<p>_astro/a.111.js changed</p>'));
  const report = await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts', 'site/a.css'] });
  assert.equal(report.exitCode, 1); assert.ok(!report.closure.pages.includes('unrelated/index.html'));
});

test('prerender source changes close over only their matching HTML and data routes', async () => {
  const base = fixture(), head = fixture();
  for (const build of [base, head]) {
    const chunks = build.environments[0]!.chunks; build.environments[0]!.environment = 'prerender-0';
    const page = chunk('pages/body.mjs', [module('virtual-page')], [chunks[0]!.fileName]); page.facadeModuleId = '\0virtual:astro:page:site/pages/[id]@_@astro'; page.modules[0]!.id = page.facadeModuleId; page.modules[0]!.importedIds = ['site/a.mts']; chunks.push(page);
    const data = chunk('pages/data.mjs', [module('virtual-data')], [chunks[0]!.fileName]); data.facadeModuleId = '\0virtual:astro:page:site/pages/objects/[id]/object.json@_@ts'; data.modules[0]!.id = data.facadeModuleId; data.modules[0]!.importedIds = ['site/a.mts']; chunks.push(data);
    build.files.set('earth/index.html', Buffer.from('<p>original</p>')); build.files.set('objects/earth/object.json', Buffer.from('{}'));
    build.files.set('other/deep/index.html', Buffer.from('<p>unrelated</p>'));
  }
  head.environments[0]!.chunks[0]!.modules[0]!.code = 'changed';
  head.files.set('earth/index.html', Buffer.from('<p>changed</p>')); head.files.set('objects/earth/object.json', Buffer.from('{"changed":true}'));
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts', 'site/a.css'], outputs: [{ glob: 'earth/index.html', reason: 'Changed rendered page' }, { glob: 'objects/*/object.json', reason: 'Changed rendered transport' }] })).exitCode, 0);
  head.files.set('other/deep/index.html', Buffer.from('wrong'));
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts', 'site/a.css'] })).exitCode, 1);
});

test('single-origin native asset output changes seed the exact producer closure', async () => {
  const base = fixture(), head = fixture();
  for (const build of [base, head]) build.environments[0]!.chunks[0]!.modules.push(module('site/a.css'));
  head.files.set('_astro/a.111.css', Buffer.from('body{color:blue}'));
  const report = await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts', 'site/a.css'], outputs: [{ glob: '_astro/*.css', reason: 'Changed source stylesheet' }] });
  assert.equal(report.semanticEqual, false); assert.equal(report.exitCode, 0);
  assert.deepEqual(report.closure.modules, ['client-0:site/a.css', 'client-0:site/a.mts']); assert.equal(report.closure.assets.length, 1);
  head.files.set('_astro/icon.111.png', Buffer.from('wrong'));
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts', 'site/a.css'] })).exitCode, 1);
});

test('route reports carry indirect module and JavaScript impacts with review detail', async () => {
  const base = fixture(), head = fixture(); head.environments[0]!.chunks[0]!.modules[0]!.code = 'changed'; head.files.set('_astro/a.111.js', Buffer.from('changed'));
  const report = await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts', 'site/a.css'] });
  assert.ok(report.routes['index.html']!.some(index => report.differences[index]!.dimension === 'js'));
  assert.ok(report.routes['index.html']!.some(index => report.differences[index]!.dimension === 'modules' && report.differences[index]!.detail?.head === 'changed'));
  assert.ok(report.differences.find(diff => diff.dimension === 'modules')!.chunks.length);
  assert.ok(report.manifest.metadata.base);
});


test('empty emitted trees or missing source modules cannot pass in any mode', async () => {
  for (const mode of ['report', 'pure-move', 'semantic'] as const) for (const side of ['base', 'head'] as const) {
    for (const missing of ['files', 'modules']) {
      const base = fixture(), head = fixture(), build = side === 'base' ? base : head;
      if (missing === 'files') build.files.clear(); else build.environments = [{ environment: 'client', chunks: [], assets: [] }];
      await assert.rejects(compare(base, head, {}, mode), /Empty .* comparison build/u);
    }
  }
});

test('source facts cannot authorize an unrelated changed module', async () => {
  const head = fixture(); head.environments[0]!.chunks[1]!.modules[0]!.code = 'wrong';
  const report = await compare(fixture(), head, {}, 'semantic', undefined, { paths: ['site/a.mts'] });
  assert.equal(report.exitCode, 1); assert.equal(report.differences.find(diff => diff.dimension === 'modules')!.insideClosure, false);
});
test('import order and prerender chunk module order remain observable', async () => {
  const base = fixture(), head = fixture();
  base.environments[0]!.chunks[0]!.modules[0]!.importedIds = ['site/first.mts', 'site/second.mts'];
  head.environments[0]!.chunks[0]!.modules[0]!.importedIds = ['site/second.mts', 'site/first.mts'];
  await dim(base, head, 'imports');
  for (const build of [base, head]) { build.environments[0]!.environment = 'prerender-0'; build.environments[0]!.chunks[0]!.modules.push(module('site/second.mts')); }
  head.environments[0]!.chunks[0]!.modules.reverse(); await dim(base, head, 'order');
});
test('optional raw chunk code is diagnostic, never an authorization rule', async () => {
  const base = fixture(), head = fixture();
  for (const build of [base, head]) build.environments[0]!.chunks[0]!.rawCode = 'export const value = 1;';
  head.environments[0]!.chunks[0]!.modules[0]!.code = 'export const value = 999;';
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { paths: [] })).exitCode, 1);
});
test('inventories form an independent dimension, allowed only for declared objects', async () => {
  const base = fixture(), head = fixture(); base.inventories = new Map([['earth', Buffer.from('{}')]]); head.inventories = new Map([['earth', Buffer.from('{"changed":true}')]]);
  await dim(base, head, 'inventory');
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { paths: [] })).exitCode, 1);
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { paths: [], objects: ['earth'] })).exitCode, 0);
});
test('emitted path renaming respects boundaries', async () => {
  const base = fixture(), head = fixture();
  base.files.set('index.html', Buffer.from('<style data-object-style="site/object-shell.css"></style>'));
  head.files.set('index.html', Buffer.from('<style data-object-style="site/styles/object-shell.css"></style>'));
  assert.equal((await compare(base, head, { 'site/object-shell.css': 'site/styles/object-shell.css' }, 'pure-move')).exitCode, 0);
  base.files.set('index.html', Buffer.from('<p>site/object-shell.css.extra</p>'));
  head.files.set('index.html', Buffer.from('<p>site/styles/object-shell.css.extra</p>'));
  assert.equal((await compare(base, head, { 'site/object-shell.css': 'site/styles/object-shell.css' }, 'pure-move')).exitCode, 1);
});

test('independent module and emitted-chunk evidence mutations reject', async () => {
  const base = fixture(), head = fixture();
  for (const build of [base, head]) {
    const c = build.environments[0]!.chunks[0]!;
    c.modules[0]!.codeDigest = createHash('md5').update(c.modules[0]!.code!).digest('hex');
    c.emittedDigest = createHash('md5').update('export const value = 1;').digest('hex');
  }
  head.environments[0]!.chunks[0]!.modules[0]!.code = 'metadata-only change';
  await assert.rejects(compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts'] }), /Module code evidence mismatch/u);
  head.environments[0]!.chunks[0]!.modules[0]!.code = base.environments[0]!.chunks[0]!.modules[0]!.code;
  head.files.set('_astro/a.111.js', Buffer.from('changed emitted chunk'));
  await assert.rejects(compare(base, head), /Emitted chunk evidence mismatch/u);
});

test('pure moves never grant a semantic closure from source-diff paths', async () => {
 const report = await compare(fixture(), fixture(), {}, 'pure-move', undefined, { paths: ['site/a.mts'] });
 assert.equal(report.exitCode, 0);
 assert.ok(Object.values(report.closure).every(values => values.length === 0));
});

test('emitted JSON source paths obey the same move boundaries as HTML',async()=>{
 const base=fixture(),head=fixture();
 base.files.set('catalog.json',Buffer.from('{"style":"site/object-shell.css"}'));
 head.files.set('catalog.json',Buffer.from('{"style":"site/styles/object-shell.css"}'));
 const moves={'site/object-shell.css':'site/styles/object-shell.css'};
 assert.equal((await compare(base,head,moves,'pure-move')).exitCode,0);
 head.files.set('catalog.json',Buffer.from('{"style":"site/styles/object-shell.css.extra"}'));
 assert.equal((await compare(base,head,moves,'pure-move')).exitCode,1);
});

test('a seed permits only its immediate importer module, listed separately',async()=>{
 const base=fixture(),head=fixture();
 for(const build of [base,head]) {
  const [a,b]=build.environments[0]!.chunks;
  a!.modules[0]!.importedIds=['site/b.mts'];
  const c=chunk('_astro/c.js',[module('site/c.mts')]); c.modules[0]!.importedIds=['site/a.mts'];
  build.environments[0]!.chunks.push(c); build.files.set('_astro/c.js',Buffer.from('export const value = 1;'));
 }
 head.environments[0]!.chunks[0]!.modules[0]!.code='inlined changed constant';
 const report=await compare(base,head,{},'semantic',undefined,{paths:['site/b.mts']});
 assert.equal(report.exitCode,0);
 assert.deepEqual(report.closure.directImporters,['client-0:site/a.mts']);
 assert.ok(report.closure.chunks.some(id=>report.differences[0]!.chunks.includes(id)));
 assert.ok(!report.closure.chunks.some(id=>id.includes('c.js')));
 head.environments[0]!.chunks[2]!.modules[0]!.code='arbitrary ancestor edit';
 assert.equal((await compare(base,head,{},'semantic',undefined,{paths:['site/b.mts']})).exitCode,1);
});

test('SSR chunk co-residency cannot grant an unrelated page edit',async()=>{
 const base=fixture(),head=fixture();
 for(const build of [base,head]) {
  const env=build.environments[0]!;env.environment='prerender-0';
  env.chunks[0]!.modules.push(module('site/unrelated.mts'));
  const facade='\0virtual:astro:page:site/pages/index@_@astro',m=module(facade);
  m.importedIds=['site/unrelated.mts'];
  const page=chunk('pages/index.mjs',[m],[env.chunks[0]!.fileName]);page.facadeModuleId=facade;env.chunks.push(page);
 }
 head.environments[0]!.chunks[0]!.modules[0]!.code='source seed changed';
 head.files.set('index.html',Buffer.from('<h1>DROPPED NAV</h1>'));
 const report=await compare(base,head,{},'semantic',undefined,{paths:['site/a.mts']});
 assert.equal(report.exitCode,1);assert.deepEqual(report.closure.pages,[]);
});

for (const flag of ['isEntry', 'isDynamicEntry', 'facadeModuleId'] as const) test(`chunk ${flag} is independently protected`, async () => {
  const head = fixture(), entry = head.environments[0]!.chunks[0]!;
  if (flag === 'facadeModuleId') entry.facadeModuleId = 'site/wrong.mts'; else entry[flag] = !entry[flag];
  await dim(fixture(), head, 'membership');
});
test('dynamic import operand order is independently protected', async () => {
  const base = fixture(), head = fixture();
  base.environments[0]!.chunks[0]!.modules[0]!.dynamicallyImportedIds = ['site/first.mts', 'site/second.mts'];
  head.environments[0]!.chunks[0]!.modules[0]!.dynamicallyImportedIds = ['site/second.mts', 'site/first.mts'];
  await dim(base, head, 'imports');
});
function sharedPageFixture(): Build {
  const build = fixture(), env = build.environments[0]!;
  env.environment = 'prerender-0';
  const facade = '\0virtual:astro:page:site/pages/[...route]@_@astro', page = module(facade);
  page.importedIds = ['site/a.mts'];
  const entry = chunk('pages/all.mjs', [page]); entry.facadeModuleId = facade; env.chunks.push(entry);
  build.files.set('first/index.html', Buffer.from('<p>first</p>'));
  build.files.set('second/index.html', Buffer.from('<p>second</p>'));
  return build;
}
test('a shared-layout closure over every page cannot admit an undeclared page edit', async () => {
  const base = sharedPageFixture(), head = sharedPageFixture();
  head.environments[0]!.chunks[0]!.modules[0]!.code = 'changed constant';
  head.files.set('first/index.html', Buffer.from('<p>first</p><h1>DROPPED NAV</h1>'));
  const sources = { paths: ['site/a.mts'] };
  const report = await compare(base, head, {}, 'semantic', undefined, sources);
  assert.equal(report.exitCode, 1); assert.deepEqual(report.closure.pages, ['first/index.html', 'index.html', 'second/index.html']);
  assert.equal(report.differences.find(diff => diff.dimension === 'html')!.insideClosure, true);
  assert.equal(report.differences.find(diff => diff.dimension === 'html')!.declaredOutput, false);
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { ...sources, outputs: [{ glob: 'first/index.html', reason: 'Intentional heading' }] })).exitCode, 0);
  head.files.set('second/index.html', Buffer.from('<p>second</p><h1>DROPPED NAV</h1>'));
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { ...sources, outputs: [{ glob: 'first/index.html', reason: 'Intentional heading' }] })).exitCode, 1);
});
test('declared output globs cannot exceed the source closure, including unchanged files', async () => {
  const base = fixture(), head = fixture();
  const report = await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts'], outputs: [{ glob: '**/*.html', reason: 'Too broad' }] });
  assert.equal(report.exitCode, 1); assert.deepEqual(report.declaration.outsideClosure, ['index.html']);
});
for (const [path, source, dimension] of [['_astro/a.111.css', 'site/a.css', 'css'], ['_astro/icon.111.png', 'site/icon.png', 'asset']] as const) test(`source closure requires an explicit ${dimension} output declaration`, async () => {
  const base = fixture(), head = fixture();
  for (const build of [base, head]) build.environments[0]!.chunks[0]!.modules.push(module(source));
  head.files.set(path, Buffer.from('changed'));
  const sources = { paths: [source] };
  assert.equal((await compare(base, head, {}, 'semantic', undefined, sources)).exitCode, 1);
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { ...sources, outputs: [{ glob: path, reason: 'Prepared source output' }] })).exitCode, 0);
});
function layoutFixture(): { base: Build; head: Build } {
  const base = fixture(), head = fixture(), env = base.environments[0]!;
  env.chunks[0]!.modules[0]!.importedIds = ['site/b.mts'];
  env.chunks[0]!.modules.push(env.chunks.pop()!.modules[0]!);
  base.files.delete('_astro/b.111.js');
  base.files.set('_astro/a.111.js', Buffer.from('export const value = 1; export const helper = 1;'));
  head.environments[0]!.chunks[0]!.modules[0]!.code = 'export function value(helper) { return helper; }';
  head.environments[0]!.chunks[0]!.fileName = '_astro/a.222.js';
  head.files.delete('_astro/a.111.js');
  head.files.set('_astro/a.222.js', Buffer.from('export function value(helper) { return helper; }'));
  head.files.set('index.html', Buffer.from('<script src="/_astro/a.222.js"></script>'));
  return { base, head };
}
test('import-edge repartitioning needs declared layout changes and preserves unseeded modules', async () => {
  const { base, head } = layoutFixture(), sources = { paths: ['site/a.mts'] };
  assert.equal((await compare(base, head, {}, 'semantic', undefined, sources)).exitCode, 1);
  const report = await compare(base, head, {}, 'semantic', undefined, { ...sources, layout: 'changes' });
  assert.equal(report.exitCode, 0); assert.equal(report.declaration.layoutEligible, true);
  assert.ok(report.differences.some(diff => diff.dimension === 'membership' && diff.layoutOnly));
  head.environments[0]!.chunks[1]!.modules[0]!.code = 'wrong helper';
  const wrong = await compare(base, head, {}, 'semantic', undefined, { ...sources, layout: 'changes' });
  assert.equal(wrong.exitCode, 1); assert.equal(wrong.declaration.layoutEligible, false);
});
test('layout declaration admits additions and removals of seeds only, never unseeded module changes', async () => {
  for (const operation of ['add', 'remove', 'imports']) {
    const { base, head } = layoutFixture(), entry = head.environments[0]!.chunks[1]!;
    if (operation === 'add') entry.modules.push(module('site/extra.mts'));
    if (operation === 'remove') entry.modules.pop();
    if (operation === 'imports') entry.modules[0]!.importedIds = ['site/extra.mts'];
    const seeds = operation === 'add' ? ['site/a.mts', 'site/extra.mts'] : operation === 'remove' ? ['site/a.mts', 'site/b.mts'] : ['site/a.mts'];
    const report = await compare(base, head, {}, 'semantic', undefined, { paths: seeds, layout: 'changes' });
    // A seed may appear or disappear with its chunk's identity; an unseeded import change may not.
    assert.equal(report.declaration.layoutEligible, operation !== 'imports', operation);
    // An undeclared addition stays an independent change; a removal of what only the seed imported is its orphan, not an independent change.
    if (operation === 'add') {
      const undeclared = await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts'], layout: 'changes' });
      assert.equal(undeclared.exitCode, 1); assert.equal(undeclared.declaration.layoutEligible, false);
    }
  }
});
test('layout URL normalization cannot conceal arbitrary page content', async () => {
  const { base, head } = layoutFixture();
  head.files.set('index.html', Buffer.from('<script src="/_astro/a.222.js"></script><h1>DROPPED NAV</h1>'));
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts'], layout: 'changes' })).exitCode, 1);
});
test('identical HTML hunks form one group across routes', async () => {
  const base = sharedPageFixture(), head = sharedPageFixture();
  for (const path of ['first/index.html', 'second/index.html']) head.files.set(path, Buffer.from((head.files.get(path) as Buffer).toString() + '<h1>new</h1>'));
  const report = await compare(base, head);
  assert.deepEqual(report.htmlGroups, [{ pages: ['first/index.html', 'second/index.html'], base: '', head: '<h1>new</h1>' }]);
});
test('package src edits seed bundled dist modules for the four shared owners', async () => {
  for (const owner of ['renderer', 'engine', 'core', 'objects']) {
    const base = fixture(), head = fixture(), id = `packages/${owner}/dist/index.js`;
    for (const build of [base, head]) build.environments[0]!.chunks[0]!.modules[0]!.id = id;
    head.environments[0]!.chunks[0]!.modules[0]!.code = 'changed compiled module';
    const report = await compare(base, head, {}, 'semantic', undefined, { paths: [`packages/${owner}/src/deep/input.ts`] });
    assert.equal(report.exitCode, 0); assert.deepEqual(report.closure.modules, [`client-0:${id}`]);
    assert.equal((await compare(base, head, {}, 'semantic', undefined, { paths: ['packages/unrelated/src/input.ts'] })).exitCode, 1);
  }
});

test('layout invariant excludes an importer whose code changed; one whose import list changed with a seed is admitted', async () => {
  for (const dimension of ['code', 'imports']) {
    const { base, head } = layoutFixture();
    for (const build of [base, head]) build.environments[0]!.chunks.flatMap(entry => entry.modules).find(entry => entry.id === 'site/b.mts')!.importedIds = ['site/a.mts'];
    const helper = head.environments[0]!.chunks[1]!.modules[0]!;
    if (dimension === 'code') helper.code = 'changed immediate importer'; else helper.importedIds = [];
    const report = await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts'], layout: 'changes' });
    assert.equal(report.declaration.layoutEligible, dimension === 'imports', dimension);
    assert.equal(report.exitCode, dimension === 'imports' ? 0 : 1, dimension);
    assert.ok(report.closure.directImporters.includes('client-0:site/b.mts'));
  }
});
test('data in an all-route source closure still needs its own declared output', async () => {
  const base = fixture(), head = fixture();
  for (const build of [base, head]) {
    const env = build.environments[0]!; env.environment = 'prerender-0';
    const facade = '\0virtual:astro:page:site/pages/catalog.json@_@ts', page = module(facade); page.importedIds = ['site/a.mts'];
    const entry = chunk('pages/catalog.mjs', [page]); entry.facadeModuleId = facade; env.chunks.push(entry);
  }
  head.files.set('catalog.json', Buffer.from('{"changed":true}'));
  const sources = { paths: ['site/a.mts'] };
  const report = await compare(base, head, {}, 'semantic', undefined, sources);
  assert.equal(report.exitCode, 1); assert.equal(report.differences.find(diff => diff.dimension === 'data')!.insideClosure, true);
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { ...sources, outputs: [{ glob: 'catalog.json', reason: 'Changed transport' }] })).exitCode, 0);
});
test('layout declaration cannot authorize standalone JavaScript outside chunk metadata', async () => {
  const { base, head } = layoutFixture();
  base.files.set('standalone.js', Buffer.from('original'));
  head.files.set('standalone.js', Buffer.from('arbitrary public script edit'));
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts'], layout: 'changes' })).exitCode, 1);
});
test('output declarations match emitted paths rather than synthetic metadata identities', async () => {
  const base = fixture(), head = fixture();
  for (const build of [base, head]) build.environments[0]!.chunks[0]!.modules.push(module('site/a.css'));
  head.files.set('_astro/a.111.css', Buffer.from('changed source stylesheet'));
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.css'], outputs: [{ glob: 'asset:**', reason: 'Metadata identity is not an output path' }] })).exitCode, 1);
});
test('chunk repartitioning without URL churn still requires a layout declaration', async () => {
  const { base, head } = layoutFixture();
  head.environments[0]!.chunks[0]!.fileName = '_astro/a.111.js';
  head.files.set('_astro/a.111.js', head.files.get('_astro/a.222.js')!); head.files.delete('_astro/a.222.js');
  head.files.set('index.html', base.files.get('index.html')!);
  assert.equal((await compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts', 'site/b.mts'] })).exitCode, 1);
});
test('identical added HTML hunks group across routes', async () => {
  const base = fixture(), head = fixture();
  for (const path of ['new/first/index.html', 'new/second/index.html']) head.files.set(path, Buffer.from('<p>new page</p>'));
  assert.deepEqual((await compare(base, head)).htmlGroups, [{ pages: ['new/first/index.html', 'new/second/index.html'], base: '', head: '<p>new page</p>' }]);
});

test('diagnostics are bounded, retain environment counts and distinguish bytes from semantics', async () => {
  const { compactReport, codeHunk } = await import('./compare.mts');
  const base = fixture(), head = fixture();
  for (const build of [base, head]) {
    build.environments[0]!.environment = 'prerender-0';
    build.environments[0]!.chunks[0]!.modules = Array.from({ length: 30 }, (_, i) => module(`site/${i}.mts`, 'x'.repeat(10000) + (build === base ? 'a' : 'b')));
  }
  const report = await compare(base, head);
  assert.equal(report.diagnostics.environments['prerender-0']!.modules, 30);
  assert.equal(report.diagnostics.omitted.modules, 5);
  assert.deepEqual(report.diagnostics.environmentTotals, { prerender: 30, client: 0, worker: 0, other: 0 });
  assert.equal(report.differences.filter(diff => diff.dimension === 'modules' && diff.diagnostic).length, 25);
  assert.deepEqual(report.diagnostics.emittedBytesEqual, { html: true, js: true, css: true });
  assert.deepEqual(codeHunk('x'.repeat(100) + 'a', 'x'.repeat(100) + 'b'), { offset: 100, baseLength: 101, headLength: 101, base: 'x'.repeat(80) + 'a', head: 'x'.repeat(80) + 'b' });
  assert.ok(Buffer.byteLength(JSON.stringify(compactReport(report))) < 2000000);
  head.files.set('_astro/a.111.js', Buffer.from('changed'));
  assert.equal((await compare(base, head)).diagnostics.emittedBytesEqual.js, false);
});
test('inventory diagnostic identifies asset names without content addresses', async () => {
  const base = fixture(), head = fixture();
  const inventory = (bytes: number) => Buffer.from(JSON.stringify({ assets: [{ location: 'prepared', filename: 'bank.bin', bytes }] }));
  base.inventories = new Map([['earth', inventory(1)]]); head.inventories = new Map([['earth', inventory(2)]]);
  assert.deepEqual((await compare(base, head)).differences.find(diff => diff.dimension === 'inventory')!.diagnostic, { assets: ['prepared:bank.bin'] });
});
test('import and reference diagnostics show additions, removals and pure reordering', async () => {
  const head = fixture(); head.environments[0]!.chunks[0]!.modules[0]!.importedIds.push('new.mts');
  assert.deepEqual((await compare(fixture(), head)).differences.find(diff => diff.dimension === 'imports')!.diagnostic, { added: ['static:new.mts'], removed: [], addedOmitted: 0, removedOmitted: 0, orderChanged: false });
  head.environments[0]!.chunks[0]!.imports.push('_astro/b.111.js');
  assert.ok((await compare(fixture(), head)).differences.find(diff => diff.dimension === 'references')!.diagnostic);
  const moved = fixture(); moved.environments[0]!.chunks[0]!.modules.push(moved.environments[0]!.chunks[1]!.modules.pop()!);
  assert.ok((await compare(fixture(), moved)).differences.find(diff => diff.dimension === 'membership')!.diagnostic);
});

test('a dependency only closure modules import leaves with them; one another module still imported stays an independent change', async () => {
  const orphans = (outsideImporter: boolean) => {
    const base = fixture(), head = fixture();
    // site/a.mts is the changed source; site/d.mts is a dependency it dropped, removed from the build. site/c.mts, outside the closure, may also have imported it.
    const chunks = (build: Build) => build.environments[0]!.chunks;
    chunks(base)[0]!.modules[0]!.importedIds = ['site/d.mts'];
    chunks(base)[0]!.modules.push(module('site/d.mts'));
    chunks(head)[0]!.modules[0]!.code = 'dropped its dependency';
    if (outsideImporter) {
      const c = chunk('_astro/c.js', [module('site/c.mts')]); c.modules[0]!.importedIds = ['site/d.mts'];
      chunks(base).push(c); base.files.set('_astro/c.js', Buffer.from('export const value = 1;'));
      chunks(head).push(chunk('_astro/c.js', [module('site/c.mts')])); head.files.set('_astro/c.js', Buffer.from('export const value = 1;'));
    }
    return compare(base, head, {}, 'semantic', undefined, { paths: ['site/a.mts'], layout: 'changes' });
  };
  const gone = (report: Awaited<ReturnType<typeof orphans>>) => report.differences.find(diff => diff.dimension === 'modules' && diff.identity === 'client-0:site/d.mts');
  const only = await orphans(false);
  assert.equal(gone(only)?.insideClosure, true);
  assert.equal(only.exitCode, 0); assert.equal(only.declaration.layoutEligible, true);
  const shared = await orphans(true);
  assert.equal(gone(shared)?.insideClosure, false, 'an importer outside the closure keeps the removal independent');
  assert.equal(shared.exitCode, 1); assert.equal(shared.declaration.layoutEligible, false);
});
