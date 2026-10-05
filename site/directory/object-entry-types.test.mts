import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const aliases = ['ObjectEntry', 'CatalogEntry', 'NavigableObject'];
function source(file: URL): ts.SourceFile {
  return ts.createSourceFile(file.pathname, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
}
/** Every module a file names: imports, re-exports and inline `import('...')` types, resolved against the file. */
function reachedModules(file: URL, tree: ts.SourceFile): string[] {
  const reached: string[] = [];
  const visit = (node: ts.Node): void => {
    const literal = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
      : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
    if (literal && ts.isStringLiteral(literal)) reached.push(literal.text.startsWith('.') ? new URL(literal.text, file).pathname : literal.text);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return reached;
}

test('the directory imports erased aliases directly without depending on the registry', () => {
  const file = new URL('../object-directory.mts', import.meta.url), directory = source(file);
  const registry = new URL('../objects.mts', import.meta.url).pathname;
  assert.ok(!reachedModules(file, directory).some(module => module === registry || module === registry.replace(/\.mts$/u, '')), 'the directory must not name the registry in any import, re-export or import type');
  const typesPath = new URL('./object-entry-types.mts', import.meta.url).pathname;
  const imports = directory.statements.filter(ts.isImportDeclaration);
  const entry = imports.find(node => ts.isStringLiteral(node.moduleSpecifier) && new URL(node.moduleSpecifier.text, file).pathname === typesPath);
  assert.ok(entry?.importClause?.isTypeOnly);
  const bindings = entry.importClause.namedBindings;
  assert.ok(bindings && ts.isNamedImports(bindings));
  assert.deepEqual(bindings.elements.map(node => node.name.text).sort(), ['NavigableObject', 'ObjectEntry']);
});

test('the registry preserves every extracted alias as an erased re-export', () => {
  const registry = source(new URL('../objects.mts', import.meta.url));
  const typesPath = new URL('./object-entry-types.mts', import.meta.url).pathname;
  const exports = registry.statements.filter(ts.isExportDeclaration).filter(node =>
    node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && new URL(node.moduleSpecifier.text, new URL('../objects.mts', import.meta.url)).pathname === typesPath);
  assert.equal(exports.length, 1);
  const entry = exports[0]!;
  assert.ok(entry.isTypeOnly);
  assert.ok(entry.exportClause && ts.isNamedExports(entry.exportClause));
  assert.deepEqual(entry.exportClause.elements.map(node => node.name.text).sort(), [...aliases].sort());
  assert.ok(!registry.statements.some(node => ts.isTypeAliasDeclaration(node) && aliases.includes(node.name.text)));
});

test('the alias owner contains only type imports and the three exported aliases', () => {
  const file = new URL('./object-entry-types.mts', import.meta.url), types = source(file);
  const imports = types.statements.filter(ts.isImportDeclaration);
  assert.equal(imports.length, 2);
  assert.ok(imports.every(node => node.importClause?.isTypeOnly));
  assert.deepEqual(reachedModules(file, types).map(module => module.startsWith('/') ? module.slice(module.lastIndexOf('/browser/')) : module).sort(), ['/browser/browser-types.mts', '@cssearth/objects']);
  const declarations = types.statements.filter(ts.isTypeAliasDeclaration);
  assert.deepEqual(declarations.map(node => node.name.text).sort(), [...aliases].sort());
  assert.ok(declarations.every(node => node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)));
  assert.equal(types.statements.length, imports.length + declarations.length);
  assert.equal(ts.transpileModule(types.text, { compilerOptions: { module: ts.ModuleKind.ESNext, verbatimModuleSyntax: true } }).outputText.trim(), 'export {};');
});
