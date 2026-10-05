/** Declaration syntax, real Astro source lines and production-resolution parity in a tiny repository. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { parseDeclarations, readImportDeclarations } from './import-declarations.mts';

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
    // Reuse an existing HEAD without creating a commit, and populate only this fixture's index.
    execFileSync('git', ['clone', '--quiet', '--shared', '--no-checkout', process.cwd(), root]);
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
