/** Exercise move replay against tiny tracked fixtures without preparing or building the site. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';
import { applyMoves, validateMoves } from './apply-moves.mts';
function fixture(files: Record<string, string>, run: (root: string) => void): void {
  const root = mkdtempSync(resolve(tmpdir(), 'build-compare-moves-'));
  try {
    for (const [name, content] of Object.entries(files)) { mkdirSync(dirname(resolve(root, name)), { recursive: true }); writeFileSync(resolve(root, name), content); }
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    run(root);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test('rewrites imports, exports, dynamic imports, URL, types, tests, and Astro scripts without touching lookalike text', () => {
  fixture({
    'site/leaf.mts': "import data from './data.json' with { type: 'json' }; export default data;\n",
    'site/data.json': '{}',
    'site/leaf.test.mts': "import leaf from './leaf.mts'; const note = './leaf.mts'; // import './leaf.mts'\n",
    'site/main.mts': "export { default } from './leaf.mts'; const lazy = import('./leaf.mts'); const url = new URL('./leaf.mts?raw#x', import.meta.url); type T = import('./leaf.mts');\n",
    'site/page.astro': "---\nimport leaf from './leaf.mts';\n---\n<script>import leaf from './leaf.mts';</script><script src='./leaf.mts'></script><p>./leaf.mts</p>\n",
  }, root => {
    const result = applyMoves(root, { 'site/leaf.mts': 'site/world/leaf.mts' });
    assert.equal(result.moved, 1); assert.equal(result.rewritten, 4);
    assert.equal(readFileSync(resolve(root, 'site/world/leaf.mts'), 'utf8'), "import data from '../data.json' with { type: 'json' }; export default data;\n");
    assert.equal(readFileSync(resolve(root, 'site/leaf.test.mts'), 'utf8'), "import leaf from './world/leaf.mts'; const note = './leaf.mts'; // import './leaf.mts'\n");
    assert.equal(readFileSync(resolve(root, 'site/main.mts'), 'utf8'), "export { default } from './world/leaf.mts'; const lazy = import('./world/leaf.mts'); const url = new URL('./world/leaf.mts?raw#x', import.meta.url); type T = import('./world/leaf.mts');\n");
    assert.equal(readFileSync(resolve(root, 'site/page.astro'), 'utf8'), "---\nimport leaf from './world/leaf.mts';\n---\n<script>import leaf from './world/leaf.mts';</script><script src='./world/leaf.mts'></script><p>./leaf.mts</p>\n");
    assert.equal(existsSync(resolve(root, 'site/leaf.mts')), false);
    assert.match(execFileSync('git', ['diff', '--cached', '--name-status'], { cwd: root, encoding: 'utf8' }), /site\/world\/leaf.mts/u);
  });
});
test('simultaneous moves rewrite both endpoints and preserve extensionless, js, and non-code styles', () => {
  fixture({ 'site/a.ts': "import './b'; import './c.js'; import './sheet.css'; import './bank';\n", 'site/b.ts': '', 'site/c.ts': '', 'site/sheet.css': '', 'site/bank/index.ts': '' }, root => {
    applyMoves(root, { 'site/a.ts': 'site/deep/a.ts', 'site/b.ts': 'site/other/b.ts', 'site/c.ts': 'site/other/c.ts', 'site/sheet.css': 'site/other/sheet.css', 'site/bank/index.ts': 'site/other/bank/index.ts' });
    assert.equal(readFileSync(resolve(root, 'site/deep/a.ts'), 'utf8'), "import '../other/b'; import '../other/c.js'; import '../other/sheet.css'; import '../other/bank';\n");
  });
});
test('ambiguous extensionless reference refuses before moving or writing any file', () => {
  fixture({ 'site/a.mts': "import './b';", 'site/b.ts': '', 'site/b.mts': '' }, root => {
    assert.throws(() => applyMoves(root, { 'site/a.mts': 'site/world/a.mts' }), /Ambiguous/u);
    assert.equal(readFileSync(resolve(root, 'site/a.mts'), 'utf8'), "import './b';");
    assert.equal(existsSync(resolve(root, 'site/world/a.mts')), false);
  });
});
test('computed references crossing a moved prefix or in a moved importer refuse', () => {
  fixture({ 'site/a.mts': 'const x = import(`./world/${name}.mts`);', 'site/world/b.mts': '' }, root => {
    assert.throws(() => applyMoves(root, { 'site/world/b.mts': 'site/b.mts' }), /Computed reference/u);
  });
  fixture({ 'site/a.mts': 'const x = import(variable);' }, root => {
    assert.throws(() => applyMoves(root, { 'site/a.mts': 'site/world/a.mts' }), /computed reference/iu);
  });
});
test('rejects deletion, destination collisions, changed extension, and invalid maps', () => {
  for (const value of [null, [], { '../outside': 'site/a.mts' }, { 'site/a.mts': '../outside' }, { 'site/a.mts': 'site/a.mts' }, { 'site/a.mts': 'site/c.mts', 'site/b.mts': 'site/c.mts' }, { 'site/a.mts': 'site/b.mts', 'site/b.mts': 'site/c.mts' }]) assert.throws(() => validateMoves(value));
  fixture({ 'site/a.mts': '', 'site/b.mts': "import './a.mts';" }, root => {
    assert.throws(() => applyMoves(root, { 'site/a.mts': null }), /Deletion/u);
    assert.throws(() => applyMoves(root, { 'site/a.mts': 'site/b.mts' }), /destination exists/u);
    assert.throws(() => applyMoves(root, { 'site/a.mts': 'site/a.ts' }), /extension style/u);
  });
});
test('replay refuses rather than silently applying twice', () => {
  fixture({ 'site/a.mts': '' }, root => {
    applyMoves(root, { 'site/a.mts': 'site/world/a.mts' });
    assert.throws(() => applyMoves(root, { 'site/a.mts': 'site/world/a.mts' }), /source must/u);
  });
});
test('URL directories retain trailing slash and Astro comments remain literal', () => {
  fixture({
    'site/a.mts': "const url = new URL('./data/', import.meta.url);\n",
    'site/data/x.json': '{}',
    'site/page.astro': "---\nconst example = `<script src='./a.mts'></script>`;\n---\n<!-- <script src='./a.mts'>import './a.mts';</script> -->\n<script src='./a.mts'></script>\n",
  }, root => {
    applyMoves(root, { 'site/a.mts': 'site/world/a.mts' });
    assert.equal(readFileSync(resolve(root, 'site/world/a.mts'), 'utf8'), "const url = new URL('../data/', import.meta.url);\n");
    assert.equal(readFileSync(resolve(root, 'site/page.astro'), 'utf8'), "---\nconst example = `<script src='./a.mts'></script>`;\n---\n<!-- <script src='./a.mts'>import './a.mts';</script> -->\n<script src='./world/a.mts'></script>\n");
  });
});
test('finite literal loop URL targets are checked rather than broad prefix guesses', () => {
  fixture({
    'site/a.mts': '',
    'site/sheets.mts': "for (const sheet of ['x.css', 'y.css']) { new URL(`./${sheet}`, import.meta.url); }",
    'site/x.css': '', 'site/y.css': '',
  }, root => {
    applyMoves(root, { 'site/a.mts': 'site/world/a.mts' });
    assert.equal(readFileSync(resolve(root, 'site/sheets.mts'), 'utf8'), "for (const sheet of ['x.css', 'y.css']) { new URL(`./${sheet}`, import.meta.url); }");
    assert.throws(() => applyMoves(root, { 'site/x.css': 'site/z.css' }), /Finite computed reference crosses/u);
  });
});
test('nonfinite loop URL targets remain ambiguous', () => {
  fixture({ 'site/a.mts': '', 'site/sheets.mts': 'for (const path of readStyles()) new URL(`./${path}`, import.meta.url);' }, root => {
    assert.throws(() => applyMoves(root, { 'site/a.mts': 'site/world/a.mts' }), /Computed reference/u);
  });
});
test('repository-root ancestor prefix is a warning rather than a moved-folder prefix', () => {
  fixture({ 'site/a.mts': '', 'site/world/check.mts': 'new URL(`../../${path}`, import.meta.url);' }, root => {
    const plan = applyMoves(root, { 'site/a.mts': 'site/world/a.mts' }, { dryRun: true });
    assert.equal(plan.manualReviewRequired.length, 0); assert.equal(plan.unrelatedWarnings, 1);
    assert.equal(existsSync(resolve(root, 'site/a.mts')), true);
    assert.equal(existsSync(resolve(root, 'site/world/a.mts')), false);
  });
});
test('unrelated opaque imports are UNRESOLVED warnings with file, line, and expression', () => {
  for (const expression of ['resolvePath()', 'pathToFileURL(resolve(output, \'worker.mjs\')).href', '`/output/${name}.mjs`', '`package/${name}`', "pathToFileURL(resolve(process.cwd(), 'site/build/prepare/authored/prepare-object-json.mts')).href"]) {
    fixture({ 'site/a.mts': '', 'site/check.mts': `// heading\nimport(${expression});` }, root => {
      assert.doesNotThrow(() => applyMoves(root, { 'site/a.mts': 'site/world/a.mts' }, { dryRun: true }));
      const plan = applyMoves(root, { 'site/a.mts': 'site/world/a.mts' }, { dryRun: true });
      assert.equal(plan.manualReviewRequired.length, 0); assert.equal(plan.unrelatedWarnings, 1);
      assert.equal(existsSync(resolve(root, 'site/a.mts')), true);
    });
  }
});
test('opaque expression mentioning moved path, folder, or basename refuses before writing', () => {
  for (const expression of ["resolvePath('site/bank/a.mts')", "resolvePath('./bank')", "resolvePath('a.mts')", 'paths["site/bank"]', 'pathToFileURL(resolve(base, `site/bank/${name}`)).href']) {
    fixture({ 'site/bank/a.mts': '', 'site/check.mts': `import(${expression});` }, root => {
      assert.throws(() => applyMoves(root, { 'site/bank/a.mts': 'site/world/a.mts' }), /Computed reference/u);
      assert.equal(existsSync(resolve(root, 'site/bank/a.mts')), true);
    });
  }
});
test('moved importer retains absolute/package and build-output warnings but refuses relative unknowns', () => {
  for (const expression of ['`/output/${name}.mjs`', '`package/${name}`', "pathToFileURL(resolve(output, 'worker.mjs')).href"]) {
    fixture({ 'site/a.mts': `import(${expression});` }, root => {
      assert.equal(applyMoves(root, { 'site/a.mts': 'site/world/a.mts' }).unrelatedWarnings, 1);
    });
  }
  for (const expression of ['resolvePath()', '`./other/${name}.mts`']) {
    fixture({ 'site/a.mts': `import(${expression});` }, root => {
      assert.throws(() => applyMoves(root, { 'site/a.mts': 'site/world/a.mts' }), /Computed reference/u);
    });
  }
});
test('dry run prints a complete plan and leaves contents, directories and git index unchanged', () => {
  fixture({ 'site/a.mts': '', 'site/test.mts': "import './a.mts';", 'site/page.astro': "---\nimport './a.mts';\n---\n" }, root => {
    const before = execFileSync('git', ['diff', '--cached'], { cwd: root, encoding: 'utf8' });
    const plan = applyMoves(root, { 'site/a.mts': 'site/world/a.mts' }, { dryRun: true });
    assert.deepEqual(plan.moves, { 'site/a.mts': 'site/world/a.mts' });
    assert.equal(plan.rewritten, 2);
    assert.deepEqual(plan.rewrites, [
      { file: 'site/page.astro', edits: [{ line: 2, from: './a.mts', to: './world/a.mts' }] },
      { file: 'site/test.mts', edits: [{ line: 1, from: './a.mts', to: './world/a.mts' }] },
    ]);
    assert.equal(readFileSync(resolve(root, 'site/test.mts'), 'utf8'), "import './a.mts';");
    assert.equal(existsSync(resolve(root, 'site/world')), false);
    assert.equal(execFileSync('git', ['diff', '--cached'], { cwd: root, encoding: 'utf8' }), before);
    writeFileSync(resolve(root, 'moves.json'), JSON.stringify(plan.moves));
    const output = execFileSync(process.execPath, [resolve('.github/scripts/build-compare/apply-moves.mts'), '--checkout', root, resolve(root, 'moves.json'), '--dry-run'], { encoding: 'utf8', input: '' });
    assert.match(output, /manual review required/u);
  });
});
test('URL literals without dot prefixes are relative to their importer', () => {
  fixture({ 'site/a.mts': "new URL('data.json', import.meta.url);", 'site/data.json': '{}' }, root => {
    const plan = applyMoves(root, { 'site/a.mts': 'site/world/a.mts' });
    assert.equal(plan.manualReviewRequired.length, 0);
    assert.equal(readFileSync(resolve(root, 'site/world/a.mts'), 'utf8'), "new URL('../data.json', import.meta.url);");
  });
});

test('finite computed references in moved importers still refuse', () => {
  fixture({ 'site/a.mts': "for (const name of ['x.mts']) import(`./${name}`);", 'site/x.mts': '' }, root => {
    assert.throws(() => applyMoves(root, { 'site/a.mts': 'site/world/a.mts' }), /Computed reference in a moved importer/u);
  });
});

test('every tracked owner is scanned, including CSS, Astro styles, config and exact globs', () => {
  fixture({ 'site/leaf.css': 'body{}', 'site/sheet.css': "@import './leaf.css';", 'site/page.astro': "<style>@import './leaf.css'; a{background:url('./leaf.css')}</style>", 'astro.config.mts': "import './site/leaf.css';", 'packages/check.mts': "import '../site/leaf.css';", 'site/glob.mts': "import.meta.glob('./leaf.css');" }, root => {
    const plan = applyMoves(root, { 'site/leaf.css': 'site/styles/leaf.css' });
    assert.equal(plan.rewritten, 5);
    assert.match(readFileSync(resolve(root, 'site/sheet.css'), 'utf8'), /styles\/leaf.css/u);
    assert.match(readFileSync(resolve(root, 'astro.config.mts'), 'utf8'), /styles\/leaf.css/u);
    assert.match(readFileSync(resolve(root, 'packages/check.mts'), 'utf8'), /styles\/leaf.css/u);
    assert.match(readFileSync(resolve(root, 'site/page.astro'), 'utf8'), /styles\/leaf.css/u);
    assert.match(readFileSync(resolve(root, 'site/glob.mts'), 'utf8'), /styles\/leaf.css/u);
  });
});
test('plain paths, dirname paths, computed literals and wildcard hits are reported', () => {
  fixture({ 'site/leaf.mts': '', 'outside.mts': "readFileSync('site/leaf.mts'); resolve(import.meta.dirname, 'site/leaf.mts'); const path = 'site/' + 'leaf.mts'; import.meta.glob('./site/*.mts');", 'guide.md': 'leaf.mts', 'package.json': '{"path":"site/leaf.mts"}' }, root => {
    const plan = applyMoves(root, { 'site/leaf.mts': 'site/world/leaf.mts' }, { dryRun: true });
    assert.ok(plan.manualReviewRequired.some(warning => warning.file === 'outside.mts'));
    assert.ok(plan.manualReviewRequired.some(warning => warning.file === 'guide.md'));
    assert.ok(plan.rewrites.some(rewrite => rewrite.file === 'package.json'));
  });
});

for (const expression of ["readFileSync('site/leaf.mts');", "resolve(import.meta.dirname, 'site', 'leaf.mts');", "const path='site/'+'leaf.mts';", "import.meta.glob('./site/*.mts');"]) test(`opaque moved-source operand is reported: ${expression}`, () => {
  fixture({ 'site/leaf.mts': '', 'outside.mts': expression }, root => {
    const plan = applyMoves(root, { 'site/leaf.mts': 'site/world/leaf.mts' }, { dryRun: true });
    assert.ok(plan.manualReviewRequired.some(warning => warning.file === 'outside.mts' && warning.expression.includes('leaf.mts')));
    assert.equal(readFileSync(resolve(root, 'outside.mts'), 'utf8'), expression);
  });
});

test('relative folder operands cannot disappear into the unrelated warning count', () => {
 fixture({'site/folder/leaf.mts':'','site/read.mts':"readFileSync(resolve(import.meta.dirname, './folder'));"},root=>{
  const plan=applyMoves(root,{'site/folder/leaf.mts':'site/moved/leaf.mts'},{dryRun:true});
  assert.ok(plan.manualReviewRequired.some(entry=>entry.file==='site/read.mts' && entry.expression.includes('./folder')));
 });
});
test('commit-pinned Markdown links exempt only their own span', () => {
 fixture({'site/leaf.mts':'','guide.md':'https://github.com/example/repo/blob/abcdef1/site/leaf.mts and readFileSync(site/leaf.mts)'},root=>{
  const plan=applyMoves(root,{'site/leaf.mts':'site/moved/leaf.mts'},{dryRun:true});
  assert.ok(plan.manualReviewRequired.some(entry=>entry.file==='guide.md'));
 });
});

test('an unrelated Markdown folder link is unambiguous even when it has an index module',()=>{
 fixture({'site/leaf.mts':'','packages/lib/index.ts':'','guide.md':'[Library](./packages/lib/)'},root=>{
  const plan=applyMoves(root,{'site/leaf.mts':'site/moved/leaf.mts'},{dryRun:true});
  assert.equal(plan.moved,1);
  assert.equal(readFileSync(resolve(root,'guide.md'),'utf8'),'[Library](./packages/lib/)');
 });
});

for (const expression of [
  "resolve(import.meta.dirname, '../data/d.json')",
  "join(import.meta.dirname, 'fixtures')",
  "resolve(__dirname, '../data/d.json')",
  "join(__dirname, 'fixtures')",
  "readFile('../data/d.json')",
  "readFileSync('fixtures')",
  "new URL('../data/d.json', baseURL)",
  "URL('../data/d.json', baseURL)",
  "fileURLToPath('fixtures')",
  "path.resolve(import.meta.dirname, 'fixtures')",
  "fs.readFileSync('fixtures')",
]) test(`relative API operand inside a moved file is UNRESOLVED: ${expression}`, () => {
  fixture({ 'site/leaf.mts': `// heading\n${expression};` }, root => {
    const plan = applyMoves(root, { 'site/leaf.mts': 'site/moved/leaf.mts' }, { dryRun: true });
    assert.ok(plan.manualReviewRequired.some(entry => entry.file === 'site/leaf.mts' && entry.line === 2 && entry.expression === expression && entry.classification === 'UNRESOLVED'));
    assert.equal(readFileSync(resolve(root, 'site/leaf.mts'), 'utf8'), `// heading\n${expression};`);
  });
});
for (const markup of [
  '<img src="../images/image.png">',
  '<a href="relative/page">Link</a>',
  '<img src={"../images/image.png"}>',
  '<a href=relative/page>Link</a>',
  '<style>a { background: url(../images/image.png); }</style>',
  '<div style="background:url(../images/image.png)"></div>',
]) test(`relative Astro markup inside a moved file is UNRESOLVED: ${markup}`, () => {
  fixture({ 'site/leaf.astro': `---\nconst value = 1;\n---\n${markup}` }, root => {
    const plan = applyMoves(root, { 'site/leaf.astro': 'site/moved/leaf.astro' }, { dryRun: true });
    assert.ok(plan.manualReviewRequired.some(entry => entry.file === 'site/leaf.astro' && entry.line === 4 && entry.classification === 'UNRESOLVED'));
  });
});
test('absolute URLs and commented markup do not create moved-file relative warnings', () => {
  fixture({ 'site/leaf.astro': '<!-- <img src="relative.png"> -->\n<img src="https://example.test/image.png"><a href="/page"><style>a{background:url(data:image/png;base64,x)}</style>', 'site/leaf.mts': "resolve('/absolute'); join('https://example.test'); readFileSync('/absolute');" }, root => {
    const plan = applyMoves(root, { 'site/leaf.astro': 'site/moved/leaf.astro', 'site/leaf.mts': 'site/moved/leaf.mts' }, { dryRun: true });
    assert.equal(plan.manualReviewRequired.length, 0);
  });
});
test('bare directory-name strings are dropped while basename and real path mentions remain', () => {
  fixture({ 'site/leaf.mts': '', 'outside.mts': "const name = 'site';\nconst name2 = 'site';\nreadFileSync('site/leaf.mts');\nconst basename = 'leaf.mts';" }, root => {
    const plan = applyMoves(root, { 'site/leaf.mts': 'site/moved/leaf.mts' }, { dryRun: true });
    assert.deepEqual(plan.manualReviewRequired.map(entry => entry.line), [3, 4]);
  });
});
test('nested bare directory names are dropped but qualified folder paths remain', () => {
  fixture({ 'site/bank/leaf.mts': '', 'outside.mts': "const name = 'bank';\nconst folder = 'site/bank';" }, root => {
    const plan = applyMoves(root, { 'site/bank/leaf.mts': 'site/moved/leaf.mts' }, { dryRun: true });
    assert.deepEqual(plan.manualReviewRequired.map(entry => entry.line), [2]);
  });
});
test('root directory prose and unrelated globs do not identify moved files', () => {
  fixture({ 'site/leaf.mts': '', 'outside.mts': "const folder = 'site/';\nconst other = 'site/build/**';\nconst actual = 'site/*.mts';", 'guide.md': "A 'sentence\nwith stars * and another 'quote" }, root => {
    const plan = applyMoves(root, { 'site/leaf.mts': 'site/moved/leaf.mts' }, { dryRun: true });
    assert.deepEqual(plan.manualReviewRequired.map(entry => [entry.file, entry.line]), [['outside.mts', 3]]);
  });
});
test('script string examples are not Astro markup operands', () => {
  fixture({ 'site/leaf.astro': '<script>const example = `<img src="../image.png"><a href="relative/page">`; const style = `url(../image.png)`;</script>' }, root => {
    const plan = applyMoves(root, { 'site/leaf.astro': 'site/moved/leaf.astro' }, { dryRun: true });
    assert.equal(plan.manualReviewRequired.length, 0);
  });
});
test('moved Astro styles preserve statically resolved CSS imports', () => {
  fixture({ 'site/leaf.astro': '<style>@import "./sheet.css";</style>', 'site/sheet.css': 'body {}' }, root => {
    const plan = applyMoves(root, { 'site/leaf.astro': 'site/moved/leaf.astro' });
    assert.equal(readFileSync(resolve(root, 'site/moved/leaf.astro'), 'utf8'), '<style>@import "../sheet.css";</style>');
    assert.equal(plan.manualReviewRequired.length, 0);
  });
});
