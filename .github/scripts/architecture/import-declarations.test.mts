/** Declaration syntax, real Astro source lines and production-resolution parity in a tiny repository. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { globDirectory, globPattern, parseDeclarations, readImportDeclarations } from './import-declarations.mts';
import { project } from './projection.mts';

test('each syntax keeps declaration kind, imported symbols and side-effect status', () => {
  const parsed = parseDeclarations([
    "import Default, { type A, B as Local } from './a.mts';", "import { type A, type B } from './a.mts';",
    "import type * as Types from './a.mts';", "export type { A } from './a.mts';", "export * from './a.mts';",
    "export { B } from './a.mts';", "import './style.css';", "const lazy = import(`./a.mts`);",
    "type X = typeof import('./a.mts');", "type Y = import('./a.mts').A;", "new URL('./pic.png', import.meta.url);",
    'import(name);', "import type Q = require('./a.mts');",
  ].join('\n'), 'site/a.test.mts');
  assert.deepEqual(parsed.map(entry => entry.kind), ['value', 'type', 'type', 'type', 'value', 'value', 'value', 'lazy', 'type', 'type', 'value', 'lazy', 'type']);
  assert.deepEqual(parsed[0]?.symbols, ['default', 'A', 'B']);
  assert.equal(parsed[6]?.sideEffectOnly, true);
  assert.equal(parsed[11]?.computed, true);
  assert.deepEqual(parsed.map(entry => entry.line), Array.from({ length: 13 }, (_, i) => i + 1));
  assert.deepEqual(parsed.map(entry => entry.form), ['import', 'import', 'import', 'export-from', 'export-star', 'export-from', 'side-effect', 'dynamic-import', 'import-type-node', 'import-type-node', 'new URL(.., import.meta.url)', 'dynamic-import', 'import']);
});

test('Astro blocks, src and CSS have original lines; inline scripts match production exclusions', () => {
  const parsed = parseDeclarations([
    '---', "import A from './A.astro';", '---', '<A />', '<script>', "import { x } from './x.mts';", '</script>',
    '<script src="./entry.mts"></script>', '<script is:inline>import("./ignored.mts")</script>', '<style>', '@import "./style.css";', '</style>',
  ].join('\n'), 'site/Page.astro');
  assert.deepEqual(parsed.map(entry => [entry.specifier, entry.line]), [['./A.astro', 2], ['./x.mts', 6], ['./entry.mts', 8], ['./style.css', 11]]);
});

test('Astro leading whitespace and CSS URL imports retain lines and ignore comments', () => {
  const parsed = parseDeclarations('\n\n---\nimport "./a.mts";\n---\n<style src="./outer.css">\n/* @import "./ignored.css"; */\n@import url(./inner.css);\n</style>', 'site/Page.astro');
  assert.deepEqual(parsed.map(entry => [entry.specifier, entry.line]), [['./a.mts', 4], ['./outer.css', 6], ['./inner.css', 8]]);
});

