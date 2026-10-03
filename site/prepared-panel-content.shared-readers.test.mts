import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import ts from 'typescript';

const primitives = ['object', 'text', 'number', 'optionalText', 'optionalBoolean', 'array'];
function assertSharedReaders(path: string, expected: Readonly<Record<string, string>>, namespace = false): void {
  const tree = ts.createSourceFile(path, readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  const protectedNames = new Set([...primitives, ...Object.keys(expected), 'preparedPanelReaders']);
  const admitted = new Set<string>();
  function visit(node: ts.Node): void {
    if (ts.isImportSpecifier(node) && protectedNames.has(node.name.text)) {
      const declaration = node.parent.parent.parent;
      assert.ok(ts.isImportDeclaration(declaration) && ts.isStringLiteral(declaration.moduleSpecifier));
      const owner = declaration.moduleSpecifier.text;
      const original = (node.propertyName ?? node.name).text;
      assert.equal(owner, namespace ? '@cssearth/objects' : './panel-readers.js');
      assert.equal(original, namespace ? 'preparedPanelReaders' : expected[node.name.text]);
      assert.ok(!node.isTypeOnly && !node.parent.parent.isTypeOnly);
      admitted.add(node.name.text);
    } else if (ts.isBindingElement(node) && ts.isIdentifier(node.name) && protectedNames.has(node.name.text)) {
      const declaration = node.parent.parent;
      assert.ok(namespace && ts.isObjectBindingPattern(node.parent) && ts.isVariableDeclaration(declaration));
      assert.ok(declaration.initializer && ts.isIdentifier(declaration.initializer));
      assert.equal(declaration.initializer.text, 'preparedPanelReaders');
      assert.equal((node.propertyName ?? node.name).getText(tree), expected[node.name.text]);
      assert.equal(node.initializer, undefined);
      assert.equal(node.dotDotDotToken, undefined);
      admitted.add(node.name.text);
    } else if (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) ||
      ts.isClassDeclaration(node) || ts.isClassExpression(node) || ts.isParameter(node) || ts.isImportClause(node) ||
      ts.isNamespaceImport(node) || ts.isImportEqualsDeclaration(node) || ts.isEnumDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isModuleDeclaration(node)) {
      if (node.name && ts.isIdentifier(node.name)) assert.ok(!protectedNames.has(node.name.text), `Local reader declaration: ${node.name.text}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  for (const name of Object.keys(expected)) assert.ok(admitted.has(name), `Missing shared reader: ${name}`);
  if (namespace) assert.ok(admitted.has('preparedPanelReaders'));
}

test('site panel primitives come from the shared reader namespace without local redefinitions', () => {
  assertSharedReaders('./prepared-panel-content.mts', Object.fromEntries(primitives.map(name => [name, name])), true);
});
