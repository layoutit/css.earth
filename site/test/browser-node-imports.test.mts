/**
 * A real browser never runs a Node built-in: Vite externalizes any `node:` import
 * reachable from the client bundle and throws the moment the module's exports are
 * touched, even when the call site itself never executes there (see
 * `site/world-context-plan.mts`, fixed after `pnpm dev` broke on every page).
 *
 * This walks the actual static-import closure from the site's real client entry
 * points — found the same way a browser finds them, from the one non-`is:inline`
 * `<script>` block Astro compiles into a client module (`site/layouts/ObjectLayout.astro`)
 * — and fails if any reachable module has a *static* `node:` import. A dynamic
 * `import()` is not followed past the two entry points: that is the documented,
 * legitimate escape hatch for Node-only code (guarded behind a runtime check that
 * is never true in a browser), and following it here would defeat the guard's
 * own fix.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isBuiltin } from 'node:module';
import { dirname, resolve, relative } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import ts from 'typescript';

const root = resolve(import.meta.dirname, '../..');

/** Static (non-type-only) import/export specifiers declared at a module's top level. Dynamic `import()` is excluded on purpose: see the module doc comment. */
function staticSpecifiers(source: string, file: string): string[] {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const specifiers: string[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      const typeOnly = 'importClause' in node && node.importClause?.isTypeOnly || 'isTypeOnly' in node && node.isTypeOnly;
      if (!typeOnly) specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return specifiers;
}

/** Extract the one real (non-`is:inline`) client `<script>` block's own static and dynamic import specifiers. */
function entrySpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(/<script(?![^>]*is:inline)[^>]*>([\s\S]*?)<\/script>/g)) {
    for (const call of match[1]!.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*[),]/g)) specifiers.push(call[2]!);
    for (const declaration of match[1]!.matchAll(/\bimport\s+[^;'"]*?from\s*(['"])([^'"]+)\1/g)) specifiers.push(declaration[2]!);
  }
  return specifiers;
}

const EXTENSIONS = ['', '.mts', '.ts', '.tsx', '.mjs', '.js'];
async function resolveRepoFile(fromDirectory: string, specifier: string): Promise<string | null> {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null; // Bare/package specifiers are governed by other boundary checks; treated as opaque leaves here.
  const base = resolve(fromDirectory, specifier);
  for (const extension of EXTENSIONS) {
    const candidate = base + extension;
    try { await readFile(candidate); return candidate; } catch { /* try the next extension */ }
  }
  return null;
}

interface Violation { file: string; specifier: string; }

/** A workspace package's Node-only entry (`@cssearth/core/node`) imports Node built-ins, so it counts as one. */
const NODE_ENTRY = /^@cssearth\/[a-z-]+\/node$/u;

/** Walk the static closure from `entryFiles`; return every `node:` import reached. */
async function findStaticNodeImports(entryFiles: readonly string[]): Promise<Violation[]> {
  const visited = new Set<string>(), violations: Violation[] = [];
  async function visit(path: string) {
    if (visited.has(path)) return;
    visited.add(path);
    const source = await readFile(path, 'utf8');
    for (const specifier of staticSpecifiers(source, path)) {
      if (isBuiltin(specifier) || NODE_ENTRY.test(specifier)) { violations.push({ file: relative(root, path), specifier }); continue; }
      const target = await resolveRepoFile(dirname(path), specifier);
      if (target) await visit(target);
    }
  }
  for (const file of entryFiles) await visit(file);
  return violations;
}

async function discoverClientEntryFiles(): Promise<string[]> {
  const layout = await readFile(resolve(root, 'site/layouts/ObjectLayout.astro'), 'utf8');
  const specifiers = entrySpecifiers(layout);
  assert.ok(specifiers.length >= 2, 'The shell layout must still declare its client entry script.');
  const files = await Promise.all(specifiers.map(specifier => resolveRepoFile(resolve(root, 'site/layouts'), specifier)));
  const resolved = files.filter((file): file is string => file !== null);
  assert.deepEqual(resolved.length, specifiers.length, 'Every client entry specifier must resolve to a real file.');
  return resolved;
}

test('no module reachable from the browser entry points has a static node: import', async () => {
  const entryFiles = await discoverClientEntryFiles();
  const violations = await findStaticNodeImports(entryFiles);
  assert.deepEqual(violations, [], `A real browser would crash on these static Node imports:\n${
    violations.map(v => `${v.file}: ${v.specifier}`).join('\n')}`);
});

test('mutation check: a static node: import reachable from an entry is caught', async () => {
  const stage = await mkdtemp(resolve(tmpdir(), 'browser-node-imports-'));
  try {
    await writeFile(resolve(stage, 'entry.mts'), "import './leaf.mts';\n");
    await writeFile(resolve(stage, 'leaf.mts'), "import { existsSync } from 'node:fs';\nexistsSync('.');\n");
    const violations = await findStaticNodeImports([resolve(stage, 'entry.mts')]);
    assert.deepEqual(violations, [{ file: relative(root, resolve(stage, 'leaf.mts')), specifier: 'node:fs' }]);
  } finally { await rm(stage, { recursive: true, force: true }); }
});

test('mutation check: a static import of a workspace node entry reachable from an entry is caught', async () => {
  const stage = await mkdtemp(resolve(tmpdir(), 'browser-node-imports-entry-'));
  try {
    await writeFile(resolve(stage, 'entry.mts'), "import './leaf.mts';\n");
    await writeFile(resolve(stage, 'leaf.mts'), "import { sha256 } from '@cssearth/core/node';\nimport { isArray } from '@cssearth/core';\nsha256(String(isArray([])));\n");
    const violations = await findStaticNodeImports([resolve(stage, 'entry.mts')]);
    assert.deepEqual(violations, [{ file: relative(root, resolve(stage, 'leaf.mts')), specifier: '@cssearth/core/node' }]);
  } finally { await rm(stage, { recursive: true, force: true }); }
});

test('mutation check: a node: import reached only through a dynamic import() is not flagged', async () => {
  const stage = await mkdtemp(resolve(tmpdir(), 'browser-node-imports-dynamic-'));
  try {
    await writeFile(resolve(stage, 'entry.mts'), "if (false) await import('./leaf.mts');\n");
    await writeFile(resolve(stage, 'leaf.mts'), "import { existsSync } from 'node:fs';\nexistsSync('.');\n");
    const violations = await findStaticNodeImports([resolve(stage, 'entry.mts')]);
    assert.deepEqual(violations, [], 'A guarded dynamic import is the documented Node-only escape hatch; it must not be followed.');
  } finally { await rm(stage, { recursive: true, force: true }); }
});