test('production resolution retains duplicates, assets, tests, generated stand-ins and zero scanner mismatches', async () => {
  const root = mkdtempSync(join(tmpdir(), 'import-declarations-'));
  const files = {
    'package.json': '{"name":"fixture","type":"module"}',
    'tsconfig.json': '{"compilerOptions":{"module":"ESNext","moduleResolution":"Bundler","noEmit":true}}',
    '.gitignore': 'site/generated.mts\nnode_modules/\n',
    'node_modules/tiny/package.json': '{"name":"tiny"}', 'node_modules/tiny/style.css': 'body {}',
    'site/a.mts': "import { x } from './b.mts';\nimport type { X } from './b.mts';\nimport './data.json';\nimport './generated.mts';\nimport 'node:fs';\nimport './missing.mts';\nimport('node:os');\nimport 'tiny/style.css';\n",
    'site/b.mts': 'export const x = 1; export interface X {}',
    'site/generated.d.mts': 'export {};', 'site/generated.mts': 'export {};', 'site/data.json': '{}',
    'site/a.test.mts': "import './b.mts';", 'site/Empty.astro': '<p />',
  };
  try {
    // A repository of its own with one empty commit: a shared clone of the checkout fails on CI's partial clones.
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '-m', 'fixture'], { cwd: root });
    for (const [file, source] of Object.entries(files)) { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), source); }
    execFileSync('git', ['add', '.'], { cwd: root });
    const result = await readImportDeclarations(root, { prefix: 'site/', checkAgainstScanner: true });
    assert.equal(result.summary.scanner.unexplained, 0);
    assert.equal(result.declarations.find(entry => entry.specifier === './generated.mts')?.to, 'site/generated.d.mts');
    assert.equal(result.declarations.find(entry => entry.specifier === './data.json')?.kind, 'asset');
    assert.equal(result.declarations.find(entry => entry.specifier === './missing.mts')?.unresolved, true);
    assert.equal(result.declarations.find(entry => entry.from.endsWith('.test.mts'))?.test, true);
    assert.equal(result.pairs.find(pair => pair.from === 'site/a.mts' && pair.to === 'site/b.mts')?.declarations, 2);
    assert.equal(result.declarations.find(entry => entry.specifier === 'tiny/style.css')?.to, 'tiny');
    assert.equal(result.declarations.find(entry => entry.specifier === 'tiny/style.css')?.kind, 'asset');
    assert.equal(result.summary.declarations, 9);
    assert.ok(result.summary.files.includes('site/Empty.astro'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('stylesheet imports retain asset kind and source line without reading commented imports', () => {
  const imports = parseDeclarations('/* @import "ignored.css"; */\n@import "./marker.css";\n@import url(./panel.css);', 'site/site.css');
  assert.deepEqual(imports.map(entry => [entry.specifier, entry.kind, entry.line]), [['./marker.css', 'asset', 2], ['./panel.css', 'asset', 3]]);
});

test('Vite globs parse by pattern, eagerness and base; computed patterns stay unresolved', () => {
  const imports = parseDeclarations("import.meta.glob('../scene/*.mts', { eager: true });\nimport.meta.glob<string>(['./a/*.json', '!./a/x.json'], { base: './b' });\nimport.meta.glob(pattern);", 'site/browser/a.mts');
  assert.deepEqual(imports.map(entry => [entry.specifier, entry.kind, entry.line, entry.form]),
    [['../scene/*.mts', 'value', 1, 'import.meta.glob'], ['./a/*.json', 'lazy', 2, 'import.meta.glob'], ['pattern', 'lazy', 3, 'import.meta.glob']]);
  assert.deepEqual(imports[1]?.glob, { base: './b' });
  assert.equal(imports[2]?.computed, true);
});

test('glob patterns resolve as Vite resolves them, with the Vite root at the repository root', () => {
  const from = 'site/browser/a.mts';
  assert.equal(globPattern(from, '../scene/*.mts'), 'site/scene/*.mts');
  assert.equal(globPattern(from, './*.mts'), 'site/browser/*.mts');
  assert.equal(globPattern(from, '/site/scene/*.mts'), 'site/scene/*.mts');
  assert.equal(globPattern(from, './*.mts', '/site/scene'), 'site/scene/*.mts');
  assert.equal(globPattern(from, './*.json', './nested'), 'site/browser/nested/*.json');
  assert.equal(globPattern(from, '../*.mts', '../scene/deep'), 'site/scene/*.mts');
  assert.equal(globPattern(from, '/src/**/*.css', '../x'), 'src/**/*.css');
  assert.equal(globPattern(from, '@alias/*.mts'), undefined);
});

test('the prefilter keeps only literal directories, so extglobs still match', () => {
  assert.equal(globDirectory('site/scene/*.mts'), 'site/scene/');
  assert.equal(globDirectory('site/scene/@(a|b).mts'), 'site/scene/');
  assert.equal(globDirectory('site/scene/+(a).mts'), 'site/scene/');
  assert.equal(globDirectory('site/scene/a.mts'), 'site/scene/');
  assert.equal(globDirectory('**/*.css'), '');
});

test('a glob into a higher site layer is an edge the committed plan refuses', async () => {
  const root = mkdtempSync(join(tmpdir(), 'import-declarations-glob-'));
  const files = {
    'package.json': '{"name":"fixture","type":"module"}',
    'tsconfig.json': '{"compilerOptions":{"module":"ESNext","moduleResolution":"Bundler","noEmit":true}}',
    'site/browser/a.mts': "export const scenes = import.meta.glob('../scene/*.mts', { eager: true });\nexport const data = import.meta.glob('../model/*.json');\nexport const siblings = import.meta.glob('./*.mts', { eager: true });\n",
    'site/browser/root.mts': "export const scenes = import.meta.glob('/site/scene/*.mts');\nexport const based = import.meta.glob('./*.mts', { base: '../scene' });\nexport const named = import.meta.glob('../scene/@(b|c).mts');\n",
    'site/scene/b.mts': 'export const b = 1;', 'site/model/c.json': '{}',
  };
  try {
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--quiet', '--allow-empty', '-m', 'fixture'], { cwd: root });
    for (const [file, source] of Object.entries(files)) { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), source); }
    execFileSync('git', ['add', '.'], { cwd: root });
    const result = await readImportDeclarations(root, { prefix: 'site/', checkAgainstScanner: true });
    assert.equal(result.summary.scanner.unexplained, 0);
    assert.deepEqual(result.declarations.filter(entry => entry.from === 'site/browser/a.mts').map(entry => [entry.to, entry.kind]),
      [['site/scene/b.mts', 'value'], ['site/model/c.json', 'asset'], ['site/browser/root.mts', 'value']]);
    assert.deepEqual(result.declarations.filter(entry => entry.from === 'site/browser/root.mts').map(entry => [entry.to, entry.kind]),
      [['site/scene/b.mts', 'lazy'], ['site/scene/b.mts', 'lazy'], ['site/scene/b.mts', 'lazy']]);
    const tiers: unknown = JSON.parse(readFileSync(new URL('../../../docs/site-architecture/tiers.json', import.meta.url), 'utf8'));
    const projection = project({ declarations: result, moves: {}, tiers });
    assert.deepEqual(projection.views.value?.upward.map(edge => [edge.from, edge.to]), [['site/browser/a.mts', 'site/scene/b.mts']]);
    assert.deepEqual(projection.views['value+lazy']?.upward.map(edge => [edge.from, edge.to]), [['site/browser/a.mts', 'site/scene/b.mts'], ['site/browser/root.mts', 'site/scene/b.mts'], ['site/browser/root.mts', 'site/scene/b.mts'], ['site/browser/root.mts', 'site/scene/b.mts']]);
    assert.equal(projection.failed, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
